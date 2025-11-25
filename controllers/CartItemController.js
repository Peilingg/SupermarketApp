const CartItem = require('../models/CartItem');
const Product = require('../models/Product'); // optional, for future stock checks

function wantsJson(req) {
  return req.xhr || (req.headers.accept || '').includes('application/json');
}

const CartItemsController = {
  // GET /cart
  list(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const userId = sessionUser.userId;
    CartItem.listAll(userId, (err, cartItems) => {
      if (err) {
        console.error('CartItemsController.list', err);
        req.flash && req.flash('error', 'Failed to load cart');
        return res.status(500).render('cart', { cartItems: [], user: sessionUser, subtotal: 0 });
      }

      CartItem.subtotal(userId, (sErr, subtotal) => {
        if (sErr) {
          console.error('CartItemsController.list -> subtotal', sErr);
          subtotal = 0;
        }
        return res.render('cart', { cartItems: Array.isArray(cartItems) ? cartItems : [], user: sessionUser, subtotal });
      });
    });
  },

  // POST /cart/add/:id
  add(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) {
      if (wantsJson(req)) return res.status(401).json({ error: 'Not authenticated' });
      return res.redirect('/login');
    }

    const userId = sessionUser.userId;
    const productId = req.params.id || req.body.productId;
    const qty = Math.max(1, parseInt(req.body.quantity || req.query.quantity || 1, 10) || 1);

    if (!productId) {
      if (wantsJson(req)) return res.status(400).json({ error: 'Missing product id' });
      req.flash && req.flash('error', 'Missing product id');
      return res.redirect('/shopping');
    }

    CartItem.add(userId, productId, qty, (err, result) => {
      if (err) {
        console.error('CartItemsController.add', err);
        if (wantsJson(req)) return res.status(500).json({ error: 'Failed to add to cart' });
        req.flash && req.flash('error', 'Failed to add to cart');
        return res.redirect('/shopping');
      }
      if (wantsJson(req)) return res.json({ ok: true, added: true });
      req.flash && req.flash('success', 'Added to cart');
      return res.redirect('/cart');
    });
  },

  // POST /cart/update/:id
  update(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) {
      if (wantsJson(req)) return res.status(401).json({ error: 'Not authenticated' });
      return res.redirect('/login');
    }

    const cartItemsId = req.params.id || req.body.cart_itemsId;
    const qty = parseInt(req.body.quantity, 10);
    if (!cartItemsId || isNaN(qty) || qty < 0) {
      if (wantsJson(req)) return res.status(400).json({ error: 'Invalid input' });
      req.flash && req.flash('error', 'Invalid quantity');
      return res.redirect('/cart');
    }

    CartItem.updateQuantity(cartItemsId, qty, (err, updatedLine) => {
      if (err) {
        console.error('CartItemsController.update', err);
        if (wantsJson(req)) return res.status(500).json({ error: 'Failed to update quantity' });
        req.flash && req.flash('error', 'Failed to update cart');
        return res.redirect('/cart');
      }

      // recompute subtotal
      CartItem.subtotal(sessionUser.userId, (sErr, subtotal) => {
        if (sErr) {
          console.error('CartItemsController.update -> subtotal', sErr);
          subtotal = 0;
        }

        if (wantsJson(req)) {
          return res.json({
            cart_itemsId: cartItemsId,
            quantity: qty,
            lineTotal: updatedLine ? Number(updatedLine.lineTotal || 0) : 0,
            subtotal: Number(subtotal || 0)
          });
        }

        req.flash && req.flash('success', 'Cart updated');
        return res.redirect('/cart');
      });
    });
  },

  // POST /cart/remove/:id  OR POST form with productId in body
  remove(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) {
      if (wantsJson(req)) return res.status(401).json({ error: 'Not authenticated' });
      return res.redirect('/login');
    }

    const cartItemsId = req.params.id || null;
    const productId = req.body.productId || null;

    const done = (err, removedId) => {
      if (err) {
        console.error('CartItemsController.remove', err);
        if (wantsJson(req)) return res.status(500).json({ success: false, error: 'Failed to remove item' });
        req.flash && req.flash('error', 'Failed to remove item');
        return res.redirect('/cart');
      }

      CartItem.subtotal(sessionUser.userId, (sErr, subtotal) => {
        if (sErr) {
          console.error('CartItemsController.remove -> subtotal', sErr);
          subtotal = 0;
        }
        if (wantsJson(req)) return res.json({ removedId: removedId || productId, subtotal: Number(subtotal || 0) });
        req.flash && req.flash('success', 'Item removed');
        return res.redirect('/cart');
      });
    };

    if (cartItemsId) {
      return CartItem.remove(cartItemsId, (err, result) => done(err, cartItemsId));
    }

    if (productId) {
      return CartItem.removeByUserAndProduct(sessionUser.userId, productId, (err, result) => done(err, productId));
    }

    if (wantsJson(req)) return res.status(400).json({ error: 'Missing id to remove' });
    req.flash && req.flash('error', 'Missing id to remove');
    return res.redirect('/cart');
  },

  // POST /cart/clear
  clear(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) {
      if (wantsJson(req)) return res.status(401).json({ error: 'Not authenticated' });
      return res.redirect('/login');
    }

    CartItem.clear(sessionUser.userId, (err) => {
      if (err) {
        console.error('CartItemsController.clear', err);
        if (wantsJson(req)) return res.status(500).json({ success: false, error: 'Failed to clear cart' });
        req.flash && req.flash('error', 'Could not clear cart');
        return res.redirect('/cart');
      }

      if (wantsJson(req)) return res.json({ cleared: true, subtotal: 0 });
      req.flash && req.flash('success', 'Cart cleared');
      return res.redirect('/cart');
    });
  },

  // GET /cart/subtotal
  subtotal(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.status(401).json({ error: 'Not authenticated' });

    CartItem.subtotal(sessionUser.userId, (err, subtotal) => {
      if (err) {
        console.error('CartItemsController.subtotal', err);
        return res.status(500).json({ error: 'Failed to calculate subtotal' });
      }
      return res.json({ subtotal: Number(subtotal || 0) });
    });
  },

  // GET /cart/total
  total(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.status(401).json({ error: 'Not authenticated' });

    const taxRate = parseFloat(req.query.tax || req.body.tax || 0) || 0;
    const shipping = parseFloat(req.query.shipping || req.body.shipping || 0) || 0;

    CartItem.total(sessionUser.userId, taxRate, shipping, (err, totals) => {
      if (err) {
        console.error('CartItemsController.total', err);
        return res.status(500).json({ error: 'Failed to calculate total' });
      }
      return res.json(totals);
    });
  }
};

module.exports = CartItemsController;