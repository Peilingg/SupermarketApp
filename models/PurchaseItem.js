const db = require('../db');

const PurchaseItem = {
  // Create a single purchase item row
  create(purchaseItem, callback) {
    const sql = `
      INSERT INTO purchase_items (purchaseId, productId, productName, price, quantity, lineTotal, image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      purchaseItem.purchaseId,
      purchaseItem.productId || null,
      purchaseItem.productName || 'Item',
      Number(purchaseItem.price || 0),
      Number(purchaseItem.quantity || 0),
      Number(purchaseItem.lineTotal || (purchaseItem.price * purchaseItem.quantity) || 0),
      purchaseItem.image || null
    ];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, result && result.insertId ? result.insertId : null);
    });
  },

  // List all items for a specific purchase
  listByPurchase(purchaseId, callback) {
    const sql = `
      SELECT purchaseItemId, purchaseId, productId, productName, price, quantity, lineTotal, image
      FROM purchase_items
      WHERE purchaseId = ?
      ORDER BY purchaseItemId ASC
    `;
    db.query(sql, [purchaseId], (err, rows) => callback(err, rows));
  },

  // Delete a specific purchase item row
  remove(purchaseItemId, callback) {
    const sql = `DELETE FROM purchase_items WHERE purchaseItemId = ?`;
    db.query(sql, [purchaseItemId], (err, result) => callback(err, result));
  }
};

module.exports = PurchaseItem;
