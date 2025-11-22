const db = require('../db');

const Product = {
    getAll: function(callback) {
        const sql = 'SELECT ProductId, productName, quantity, price, image FROM products';
        db.query(sql, function(err, results) { return callback(err, results); });
    },

    getById: function(id, callback) {
        const sql = 'SELECT ProductId, productName, quantity, price, image FROM products WHERE ProductId = ?';
        db.query(sql, [id], function(err, results) { if (err) return callback(err); return callback(null, results[0] || null); });
    },

    add: function(product, callback) {
        const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
        const params = [product.productName, product.quantity, product.price, product.image];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    update: function(id, product, callback) {
        const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE ProductId = ?';
        const params = [product.productName, product.quantity, product.price, product.image, id];
        db.query(sql, params, function(err, result) { return callback(err, result); });
    },

    delete: function(id, callback) {
        const sql = 'DELETE FROM products WHERE ProductId = ?';
        db.query(sql, [id], function(err, result) { return callback(err, result); });
    }
};

module.exports = Product;