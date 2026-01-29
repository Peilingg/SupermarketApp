const RefundRequest = require('../models/RefundRequest');
const Purchase = require('../models/Purchase');
const User = require('../models/User');

const RefundController = {
  // User requests refund for a purchase
  requestRefund: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const purchaseId = req.params.purchaseId || req.body.purchaseId;
    const reason = req.body.reason || '';

    console.log('Refund request received:', { purchaseId, userId: sessionUser.userId, reason });

    if (!purchaseId) {
      console.error('Purchase ID is missing');
      req.flash && req.flash('error', 'Purchase ID is required.');
      return res.redirect('/purchases');
    }

    // Verify the purchase belongs to the user
    Purchase.getWithItems(purchaseId, sessionUser.userId, function(err, purchase) {
      if (err) {
        console.error('Purchase lookup error:', err);
        req.flash && req.flash('error', 'Error verifying purchase: ' + err.message);
        return res.redirect('/purchases');
      }
      
      if (!purchase) {
        console.error('Purchase not found for user:', sessionUser.userId);
        req.flash && req.flash('error', 'Purchase not found.');
        return res.redirect('/purchases');
      }

      // Check if refund request already exists for this purchase
      RefundRequest.existsForPurchase(purchaseId, function(existsErr, exists) {
        if (existsErr) {
          console.error('Refund existence check error:', existsErr);
          req.flash && req.flash('error', 'Error checking refund status: ' + existsErr.message);
          return res.redirect('/purchases');
        }

        if (exists) {
          console.warn('Refund already exists for purchase:', purchaseId);
          req.flash && req.flash('warning', 'A refund request for this order already exists.');
          return res.redirect('/purchases');
        }

        // Create new refund request
        RefundRequest.create(purchaseId, sessionUser.userId, reason, function(createErr, result) {
          if (createErr) {
            console.error('RefundController.requestRefund - Create error:', createErr);
            req.flash && req.flash('error', 'Failed to request refund: ' + createErr.message);
            return res.redirect('/purchases');
          }

          console.log('Refund request created successfully:', result);
          req.flash && req.flash('success', 'Refund request submitted. Please wait for admin review.');
          return res.redirect('/purchases');
        });
      });
    });
  },

  // Get user's refund requests
  listByUser: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    RefundRequest.listByUser(sessionUser.userId, function(err, refunds) {
      if (err) {
        console.error('RefundController.listByUser error:', err);
        req.flash && req.flash('error', 'Unable to load refund requests.');
        return res.render('refundHistory', { refunds: [], user: sessionUser });
      }

      return res.render('refundHistory', { refunds: refunds || [], user: sessionUser });
    });
  },

  // Admin: list all refund requests
  listAll: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || sessionUser.role !== 'admin') return res.redirect('/login');

    const status = req.query.status || 'pending';

    RefundRequest.listAll(status, function(err, refunds) {
      if (err) {
        console.error('RefundController.listAll error:', err);
        req.flash && req.flash('error', 'Unable to load refund requests.');
        return res.render('manageRefunds', { refunds: [], status: status, user: sessionUser });
      }

      return res.render('manageRefunds', { refunds: refunds || [], status: status, user: sessionUser });
    });
  },

  // Admin: view single refund request
  getDetail: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || sessionUser.role !== 'admin') return res.redirect('/login');

    const refundId = req.params.refundId || req.params.id;

    RefundRequest.getById(refundId, function(err, refund) {
      if (err || !refund) {
        req.flash && req.flash('error', 'Refund request not found.');
        return res.redirect('/managerefunds');
      }

      // Get purchase items
      Purchase.getWithItems(refund.purchaseId, null, function(purchaseErr, purchase) {
        if (purchaseErr) {
          console.error('RefundController.getDetail - Purchase error:', purchaseErr);
          req.flash && req.flash('error', 'Error loading purchase details.');
          return res.redirect('/managerefunds');
        }

        // If purchase not found, create empty object with empty items array
        if (!purchase) {
          purchase = { items: [] };
        }

        return res.render('refundDetail', {
          refund: refund,
          purchase: purchase,
          user: sessionUser
        });
      });
    });
  },

  // Admin: approve refund
  approve: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || sessionUser.role !== 'admin') return res.redirect('/login');

    const refundId = req.params.refundId || req.body.refundId;
    const adminNotes = req.body.adminNotes || '';
    const customRefundAmount = req.body.refundAmount ? parseFloat(req.body.refundAmount) : null;

    if (!refundId) {
      req.flash && req.flash('error', 'Refund ID is required.');
      return res.redirect('/managerefunds');
    }

    if (!customRefundAmount || customRefundAmount <= 0) {
      req.flash && req.flash('error', 'Invalid refund amount. Please enter a valid amount.');
      return res.redirect('/refund/' + refundId);
    }

    RefundRequest.approve(refundId, adminNotes, customRefundAmount, function(err, result) {
      if (err) {
        console.error('RefundController.approve error:', err);
        req.flash && req.flash('error', 'Failed to approve refund: ' + (err.message || 'Unknown error'));
        return res.redirect('/managerefunds');
      }

      const refundAmount = Number(result.refundAmount || 0);
      const userId = result.userId;

      // Store refund notification in session for the affected user
      // This will be shown to the user when they visit the shopping page
      if (!req.session.userNotifications) req.session.userNotifications = {};
      if (!req.session.userNotifications[userId]) req.session.userNotifications[userId] = [];
      req.session.userNotifications[userId].push({
        type: 'refund-success',
        message: `Refund successful! $${refundAmount.toFixed(2)} store credit has been added to your wallet.`
      });

      req.flash && req.flash('success', `Refund of $${refundAmount.toFixed(2)} has been approved and added as store credit.`);
      return res.redirect('/managerefunds');
    });
  },

  // Admin: reject refund
  reject: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || sessionUser.role !== 'admin') return res.redirect('/login');

    const refundId = req.params.refundId || req.body.refundId;
    const adminNotes = req.body.adminNotes || '';

    if (!refundId) {
      req.flash && req.flash('error', 'Refund ID is required.');
      return res.redirect('/managerefunds');
    }

    // First get refund details to get userId
    RefundRequest.getById(refundId, function(getErr, refund) {
      if (getErr || !refund) {
        req.flash && req.flash('error', 'Refund request not found.');
        return res.redirect('/managerefunds');
      }

      RefundRequest.reject(refundId, adminNotes, function(err, result) {
        if (err) {
          console.error('RefundController.reject error:', err);
          req.flash && req.flash('error', 'Failed to reject refund.');
          return res.redirect('/managerefunds');
        }

        const userId = refund.userId;

        // Store refund notification in session for the affected user
        if (!req.session.userNotifications) req.session.userNotifications = {};
        if (!req.session.userNotifications[userId]) req.session.userNotifications[userId] = [];
        req.session.userNotifications[userId].push({
          type: 'refund-rejected',
          message: 'Refund request unsuccessful. Your refund request has been reviewed and declined.'
        });

        req.flash && req.flash('success', 'Refund request has been rejected.');
        return res.redirect('/managerefunds');
      });
    });
  }
};

module.exports = RefundController;
