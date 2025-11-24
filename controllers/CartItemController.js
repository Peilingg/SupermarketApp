const CartItem = require('../models/CartItem');

function wantsJson(req) {
  return req.xhr || (req.headers.accept || '').includes('application/json');
}

const CartItemController = {
  // GET /cart
  listAll: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const userId = sessionUser.userId;
    CartItem.listAll(userId, (err, items) => {
      if (err) {
        console.error('CartItemController.listAll', err);
        return res.status(500).render('cart', { items: [], subtotal: 0, error: 'Failed to load cart', cartItems: [] });
      }

      // remove any undefined/null entries before rendering
      items = Array.isArray(items) ? items.filter(Boolean) : [];

      CartItem.subtotal(userId, (sErr, subtotal) => {
        if (sErr) {
          console.error('CartItemController.subtotal', sErr);
          subtotal = 0;
        }
        return res.render('cart', { items: items, subtotal: subtotal || 0, error: null, cartItems: items });
      });
    });
  },

  // POST /cart/add/:id
  add: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) {
      if (wantsJson(req)) return res.status(401).json({ error: 'Not authenticated' });
      return res.redirect('/login');
    }

    const userId = sessionUser.userId;
    const productId = req.params.id || req.body.productId;
    const qty = parseInt(req.body.quantity || req.query.quantity || 1, 10) || 1;

    if (!productId) {
      if (wantsJson(req)) return res.status(400).json({ error: 'Missing product id' });
      return res.redirect('/shopping');
    }

    CartItem.add(userId, productId, qty, (err) => {
      if (err) {
        console.error('CartItemController.add', err);
        if (wantsJson(req)) return res.status(500).json({ error: 'Failed to add to cart' });
        return res.redirect('/shopping');
      }
      if (wantsJson(req)) return res.json({ ok: true, redirect: '/cart' });
      return res.redirect('/cart');
    });
  },

  // POST /cart/update/:id
  update: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return wantsJson(req) ? res.status(401).json({ error: 'Not authenticated' }) : res.redirect('/login');

    const cartItemsId = req.params.id || req.body.cart_itemsId;
    const qty = parseInt(req.body.quantity, 10);
    if (!cartItemsId || isNaN(qty) || qty < 0) {
      if (wantsJson(req)) return res.status(400).json({ error: 'Invalid input' });
      return res.redirect('/cart');
    }

    CartItem.updateQuantity(cartItemsId, qty, (err, updatedLine) => {
      if (err) {
        console.error('CartItemController.update', err);
        if (wantsJson(req)) return res.status(500).json({ error: 'Failed to update' });
        return res.redirect('/cart');
      }

      // recompute subtotal and return JSON for AJAX or redirect
      CartItem.subtotal(sessionUser.userId, (sErr, subtotal) => {
        if (sErr) {
          console.error('CartItemController.update -> subtotal', sErr);
          subtotal = 0;
        }

        if (wantsJson(req)) {
          return res.json({
            cart_itemsId: cartItemsId,
            quantity: qty,
            lineTotal: updatedLine ? Number(updatedLine.lineTotal || (updatedLine.price * updatedLine.quantity)) : 0,
            subtotal: Number(subtotal || 0)
          });
        }
        return res.redirect('/cart');
      });
    });
  },

  // POST /cart/remove/:id
  remove: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return wantsJson(req) ? res.status(401).json({ error: 'Not authenticated' }) : res.redirect('/login');

    const cartItemsId = req.params.id || req.body.cart_itemsId;
    if (!cartItemsId) {
      if (wantsJson(req)) return res.status(400).json({ error: 'Invalid input' });
      return res.redirect('/cart');
    }

    CartItem.remove(cartItemsId, (err) => {
      if (err) {
        console.error('CartItemController.remove', err);
        if (wantsJson(req)) return res.status(500).json({ error: 'Failed to remove item' });
        return res.redirect('/cart');
      }

      // recompute subtotal
      CartItem.subtotal(sessionUser.userId, (sErr, subtotal) => {
        if (sErr) {
          console.error('CartItemController.remove -> subtotal', sErr);
          subtotal = 0;
        }
        if (wantsJson(req)) return res.json({ removedId: cartItemsId, subtotal: Number(subtotal || 0) });
        return res.redirect('/cart');
      });
    });
  },

  // POST /cart/clear
  clear: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return wantsJson(req) ? res.status(401).json({ error: 'Not authenticated' }) : res.redirect('/login');

    CartItem.clear(sessionUser.userId, (err) => {
      if (err) {
        console.error('CartItemController.clear', err);
        if (wantsJson(req)) return res.status(500).json({ error: 'Failed to clear cart' });
        return res.redirect('/cart');
      }
      if (wantsJson(req)) return res.json({ cleared: true, subtotal: 0 });
      return res.redirect('/cart');
    });
  },

  // GET /cart/subtotal  (returns JSON)
  subtotal: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.status(401).json({ error: 'Not authenticated' });

    CartItem.subtotal(sessionUser.userId, (err, subtotal) => {
      if (err) {
        console.error('CartItemController.subtotal', err);
        return res.status(500).json({ error: 'Failed to calculate subtotal' });
      }
      return res.json({ subtotal: Number(subtotal || 0) });
    });
  },

  // GET /cart/total?tax=0.07  (returns JSON with subtotal/tax/total)
  total: function (req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.status(401).json({ error: 'Not authenticated' });

    const taxRate = parseFloat(req.query.tax || req.body.tax || 0) || 0;
    CartItem.total(sessionUser.userId, taxRate, (err, totals) => {
      if (err) {
        console.error('CartItemController.total', err);
        return res.status(500).json({ error: 'Failed to calculate total' });
      }
      return res.json(totals);
    });
  }
};

module.exports = CartItemController;