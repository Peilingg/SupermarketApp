const db = require('../db');

const User = {
    // get all users (omit passwords in list)
    getAll: function(callback) {
        const sql = 'SELECT userId, username, email, address, contact, role FROM users';
        db.query(sql, function(err, results) { return callback(err, results); });
    },

    // get a user by id (omit password)
    getById: function(id, callback) {
        const sql = 'SELECT userId, username, email, address, contact, role FROM users WHERE userId = ?';
        db.query(sql, [id], function(err, results) { if (err) return callback(err); return callback(null, results[0] || null); });
    },

    // authenticate user (email + plain password) -> returns full user row if ok (includes role & id)
    authenticate: function(email, password, callback) {
        const sql = 'SELECT userId, username, email, address, contact, role FROM users WHERE email = ? AND password = SHA1(?)';
        db.query(sql, [email, password], function(err, results) { if (err) return callback(err); return callback(null, results[0] || null); });
    },

    // add a new user
    add: function(user, callback) {
        const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
        const params = [ user.username, user.email, user.password, user.address || null, user.contact || null, user.role || 'user' ];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    // update an existing user by id
    update: function(id, user, callback) {
        const sql = user.password
            ? 'UPDATE users SET username = ?, email = ?, password = SHA1(?), address = ?, contact = ?, role = ? WHERE userId = ?'
            : 'UPDATE users SET username = ?, email = ?, address = ?, contact = ?, role = ? WHERE userId = ?';

        const params = user.password
            ? [user.username, user.email, user.password, user.address || null, user.contact || null, user.role || 'user', id]
            : [user.username, user.email, user.address || null, user.contact || null, user.role || 'user', id];

        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    // delete a user by id
    delete: function(id, callback) {
        const sql = 'DELETE FROM users WHERE userId = ?';
        db.query(sql, [id], function(err, result) { return callback(err, result); });
    },

    // get products created/owned by a specific user
    getProducts: function(userId, callback) {
        const sql = 'SELECT productId, productName, quantity, price, image, category, userId FROM products WHERE userId = ?';
        db.query(sql, [userId], function(err, results) { return callback(err, results); });
    },

    // check whether a user can manage products
    canManageProducts: function(userId, callback) {
        const sql = 'SELECT role FROM users WHERE userId = ?';
        db.query(sql, [userId], function(err, results) {
            if (err) return callback(err);
            const row = results[0];
            if (!row) return callback(null, false);
            return callback(null, row.role === 'admin');
        });
    }
};

module.exports = User;