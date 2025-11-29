const db = require('../db');

const Purchase = {
  // Record a purchase with its items
  record: function(userId, summary, items, callback) {
    const insertPurchaseSql = `
      INSERT INTO purchases (userId, subtotal, tax, shipping, total, paymentMethod, paymentDetails, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    const purchaseParams = [
      userId,
      Number(summary.subtotal || 0),
      Number(summary.tax || 0),
      Number(summary.shipping || 0),
      Number(summary.total || 0),
      summary.paymentMethod || null,
      summary.paymentDetails || null
    ];

    db.query(insertPurchaseSql, purchaseParams, function(err, result) {
      if (err) return callback(err);
      const purchaseId = result && result.insertId ? result.insertId : null;
      if (!items || !items.length) return callback(null, purchaseId);

      const insertItemSql = `
        INSERT INTO purchase_items (purchaseId, productId, productName, price, quantity, lineTotal, image)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      let pending = items.length;
      let firstErr = null;

      items.forEach((it) => {
        const lineTotal = Number(it.lineTotal || (it.price * it.quantity) || 0);
        const params = [
          purchaseId,
          it.productId || it.id || null,
          it.productName || it.name || 'Item',
          Number(it.price || 0),
          Number(it.quantity || 0),
          lineTotal,
          it.image || null
        ];
        db.query(insertItemSql, params, function(itemErr) {
          if (itemErr && !firstErr) firstErr = itemErr;
          pending -= 1;
          if (pending === 0) return callback(firstErr, purchaseId);
        });
      });
    });
  },

  // List purchases (with items) for a user
  listByUser: function(userId, callback) {
    const sql = `
      SELECT
        p.purchaseId, p.userId, p.subtotal, p.tax, p.shipping, p.total,
        p.paymentMethod, p.paymentDetails, p.created_at,
        pi.purchaseItemId, pi.productId, pi.productName, pi.price, pi.quantity, pi.lineTotal, pi.image
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.purchaseId = pi.purchaseId
      WHERE p.userId = ?
      ORDER BY p.created_at DESC, pi.purchaseItemId ASC
    `;
    db.query(sql, [userId], function(err, rows) {
      if (err) return callback(err);
      const grouped = {};
      rows.forEach((r) => {
        const id = r.purchaseId;
        if (!grouped[id]) {
          grouped[id] = {
            purchaseId: id,
            userId: r.userId,
            subtotal: Number(r.subtotal || 0),
            tax: Number(r.tax || 0),
            shipping: Number(r.shipping || 0),
            total: Number(r.total || 0),
            paymentMethod: r.paymentMethod,
            paymentDetails: r.paymentDetails,
            created_at: r.created_at,
            items: []
          };
        }
        if (r.purchaseItemId) {
          grouped[id].items.push({
            purchaseItemId: r.purchaseItemId,
            productId: r.productId,
            productName: r.productName,
            price: Number(r.price || 0),
            quantity: Number(r.quantity || 0),
            lineTotal: Number(r.lineTotal || 0),
            image: r.image
          });
        }
      });
      return callback(null, Object.values(grouped));
    });
  },

  // List all purchases with user info (admin)
  listAll: function(callback) {
    const sql = `
      SELECT
        p.purchaseId, p.userId, p.subtotal, p.tax, p.shipping, p.total,
        p.paymentMethod, p.paymentDetails, p.created_at,
        u.username, u.email,
        pi.purchaseItemId, pi.productId, pi.productName, pi.price, pi.quantity, pi.lineTotal, pi.image
      FROM purchases p
      LEFT JOIN users u ON p.userId = u.userId
      LEFT JOIN purchase_items pi ON p.purchaseId = pi.purchaseId
      ORDER BY p.created_at DESC, pi.purchaseItemId ASC
    `;
    db.query(sql, [], function(err, rows) {
      if (err) return callback(err);
      const grouped = {};
      rows.forEach((r) => {
        const id = r.purchaseId;
        if (!grouped[id]) {
          grouped[id] = {
            purchaseId: id,
            userId: r.userId,
            username: r.username,
            email: r.email,
            subtotal: Number(r.subtotal || 0),
            tax: Number(r.tax || 0),
            shipping: Number(r.shipping || 0),
            total: Number(r.total || 0),
            paymentMethod: r.paymentMethod,
            paymentDetails: r.paymentDetails,
            created_at: r.created_at,
            items: []
          };
        }
        if (r.purchaseItemId) {
          grouped[id].items.push({
            purchaseItemId: r.purchaseItemId,
            productId: r.productId,
            productName: r.productName,
            price: Number(r.price || 0),
            quantity: Number(r.quantity || 0),
            lineTotal: Number(r.lineTotal || 0),
            image: r.image
          });
        }
      });
      return callback(null, Object.values(grouped));
    });
  }
};

module.exports = Purchase;
