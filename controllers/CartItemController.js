const CartItem = require('../models/CartItem');

const CartItemController = {
  // render cart page with items and subtotal
  listAll: function(req, res) {
    const sessionUser = req.session.user || null;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const userId = sessionUser.userId;
    CartItem.listAll(userId, (err, items) => {
      if (err) {
        console.error('CartItemController.listAll -', err);
        return res.status(500).render('cart', { items: [], subtotal: 0, error: 'Failed to load cart' });
      }

      CartItem.subtotal(userId, (err2, subtotal) => {
        if (err2) {
          console.error('CartItemController.subtotal -', err2);
          return res.status(500).render('cart', { items, subtotal: 0, error: 'Failed to calculate subtotal' });
        }

        return res.render('cart', { items, subtotal, error: null });
      });
    });
  },

  // add a product to user's cart (increments if exists)
  add: function(req, res) {
    const sessionUser = req.session.user || null;
    if (!sessionUser || !sessionUser.userId) return res.status(401).redirect('/login');

    const userId = sessionUser.userId;
    const productId = req.params.id || req.body.productId;
    const qty = parseInt(req.body.quantity || req.query.quantity || 1, 10) || 1;

    if (!productId) {
      return res.status(400).redirect('/shopping');
    }

    CartItem.add(userId, productId, qty, (err) => {
      if (err) {
        console.error('CartItemController.add -', err);
        // keep user on shopping page with an error message if flash present
        if (req.flash) { req.flash('error', 'Failed to add to cart'); }
        return res.redirect('/shopping');
      }
      return res.redirect('/cart');
    });
  },

  // update an existing cart item quantity
  update: function(req, res) {
    const cartItemsId = req.params.id || req.body.cart_itemsId;
    const qty = parseInt(req.body.quantity, 10);
    if (!cartItemsId || isNaN(qty)) return res.status(400).redirect('/cart');

    CartItem.update(cartItemsId, qty, (err) => {
      if (err) {
        console.error('CartItemController.update -', err);
        if (req.flash) req.flash('error', 'Failed to update cart');
      }
      return res.redirect('/cart');
    });
  },

  // remove a single cart item
  remove: function(req, res) {
    const cartItemsId = req.params.id || req.body.cart_itemsId;
    if (!cartItemsId) return res.status(400).redirect('/cart');

    CartItem.remove(cartItemsId, (err) => {
      if (err) {
        console.error('CartItemController.remove -', err);
        if (req.flash) req.flash('error', 'Failed to remove item');
      }
      return res.redirect('/cart');
    });
  },

  // clear all cart items for current user
  clear: function(req, res) {
    const sessionUser = req.session.user || null;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const userId = sessionUser.userId;
    CartItem.clear(userId, (err) => {
      if (err) {
        console.error('CartItemController.clear -', err);
        if (req.flash) req.flash('error', 'Failed to clear cart');
      }
      return res.redirect('/cart');
    });
  },

  // return subtotal as JSON (useful for AJAX)
  subtotal: function(req, res) {
    const sessionUser = req.session.user || null;
    if (!sessionUser || !sessionUser.userId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = sessionUser.userId;
    CartItem.subtotal(userId, (err, subtotal) => {
      if (err) {
        console.error('CartItemController.subtotal (api) -', err);
        return res.status(500).json({ error: 'Failed to calculate subtotal' });
      }
      return res.json({ subtotal });
    });
  }
};

module.exports = CartItemController;