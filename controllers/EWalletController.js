const EWallet = require('../models/EWallet');
const User = require('../models/User');

const EWalletController = {
  // View e-wallet dashboard
  viewWallet: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    User.getById(sessionUser.userId, (userErr, user) => {
      if (userErr || !user) {
        req.flash && req.flash('error', 'Failed to load wallet data');
        return res.render('ewallet', { 
          user: sessionUser, 
          ewallet_balance: 0, 
          points_balance: 0,
          store_credit: 0,
          auto_convert_points: 0,
          lastTopupMethod: '—',
          lastTopupDate: null,
          transactions: [],
          pointsTransactions: [],
          conversionRate: 100
        });
      }

        EWallet.getTransactions(sessionUser.userId, 50, (txnErr, transactions) => {
          const txns = transactions || [];
          // Find the most recent completed top-up (already sorted DESC by DB)
          const lastTopup = txns.find(t => t && t.transactionType === 'top_up' && t.status === 'completed');
          const lastTopupMethod = lastTopup ? (lastTopup.paymentMethod || 'Top-up') : '—';
          const lastTopupDate = lastTopup ? lastTopup.createdAt : null;

          EWallet.getPointsTransactions(sessionUser.userId, 50, (ptxnErr, pointsTransactions) => {
            return res.render('ewallet', {
              user: user,
              ewallet_balance: user.ewallet_balance || 0,
              points_balance: user.points_balance || 0,
              store_credit: user.store_credit || 0,
              auto_convert_points: user.auto_convert_points || 0,
              lastTopupMethod: lastTopupMethod,
              lastTopupDate: lastTopupDate,
              transactions: txns,
              pointsTransactions: pointsTransactions || [],
              conversionRate: 100 // 100 points = $1
            });
          });
        });
    });
  },

  // Show top-up form
  showTopup: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    User.getById(sessionUser.userId, (userErr, user) => {
      const paymentMethods = ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'E-Wallet', 'PayPal'];
      
      return res.render('topupWallet', {
        user: user || sessionUser,
        paymentMethods,
        ewallet_balance: (user && user.ewallet_balance) || 0
      });
    });
  },

  // Process top-up payment
  processTopup: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const paymentMethod = req.body.paymentMethod || 'Credit/Debit card';
    const topupAmount = parseFloat(req.body.topupAmount || 0);

    if (!topupAmount || topupAmount <= 0) {
      req.flash && req.flash('error', 'Please enter a valid amount');
      return res.redirect('/ewallet/topup');
    }

    if (topupAmount > 10000) {
      req.flash && req.flash('error', 'Maximum top-up amount is $10,000');
      return res.redirect('/ewallet/topup');
    }

    // Store topup data in session
    req.session.topupData = {
      userId: sessionUser.userId,
      amount: topupAmount,
      paymentMethod: paymentMethod,
      timestamp: new Date()
    };

    // Redirect to payment method handler
    if (paymentMethod === 'PayPal') {
      return res.redirect('/ewallet/topup/paypal');
    } else {
      // For other payment methods, create transaction record and show confirmation
      EWallet.createPendingTransaction(sessionUser.userId, topupAmount, paymentMethod, `TOPUP-${Date.now()}`, (err, txnResult) => {
        if (err) {
          console.error('Failed to create transaction:', err);
          req.flash && req.flash('error', 'Failed to process top-up');
          return res.redirect('/ewallet/topup');
        }

        req.session.transactionId = txnResult.insertId;
        res.render('topupConfirmation', {
          user: sessionUser,
          amount: topupAmount,
          paymentMethod: paymentMethod,
          transactionId: txnResult.insertId
        });
      });
    }
  },

  // Confirm top-up (after payment)
  confirmTopup: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const transactionId = req.body.transactionId;
    const topupAmount = req.body.topupAmount;

    if (!transactionId || !topupAmount) {
      req.flash && req.flash('error', 'Invalid top-up request');
      return res.redirect('/ewallet');
    }

    // Add funds to wallet
    EWallet.addFunds(sessionUser.userId, parseFloat(topupAmount), 'Manual Confirmation', transactionId, (err, result) => {
      if (err) {
        console.error('Failed to add funds:', err);
        req.flash && req.flash('error', 'Failed to complete top-up');
        return res.redirect('/ewallet');
      }

      req.flash && req.flash('success', `Successfully topped up $${parseFloat(topupAmount).toFixed(2)} to your e-wallet`);
      return res.redirect('/ewallet');
    });
  },

  // Convert points to store credit
  convertPoints: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const pointsToConvert = parseInt(req.body.pointsAmount || 0);

    if (!pointsToConvert || pointsToConvert <= 0) {
      req.flash && req.flash('error', 'Please enter valid points amount');
      return res.redirect('/ewallet');
    }

    if (pointsToConvert % 100 !== 0) {
      req.flash && req.flash('error', 'Points must be in multiples of 100');
      return res.redirect('/ewallet');
    }

    EWallet.convertPointsToCredit(sessionUser.userId, pointsToConvert, (err, result) => {
      if (err) {
        console.error('Conversion error:', err);
        req.flash && req.flash('error', err.message || 'Failed to convert points');
        return res.redirect('/ewallet');
      }

      req.flash && req.flash('success', `Successfully converted ${pointsToConvert} points to $${result.creditAmount} store credit`);
      return res.redirect('/ewallet');
    });
  },

  // Toggle auto-convert points preference
  toggleAutoConvert: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const enabled = (req.body && (req.body.enabled === 'true' || req.body.enabled === 'on' || req.body.enabled === '1')) ? 1 : 0;
    const sql = 'UPDATE users SET auto_convert_points = ? WHERE userId = ?';
    require('../db').query(sql, [enabled, sessionUser.userId], (err) => {
      if (err) {
        console.error('Failed to update auto-convert preference:', err);
        req.flash && req.flash('error', 'Could not update preference');
      } else {
        req.flash && req.flash('success', `Auto-convert points ${enabled ? 'enabled' : 'disabled'}`);
      }
      return res.redirect('/ewallet');
    });
  }
};

module.exports = EWalletController;
