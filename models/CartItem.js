const db = require('../db');

const CartItem = {
  // list all cart items for a user (includes product data)
  listAll: function(userId, callback) {
    const sql = `
      SELECT
        ci.cart_itemsId,
        ci.ProductId,
        ci.userId,
        ci.quantity,
        ci.created_at,
        p.productName,
        p.price,
        p.image
      FROM cart_items ci
      LEFT JOIN products p ON ci.ProductId = p.productId
      WHERE ci.userId = ?
      ORDER BY ci.created_at DESC
    `;
    db.query(sql, [userId], (err, results) => callback(err, results));
  },

  // add product to cart (increments quantity if same user+product exists)
  // requires a UNIQUE(userId, ProductId) index in DB for ON DUPLICATE KEY to work
  add: function(userId, productId, quantity = 1, callback) {
    const qty = parseInt(quantity, 10) || 1;
    const sql = `
      INSERT INTO cart_items (ProductId, userId, quantity, created_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), created_at = NOW()
    `;
    db.query(sql, [productId, userId, qty], (err, result) => callback(err, result));
  },

  // update cart item quantity by cart_itemsId
  update: function(cartItemsId, quantity, callback) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) return callback(new Error('Invalid quantity'));
    const sql = 'UPDATE cart_items SET quantity = ? WHERE cart_itemsId = ?';
    db.query(sql, [qty, cartItemsId], (err, result) => callback(err, result));
  },

  // remove single cart item by id
  remove: function(cartItemsId, callback) {
    const sql = 'DELETE FROM cart_items WHERE cart_itemsId = ?';
    db.query(sql, [cartItemsId], (err, result) => callback(err, result));
  },

  // clear all cart items for a user
  clear: function(userId, callback) {
    const sql = 'DELETE FROM cart_items WHERE userId = ?';
    db.query(sql, [userId], (err, result) => callback(err, result));
  },

  // calculate subtotal (sum of price * quantity) for a user's cart
  subtotal: function(userId, callback) {
    const sql = `
      SELECT COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal
      FROM cart_items ci
      LEFT JOIN products p ON ci.ProductId = p.productId
      WHERE ci.userId = ?
    `;
    db.query(sql, [userId], (err, results) => {
      if (err) return callback(err);
      const subtotal = (results && results[0] && results[0].subtotal) ? Number(results[0].subtotal) : 0;
      return callback(null, subtotal);
    });
  }
};

module.exports = CartItem;