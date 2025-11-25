const db = require('../db');

const CartItem = {
  listAll(userId, callback) {
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
    db.query(sql, [userId], callback);
  },

  getById(cartItemsId, callback) {
    const sql = `
      SELECT ci.cart_itemsId, ci.ProductId, ci.userId, ci.quantity, ci.created_at,
             p.productName, p.price, p.image
      FROM cart_items ci
      LEFT JOIN products p ON ci.ProductId = p.productId
      WHERE ci.cart_itemsId = ?
      LIMIT 1
    `;
    db.query(sql, [cartItemsId], (err, results) => {
      if (err) return callback(err);
      return callback(null, results && results[0] ? results[0] : null);
    });
  },

  // add product to cart (if exists increment quantity, otherwise insert)
  add(userId, productId, quantity = 1, callback) {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    // safe: check existing row first (works if no UNIQUE constraint)
    const findSql = 'SELECT cart_itemsId, quantity FROM cart_items WHERE userId = ? AND ProductId = ? LIMIT 1';
    db.query(findSql, [userId, productId], (err, rows) => {
      if (err) return callback(err);
      if (rows && rows.length) {
        const newQty = (rows[0].quantity || 0) + qty;
        const updateSql = 'UPDATE cart_items SET quantity = ?, created_at = NOW() WHERE cart_itemsId = ?';
        return db.query(updateSql, [newQty, rows[0].cart_itemsId], callback);
      }
      const insertSql = 'INSERT INTO cart_items (ProductId, userId, quantity, created_at) VALUES (?, ?, ?, NOW())';
      db.query(insertSql, [productId, userId, qty], callback);
    });
  },

  // update quantity by cart_itemsId and return the updated line (cart_itemsId, quantity, price, lineTotal)
  updateQuantity(cartItemsId, quantity, callback) {
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
        if (!rows || !rows.length) {
          return callback(null, { cart_itemsId, quantity: qty, price: 0, lineTotal: 0 });
        }
        return callback(null, rows[0]);
      });
    });
  },

  // remove by cart_itemsId
  remove(cartItemsId, callback) {
    const sql = 'DELETE FROM cart_items WHERE cart_itemsId = ?';
    db.query(sql, [cartItemsId], callback);
  },

  // remove by userId + productId
  removeByUserAndProduct(userId, productId, callback) {
    const sql = 'DELETE FROM cart_items WHERE userId = ? AND ProductId = ?';
    db.query(sql, [userId, productId], callback);
  },

  // remove multiple products by productId array for a user
  removeBulk(userId, productIds, callback) {
    if (!Array.isArray(productIds) || productIds.length === 0) return callback(null, { affectedRows: 0 });
    const placeholders = productIds.map(() => '?').join(',');
    const sql = `DELETE FROM cart_items WHERE userId = ? AND ProductId IN (${placeholders})`;
    db.query(sql, [userId, ...productIds], callback);
  },

  // clear all cart items for a user
  clear(userId, callback) {
    const sql = 'DELETE FROM cart_items WHERE userId = ?';
    db.query(sql, [userId], callback);
  },

  // subtotal = SUM(price * quantity)
  subtotal(userId, callback) {
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

  // total with optional taxRate (decimal) and optional shippingFee
  total(userId, taxRate = 0, shipping = 0, callback) {
    this.subtotal(userId, (err, subtotal) => {
      if (err) return callback(err);
      const tax = Number(subtotal) * Number(taxRate || 0);
      const total = Number(subtotal) + tax + Number(shipping || 0);
      return callback(null, { subtotal: Number(subtotal), tax: Number(tax), shipping: Number(shipping || 0), total: Number(total) });
    });
  }
};

module.exports = CartItem;