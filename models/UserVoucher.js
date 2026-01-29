const db = require('../db');

const UserVoucher = {
  // Create claim record if not exists
  claim: function(userId, voucherId, callback) {
    const checkSql = 'SELECT userVoucherId FROM user_vouchers WHERE userId = ? AND voucherId = ? LIMIT 1';
    db.query(checkSql, [userId, voucherId], (err, rows) => {
      if (err) return callback(err);
      if (rows && rows.length) return callback(new Error('Already claimed'));
      const insertSql = 'INSERT INTO user_vouchers (userId, voucherId, status, claimed_at) VALUES (?, ?, ?, NOW())';
      db.query(insertSql, [userId, voucherId, 'claimed'], (iErr, result) => callback(iErr, result));
    });
  },

  // List vouchers claimed by a user
  listByUser: function(userId, callback) {
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

  // Fetch a claimed voucher by code for a user
  findByCode: function(userId, code, callback) {
    const sql = `
      SELECT uv.userVoucherId, uv.status, uv.claimed_at, uv.used_at,
             v.voucherId, v.code, v.description, v.discountType, v.discountValue, v.minSpend, v.startDate, v.endDate, v.isActive
      FROM user_vouchers uv
      LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
      WHERE uv.userId = ? AND v.code = ? LIMIT 1
    `;
    db.query(sql, [userId, code], (err, rows) => callback(err, rows && rows[0] ? rows[0] : null));
  },

  // Mark used (keep status as 'claimed' so voucher can be reused)
  markUsed: function(userVoucherId, callback) {
    db.query('UPDATE user_vouchers SET used_at = NOW() WHERE userVoucherId = ?', [userVoucherId], (err, result) => callback(err, result));
  }
};

module.exports = UserVoucher;
