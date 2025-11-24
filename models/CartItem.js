const db = require('../db');

const CartItem = {
  // list all cart items for a user (includes product details)
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

  // add a product to cart (increments quantity if entry exists)
  add: function(userId, productId, quantity = 1, callback) {
    const qty = parseInt(quantity, 10) || 1;
    const findSql = 'SELECT cart_itemsId, quantity FROM cart_items WHERE userId = ? AND ProductId = ? LIMIT 1';
    db.query(findSql, [userId, productId], (err, rows) => {
      if (err) return callback(err);
      if (rows && rows.length) {
        const newQty = (rows[0].quantity || 0) + qty;
        const updateSql = 'UPDATE cart_items SET quantity = ?, created_at = NOW() WHERE cart_itemsId = ?';
        return db.query(updateSql, [newQty, rows[0].cart_itemsId], (uErr, result) => callback(uErr, result));
      } else {
        const insertSql = 'INSERT INTO cart_items (ProductId, userId, quantity, created_at) VALUES (?, ?, ?, NOW())';
        return db.query(insertSql, [productId, userId, qty], (iErr, result) => callback(iErr, result));
      }
    });
  },

  // update quantity for a given cart_itemsId and return updated line total
  updateQuantity: function(cartItemsId, quantity, callback) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) return callback(new Error('Invalid quantity'));

    const sql = 'UPDATE cart_items SET quantity = ? WHERE cart_itemsId = ?';
    db.query(sql, [qty, cartItemsId], (err) => {
      if (err) return callback(err);

      const fetchSql = `
        SELECT ci.cart_itemsId, ci.quantity, p.price, (p.price * ci.quantity) AS lineTotal
        FROM cart_items ci
        LEFT JOIN products p ON ci.ProductId = p.productId
        WHERE ci.cart_itemsId = ?
        LIMIT 1
      `;
      db.query(fetchSql, [cartItemsId], (fErr, rows) => {
        if (fErr) return callback(fErr);
        // always return a safe object (avoid undefined)
        if (!rows || !rows.length) {
          return callback(null, { cart_itemsId, quantity: qty, price: 0, lineTotal: 0 });
        }
        return callback(null, rows[0]);
      });
    });
  },

  // remove a single cart item by id
  remove: function(cartItemsId, callback) {
    const sql = 'DELETE FROM cart_items WHERE cart_itemsId = ?';
    db.query(sql, [cartItemsId], (err, result) => callback(err, result));
  },

  // clear all cart items for a user
  clear: function(userId, callback) {
    const sql = 'DELETE FROM cart_items WHERE userId = ?';
    db.query(sql, [userId], (err, result) => callback(err, result));
  },

  // calculate subtotal (sum price * quantity) for a user's cart
  subtotal: function(userId, callback) {
    const sql = `
      SELECT COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal
      FROM cart_items ci
      LEFT JOIN products p ON ci.ProductId = p.productId
      WHERE ci.userId = ?
    `;
    db.query(sql, [userId], (err, results) => {
      if (err) return callback(err);
      const subtotal = results && results[0] ? Number(results[0].subtotal) : 0;
      return callback(null, subtotal);
    });
  },

  // calculate total with optional tax or fee (taxRate as decimal, e.g. 0.07)
  total: function(userId, taxRate = 0, callback) {
    this.subtotal(userId, (err, subtotal) => {
      if (err) return callback(err);
      const tax = Number(subtotal) * Number(taxRate || 0);
      const total = Number(subtotal) + tax;
      return callback(null, { subtotal: Number(subtotal), tax: Number(tax), total: Number(total) });
    });
  }
};

module.exports = CartItem;