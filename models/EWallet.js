const db = require('../db');

const EWallet = {
  // Get user's e-wallet balance
  getBalance: function(userId, callback) {
    const sql = 'SELECT ewallet_balance, points_balance FROM users WHERE userId = ?';
    db.query(sql, [userId], function(err, results) {
      if (err) return callback(err);
      if (!results || results.length === 0) return callback(null, { ewallet_balance: 0, points_balance: 0 });
      return callback(null, {
        ewallet_balance: results[0].ewallet_balance || 0,
        points_balance: results[0].points_balance || 0
      });
    });
  },

  // Add funds to e-wallet
  addFunds: function(userId, amount, paymentMethod, referenceId, callback) {
    const sql = 'UPDATE users SET ewallet_balance = ewallet_balance + ? WHERE userId = ?';
    db.query(sql, [amount, userId], function(err, result) {
      if (err) return callback(err);

      // Record transaction
      const txnSql = 'INSERT INTO ewallet_transactions (userId, amount, transactionType, paymentMethod, description, status, referenceId) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const description = `Top-up via ${paymentMethod}`;
      db.query(txnSql, [userId, amount, 'top_up', paymentMethod, description, 'completed', referenceId], function(txnErr, txnResult) {
        if (txnErr) console.error('Failed to record transaction:', txnErr);
        return callback(err, result);
      });
    });
  },

  // Deduct funds from e-wallet
  deductFunds: function(userId, amount, description, callback) {
    const sql = 'UPDATE users SET ewallet_balance = GREATEST(0, ewallet_balance - ?) WHERE userId = ?';
    db.query(sql, [amount, userId], function(err, result) {
      if (err) return callback(err);

      // Record transaction
      const txnSql = 'INSERT INTO ewallet_transactions (userId, amount, transactionType, description, status) VALUES (?, ?, ?, ?, ?)';
      db.query(txnSql, [userId, amount, 'deduction', description || 'E-wallet payment', 'completed'], function(txnErr) {
        if (txnErr) console.error('Failed to record transaction:', txnErr);
        return callback(err, result);
      });
    });
  },

  // Add points to user's account
  addPoints: function(userId, points, description, purchaseId, callback) {
    const sql = 'UPDATE users SET points_balance = points_balance + ? WHERE userId = ?';
    db.query(sql, [points, userId], function(err, result) {
      if (err) return callback(err);

      // Record points transaction
      const txnSql = 'INSERT INTO points_transactions (userId, pointsAmount, transactionType, description, purchaseId) VALUES (?, ?, ?, ?, ?)';
      db.query(txnSql, [userId, points, 'earned', description || 'Points earned from purchase', purchaseId || null], function(txnErr) {
        if (txnErr) console.error('Failed to record points transaction:', txnErr);

        // Auto-convert if user enabled preference and has >=100 points
        const selSql = 'SELECT points_balance, COALESCE(auto_convert_points, 0) as auto_convert_points FROM users WHERE userId = ?';
        db.query(selSql, [userId], function(selErr, rows) {
          if (selErr || !rows || rows.length === 0) return callback(err, result);
          const auto = Number(rows[0].auto_convert_points) === 1;
          const pbal = Number(rows[0].points_balance || 0);
          if (!auto || pbal < 100) return callback(err, result);

          // Convert largest multiple of 100
          const convertible = pbal - (pbal % 100);
          if (convertible <= 0) return callback(err, result);

          module.exports.convertPointsToCredit(userId, convertible, function(convErr) {
            if (convErr) console.error('Auto-convert points failed:', convErr);
            return callback(err, result);
          });
        });
      });
    });
  },

  // Spend points
  spendPoints: function(userId, points, description, callback) {
    const checkSql = 'SELECT points_balance FROM users WHERE userId = ?';
    db.query(checkSql, [userId], function(checkErr, results) {
      if (checkErr) return callback(checkErr);
      if (!results || results[0].points_balance < points) {
        return callback(new Error('Insufficient points'));
      }

      const sql = 'UPDATE users SET points_balance = GREATEST(0, points_balance - ?) WHERE userId = ?';
      db.query(sql, [points, userId], function(err, result) {
        if (err) return callback(err);

        // Record points transaction
        const txnSql = 'INSERT INTO points_transactions (userId, pointsAmount, transactionType, description) VALUES (?, ?, ?, ?)';
        db.query(txnSql, [userId, points, 'spent', description || 'Points used for purchase'], function(txnErr) {
          if (txnErr) console.error('Failed to record points transaction:', txnErr);
          return callback(err, result);
        });
      });
    });
  },

  // Get wallet transactions
  getTransactions: function(userId, limit = 20, callback) {
    const sql = 'SELECT * FROM ewallet_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?';
    db.query(sql, [userId, limit], function(err, results) {
      return callback(err, results || []);
    });
  },

  // Get points transactions
  getPointsTransactions: function(userId, limit = 20, callback) {
    const sql = 'SELECT * FROM points_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?';
    db.query(sql, [userId, limit], function(err, results) {
      return callback(err, results || []);
    });
  },

  // Convert points to store credit (100 points = $1)
  convertPointsToCredit: function(userId, points, callback) {
    // Check if user has enough points
    const checkSql = 'SELECT points_balance FROM users WHERE userId = ?';
    db.query(checkSql, [userId], function(checkErr, results) {
      if (checkErr) return callback(checkErr);
      if (!results || results[0].points_balance < points) {
        return callback(new Error('Insufficient points'));
      }

      // Convert: 100 points = $1.00
      const creditAmount = (points / 100).toFixed(2);

      // Deduct points and add store credit
      const updateSql = 'UPDATE users SET points_balance = points_balance - ?, store_credit = store_credit + ? WHERE userId = ?';
      db.query(updateSql, [points, creditAmount, userId], function(err, result) {
        if (err) return callback(err);

        // Record points transaction
        const txnSql = 'INSERT INTO points_transactions (userId, pointsAmount, transactionType, description) VALUES (?, ?, ?, ?)';
        db.query(txnSql, [userId, points, 'redeemed', `${points} points converted to $${creditAmount} store credit`], function(txnErr) {
          if (txnErr) console.error('Failed to record conversion:', txnErr);
          return callback(err, { creditAmount, pointsSpent: points });
        });
      });
    });
  },

  // Record pending top-up transaction
  createPendingTransaction: function(userId, amount, paymentMethod, referenceId, callback) {
    const sql = 'INSERT INTO ewallet_transactions (userId, amount, transactionType, paymentMethod, status, referenceId, description) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const description = `Pending top-up via ${paymentMethod}`;
    db.query(sql, [userId, amount, 'top_up', paymentMethod, 'pending', referenceId, description], function(err, result) {
      return callback(err, result);
    });
  },

  // Update transaction status
  updateTransactionStatus: function(transactionId, status, callback) {
    const sql = 'UPDATE ewallet_transactions SET status = ? WHERE transactionId = ?';
    db.query(sql, [status, transactionId], function(err, result) {
      return callback(err, result);
    });
  }
};

module.exports = EWallet;
