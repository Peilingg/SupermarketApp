const Purchase = require('../models/Purchase');

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
  }
};

module.exports = PurchaseController;
