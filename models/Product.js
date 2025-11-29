const db = require('../db');

const Product = {
    getAll: function(callback) {
        const sql = 'SELECT productId, productName, quantity, price, image, category FROM products';
        db.query(sql, function(err, results) { return callback(err, results); });
    },

    getById: function(id, callback) {
        const sql = 'SELECT productId, productName, quantity, price, image, category FROM products WHERE productId = ?';
        db.query(sql, [id], function(err, results) { if (err) return callback(err); return callback(null, results[0] || null); });
    },

    // decrease stock if enough quantity exists
    decrementStock: function(productId, qty, callback) {
        const sql = 'UPDATE products SET quantity = quantity - ? WHERE productId = ? AND quantity >= ?';
        db.query(sql, [qty, productId, qty], function(err, result) {
            if (err) return callback(err);
            if (!result || result.affectedRows === 0) return callback(new Error('Insufficient stock'));
            return callback(null, result);
        });
    },

    // increase stock (used when cart quantities are reduced/removed)
    incrementStock: function(productId, qty, callback) {
        const sql = 'UPDATE products SET quantity = quantity + ? WHERE productId = ?';
        db.query(sql, [qty, productId], function(err, result) {
            if (err) return callback(err);
            return callback(null, result);
        });
    },

    add: function(product, callback) {
        const sql = 'INSERT INTO products (productName, quantity, price, image, category) VALUES (?, ?, ?, ?, ?)';
        const params = [product.productName, product.quantity, product.price, product.image, product.category || null];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    update: function(id, product, callback) {
        const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ?, category = ? WHERE productId = ?';
        const params = [product.productName, product.quantity, product.price, product.image, product.category || null, id];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    delete: function(id, callback) {
        const sql = 'DELETE FROM products WHERE productId = ?';
        db.query(sql, [id], function(err, result) { return callback(err, result); });
    }
};

module.exports = Product;
