const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const CartItem = require('../models/CartItem');

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
