const db = require('../db');

const RefundRequest = {
  // Create a new refund request
  create: function(purchaseId, userId, reason, callback) {
    const sql = `
      INSERT INTO refund_requests (purchaseId, userId, reason, status, requested_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    const params = [purchaseId, userId, reason || null, 'pending'];
    db.query(sql, params, function(err, result) {
      return callback(err, result);
    });
  },

  // Get refund request by ID
  getById: function(refundRequestId, callback) {
    const sql = `
      SELECT
        rr.refundRequestId, rr.purchaseId, rr.userId, rr.reason, rr.status,
        rr.requested_at, rr.admin_notes, rr.processed_at,
        p.total as refund_amount,
        u.username, u.email
      FROM refund_requests rr
      JOIN purchases p ON rr.purchaseId = p.purchaseId
      JOIN users u ON rr.userId = u.userId
      WHERE rr.refundRequestId = ?
    `;
    db.query(sql, [refundRequestId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results[0] || null);
    });
  },

  // Get all refund requests for a user
  listByUser: function(userId, callback) {
    const sql = `
      SELECT
        rr.refundRequestId, rr.purchaseId, rr.userId, rr.reason, rr.status,
        rr.requested_at, rr.admin_notes, rr.processed_at,
        p.total as refund_amount, p.created_at as purchase_date
      FROM refund_requests rr
      JOIN purchases p ON rr.purchaseId = p.purchaseId
      WHERE rr.userId = ?
      ORDER BY rr.requested_at DESC
    `;
    db.query(sql, [userId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results || []);
    });
  },

  // Get all pending refund requests (admin)
  listAll: function(status, callback) {
    let sql = `
      SELECT
        rr.refundRequestId, rr.purchaseId, rr.userId, rr.reason, rr.status,
        rr.requested_at, rr.admin_notes, rr.processed_at,
        p.total as refund_amount, p.created_at as purchase_date,
        u.username, u.email
      FROM refund_requests rr
      JOIN purchases p ON rr.purchaseId = p.purchaseId
      JOIN users u ON rr.userId = u.userId
    `;
    const params = [];
    if (status && status !== 'all') {
      sql += ` WHERE rr.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY rr.requested_at DESC`;
    db.query(sql, params, function(err, results) {
      if (err) return callback(err);
      return callback(null, results || []);
    });
  },

  // Get refund request by purchaseId (check if already exists)
  getByPurchaseId: function(purchaseId, callback) {
    const sql = `
      SELECT
        rr.refundRequestId, rr.purchaseId, rr.userId, rr.reason, rr.status,
        rr.requested_at, rr.admin_notes, rr.processed_at,
        p.total as refund_amount
      FROM refund_requests rr
      JOIN purchases p ON rr.purchaseId = p.purchaseId
      WHERE rr.purchaseId = ?
      ORDER BY rr.requested_at DESC
      LIMIT 1
    `;
    db.query(sql, [purchaseId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results[0] || null);
    });
  },

  // Approve refund request (add store credit to user)
  approve: function(refundRequestId, adminNotes, callback) {
    // First, get the refund request and amount
    const getRefundSql = `
      SELECT rr.userId, p.total, rr.status
      FROM refund_requests rr
      JOIN purchases p ON rr.purchaseId = p.purchaseId
      WHERE rr.refundRequestId = ?
    `;
    db.query(getRefundSql, [refundRequestId], function(err, results) {
      if (err) return callback(err);
      if (!results || !results.length) return callback(new Error('Refund request not found'));
      if (results[0].status !== 'pending') return callback(new Error('Refund is not in pending status'));

      const userId = results[0].userId;
      const refundAmount = results[0].total;

      // Update refund request status to approved
      const updateRefundSql = `
        UPDATE refund_requests
        SET status = ?, admin_notes = ?, processed_at = NOW()
        WHERE refundRequestId = ?
      `;
      db.query(updateRefundSql, ['approved', adminNotes || null, refundRequestId], function(updateErr) {
        if (updateErr) return callback(updateErr);

        // Add store credit to user
        const addCreditSql = `
          UPDATE users
          SET store_credit = store_credit + ?
          WHERE userId = ?
        `;
        db.query(addCreditSql, [refundAmount, userId], function(creditErr) {
          if (creditErr) return callback(creditErr);
          return callback(null, { refundRequestId, userId, refundAmount });
        });
      });
    });
  },

  // Reject refund request
  reject: function(refundRequestId, adminNotes, callback) {
    const sql = `
      UPDATE refund_requests
      SET status = ?, admin_notes = ?, processed_at = NOW()
      WHERE refundRequestId = ?
    `;
    db.query(sql, ['rejected', adminNotes || null, refundRequestId], function(err, result) {
      return callback(err, result);
    });
  },

  // Check if a refund request already exists for a purchase
  existsForPurchase: function(purchaseId, callback) {
    const sql = `
      SELECT COUNT(*) as count FROM refund_requests
      WHERE purchaseId = ? AND status IN ('pending', 'approved')
    `;
    db.query(sql, [purchaseId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results[0].count > 0);
    });
  }
};

module.exports = RefundRequest;
