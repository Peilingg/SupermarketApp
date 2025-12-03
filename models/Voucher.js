const db = require('../db');

// Helper to enforce active window
function activeWhere() {
  return `(isActive = 1) AND (startDate IS NULL OR startDate <= NOW()) AND (endDate IS NULL OR endDate >= NOW())`;
}

const Voucher = {
  // Admin: list all vouchers
  getAll: function(callback) {
    const sql = `SELECT voucherId, code, description, discountType, discountValue, minSpend, startDate, endDate, isActive FROM vouchers ORDER BY voucherId DESC`;
    db.query(sql, [], (err, rows) => callback(err, rows || []));
  },

  // Admin: create voucher
  create: function(voucher, callback) {
    const sql = `
      INSERT INTO vouchers (code, description, discountType, discountValue, minSpend, startDate, endDate, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      voucher.code,
      voucher.description || '',
      voucher.discountType || 'amount',
      Number(voucher.discountValue || 0),
      Number(voucher.minSpend || 0),
      voucher.startDate || null,
      voucher.endDate || null,
      voucher.isActive ? 1 : 0
    ];
    db.query(sql, params, (err, result) => callback(err, result));
  },

  // Admin: update
  update: function(id, voucher, callback) {
    const sql = `
      UPDATE vouchers
      SET code = ?, description = ?, discountType = ?, discountValue = ?, minSpend = ?, startDate = ?, endDate = ?, isActive = ?
      WHERE voucherId = ?
    `;
    const params = [
      voucher.code,
      voucher.description || '',
      voucher.discountType || 'amount',
      Number(voucher.discountValue || 0),
      Number(voucher.minSpend || 0),
      voucher.startDate || null,
      voucher.endDate || null,
      voucher.isActive ? 1 : 0,
      id
    ];
    db.query(sql, params, (err, result) => callback(err, result));
  },

  // Admin: delete
  delete: function(id, callback) {
    db.query('DELETE FROM vouchers WHERE voucherId = ?', [id], (err, result) => callback(err, result));
  },

  // List claimable vouchers (active window) + claimed flag
  listClaimableForUser: function(userId, callback) {
    const sql = `
      SELECT v.*, uv.userVoucherId, uv.status
      FROM vouchers v
      LEFT JOIN user_vouchers uv ON uv.voucherId = v.voucherId AND uv.userId = ?
      WHERE ${activeWhere()}
      ORDER BY v.startDate IS NULL DESC, v.startDate ASC, v.voucherId DESC
    `;
    db.query(sql, [userId], (err, rows) => callback(err, rows || []));
  },

  // Claim voucher for user (if not already)
  claim: function(userId, voucherId, callback) {
    const checkSql = 'SELECT userVoucherId, status FROM user_vouchers WHERE userId = ? AND voucherId = ? LIMIT 1';
    db.query(checkSql, [userId, voucherId], (err, rows) => {
      if (err) return callback(err);
      if (rows && rows.length) return callback(new Error('Already claimed'));
      const insertSql = 'INSERT INTO user_vouchers (userId, voucherId, status, claimed_at) VALUES (?, ?, ?, NOW())';
      db.query(insertSql, [userId, voucherId, 'claimed'], (iErr, result) => callback(iErr, result));
    });
  },

  // List vouchers claimed by user
  listUserVouchers: function(userId, callback) {
    const sql = `
      SELECT uv.userVoucherId, uv.status, uv.claimed_at, uv.used_at,
             v.voucherId, v.code, v.description, v.discountType, v.discountValue, v.minSpend, v.startDate, v.endDate, v.isActive
      FROM user_vouchers uv
      LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
      WHERE uv.userId = ?
      ORDER BY uv.claimed_at DESC
    `;
    db.query(sql, [userId], (err, rows) => callback(err, rows || []));
  },

  // Find a claimed voucher by code for a user
  findUserVoucherByCode: function(userId, code, callback) {
    const sql = `
      SELECT uv.userVoucherId, uv.status, uv.claimed_at, uv.used_at,
             v.voucherId, v.code, v.description, v.discountType, v.discountValue, v.minSpend, v.startDate, v.endDate, v.isActive
      FROM user_vouchers uv
      LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
      WHERE uv.userId = ? AND v.code = ? LIMIT 1
    `;
    db.query(sql, [userId, code], (err, rows) => callback(err, rows && rows[0] ? rows[0] : null));
  },

  // Mark a user voucher as used
  markUsed: function(userVoucherId, callback) {
    const sql = 'UPDATE user_vouchers SET status = ?, used_at = NOW() WHERE userVoucherId = ?';
    db.query(sql, ['used', userVoucherId], (err, result) => callback(err, result));
  }
};

module.exports = Voucher;
