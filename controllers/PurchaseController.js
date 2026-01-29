const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const CartItem = require('../models/CartItem');
const User = require('../models/User');

const PurchaseController = {
  // List current user's purchases
  listByUser: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    Purchase.listByUser(sessionUser.userId, function(err, purchases) {
      if (err) {
        console.error('PurchaseController.listByUser error:', err);
        req.flash && req.flash('error', 'Unable to load purchase history.');
        return res.render('purchaseHistory', { purchases: [], user: sessionUser });
      }
      return res.render('purchaseHistory', { purchases: purchases || [], user: sessionUser });
    });
  },

  // Show a detailed invoice for a specific purchase
  showInvoice: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const purchaseId = req.params.purchaseId || req.params.id;
    const isAdmin = sessionUser.role === 'admin';

    // If not admin, lock to current user
    Purchase.getWithItems(purchaseId, isAdmin ? null : sessionUser.userId, (err, purchase) => {
      if (err || !purchase) {
        console.error('PurchaseController.showInvoice error:', err);
        req.flash && req.flash('error', 'Invoice not found.');
        return res.redirect('/purchases');
      }

      User.getById(purchase.userId, (userErr, fullUser) => {
        const userToDisplay = fullUser || sessionUser;

        // Derive voucher info; fallback to parsing paymentDetails if columns are unavailable
        let voucherDiscount = Number(purchase.voucherDiscount || 0);
        let voucherCode = purchase.voucherCode || null;
        if ((!voucherCode || !voucherDiscount) && purchase.paymentDetails) {
          const match = purchase.paymentDetails.match(/Voucher\s+([A-Za-z0-9_-]+)\s*\(-\$([0-9]+(?:\.[0-9]{1,2})?)\)/i);
          if (match) {
            voucherCode = voucherCode || match[1];
            voucherDiscount = voucherDiscount || Number(match[2] || 0);
          }
        }

        const storeCreditUsed = Number(purchase.storeCreditUsed || 0);
        const ewalletUsed = Number(purchase.ewalletUsed || 0);

        // Base total after voucher but before any wallet/store-credit use
        const netTotal = Number((purchase.subtotal || 0) + (purchase.tax || 0) + (purchase.shipping || 0) - voucherDiscount);
        const paidViaGateway = Number(purchase.total || 0);
        const amountPaid = Math.max(0, paidViaGateway + storeCreditUsed + ewalletUsed);
        const balanceDue = Math.max(0, netTotal - amountPaid);
        const status = balanceDue > 0 ? 'Pending' : 'Completed';

        return res.render('invoice', {
          user: userToDisplay,
          items: purchase.items || [],
          subtotal: purchase.subtotal || 0,
          tax: purchase.tax || 0,
          shipping: purchase.shipping || 0,
          total: Math.max(0, purchase.total || 0),
          voucher: voucherCode ? { code: voucherCode } : null,
          voucherDiscount,
          storeCreditUsed,
          ewalletUsed,
          remainingStoreCredit: typeof userToDisplay.store_credit !== 'undefined' ? userToDisplay.store_credit : null,
          pointsEarned: null,
          invoice: true,
          paymentMethod: purchase.paymentMethod || 'Not specified',
          paymentDetails: purchase.paymentDetails || null,
          paymentMethods: ['Credit/Debit card', 'E-Wallet', 'PayPal', 'NETS QR'],
          orderId: purchase.purchaseId,
          generatedAt: purchase.created_at || new Date(),
          status,
          balanceDue,
          amountPaid
        });
      });
    });
  },

  // Admin: list all purchases
  listAll: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || sessionUser.role !== 'admin') return res.redirect('/login');

    Purchase.listAll(function(err, purchases) {
      if (err) {
        console.error('PurchaseController.listAll error:', err);
        req.flash && req.flash('error', 'Unable to load orders.');
        return res.render('manageOrders', { purchases: [], user: sessionUser });
      }
      return res.render('manageOrders', { purchases: purchases || [], user: sessionUser });
    });
  },

  // Reorder items from a past purchase -> adds items back to cart
  reorder: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const purchaseId = req.params.purchaseId || req.params.id;
    Purchase.getWithItems(purchaseId, sessionUser.userId, (err, purchase) => {
      if (err || !purchase) {
        req.flash && req.flash('error', 'Order not found.');
        return res.redirect('/purchases');
      }

      const items = Array.isArray(purchase.items) ? purchase.items.filter(it => it && it.productId && it.quantity > 0) : [];
      if (!items.length) {
        req.flash && req.flash('error', 'No reorderable items in this order.');
        return res.redirect('/purchases');
      }

      const addNext = (idx) => {
        if (idx >= items.length) {
          req.flash && req.flash('success', 'Items moved to your cart.');
          return res.redirect('/cart');
        }
        const it = items[idx];
        const qty = Number(it.quantity || 0);
        Product.decrementStock(it.productId, qty, (stockErr) => {
          if (stockErr) {
            req.flash && req.flash('error', 'Some items are out of stock and could not be reordered.');
            return res.redirect('/purchases');
          }
          CartItem.add(sessionUser.userId, it.productId, qty, (addErr) => {
            if (addErr) {
              // rollback stock for this item
              Product.incrementStock(it.productId, qty, () => {});
              req.flash && req.flash('error', 'Failed to add items to cart.');
              return res.redirect('/purchases');
            }
            addNext(idx + 1);
          });
        });
      };
      addNext(0);
    });
  }
};

module.exports = PurchaseController;
