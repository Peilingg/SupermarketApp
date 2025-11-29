// ...existing code...
const db = require('../db');

const Favourite = {
  // list all favourite items
  getAll: function(callback) {
    const sql = 'SELECT * FROM favourites';
    db.query(sql, function(err, results) {
      if (err) return callback(err);
      return callback(null, results);
    });
  },

  // get a favourite by its id
  getById: function(favouriteId, callback) {
    const sql = 'SELECT * FROM favourites WHERE favouriteId = ?';
    db.query(sql, [favouriteId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results && results[0] ? results[0] : null);
    });
  },

  // add a new favourite (expects object with productId, userId)
  add: function(fav, callback) {
    const sql = 'INSERT INTO favourites (productId, userId, created_at) VALUES (?, ?, ?)';
    const now = new Date();
    db.query(sql, [fav.productId, fav.userId, now], function(err, result) {
      if (err) return callback(err);
      return callback(null, result);
    });
  },

  // find a favourite by user + product (to prevent duplicates)
  findByUserAndProduct: function(userId, productId, callback) {
    const sql = 'SELECT * FROM favourites WHERE userId = ? AND productId = ? LIMIT 1';
    db.query(sql, [userId, productId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results && results[0] ? results[0] : null);
    });
  },

  // remove a favourite by favouriteId
  remove: function(favouriteId, callback) {
    const sql = 'DELETE FROM favourites WHERE favouriteId = ?';
    db.query(sql, [favouriteId], function(err, result) {
      if (err) return callback(err);
      return callback(null, result);
    });
  },

  // optional: find favourites for a specific user (joins product info)
  findByUser: function(userId, callback) {
    const sql = `
      SELECT f.*, p.productName, p.price, p.image, p.quantity
      FROM favourites f
      LEFT JOIN products p ON f.productId = p.productId
      WHERE f.userId = ?
      ORDER BY f.created_at DESC
    `;
    db.query(sql, [userId], function(err, results) {
      if (err) return callback(err);
      return callback(null, results);
    });
  },

  // optional: remove by userId + productId (useful to toggle favourite)
  removeByUserProduct: function(userId, productId, callback) {
    const sql = 'DELETE FROM favourites WHERE userId = ? AND productId = ?';
    db.query(sql, [userId, productId], function(err, result) {
      if (err) return callback(err);
      return callback(null, result);
    });
  }
};

module.exports = Favourite;
// ...existing code...
