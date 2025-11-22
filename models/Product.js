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

    add: function(product, callback) {
        const sql = 'INSERT INTO products (productName, quantity, price, image, category) VALUES (?, ?, ?, ?, ?)';
        const params = [product.productName, product.quantity, product.price, product.image, product.category];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    update: function(id, product, callback) {
        const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ?, category = ? WHERE productId = ?';
        const params = [product.productName, product.quantity, product.price, product.image, product.category, id];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    delete: function(id, callback) {
        const sql = 'DELETE FROM products WHERE productId = ?';
        db.query(sql, [id], function(err, result) { return callback(err, result); });
    }
};

module.exports = Product;