const Favourite = require('../models/Favourite');

const FavouriteController = {
  // List all favourites (admin/overview)
  listAll: function(req, res) {
    Favourite.getAll(function(err, favourites) {
      if (err) {
        console.error('FavouriteController.listAll error:', err);
        req.flash && req.flash('error', 'Unable to load favourites.');
        return res.status(500).render('favourite', { favourites: [], error: 'DB error', user: req.session && req.session.user });
      }
      return res.render('favourite', { favourites: favourites || [], user: req.session && req.session.user });
    });
  },

  // List favourites for a specific user (uses session user if not provided)
  listByUser: function(req, res) {
    const userId = req.params.userId || (req.session && req.session.user && req.session.user.userId);
    if (!userId) {
      req.flash && req.flash('error', 'User not identified.');
      return res.redirect('/login');
    }

    Favourite.findByUser(userId, function(err, favourites) {
      if (err) {
        console.error('FavouriteController.listByUser error:', err);
        req.flash && req.flash('error', 'Unable to load your favourites.');
        return res.status(500).render('favourite', { favourites: [], error: 'DB error', user: req.session && req.session.user });
      }
      // render the singular favourite.ejs and pass the favourites array
      return res.render('favourite', { favourites: favourites || [], user: req.session && req.session.user });
    });
  },

  // Get single favourite by id
  getById: function(req, res) {
    const id = req.params.id;
    Favourite.getById(id, function(err, fav) {
      if (err) {
        console.error('FavouriteController.getById error:', err);
        req.flash && req.flash('error', 'Unable to fetch favourite.');
        return res.status(500).render('favourite', { favourites: [], error: 'DB error', user: req.session && req.session.user });
      }
      if (!fav) {
        return res.status(404).render('favourite', { favourites: [], error: 'Not found', user: req.session && req.session.user });
      }
      // reuse the same view but pass a single-item array to keep template consistent
      return res.render('favourite', { favourites: [fav], user: req.session && req.session.user });
    });
  },

  // Add a favourite (expects productId in body and uses session user)
  add: function(req, res) {
    // make safe: ensure req.body exists and productId present
    const body = req.body || {};
    const productId = body.productId;
    const userId = body.userId || (req.session && req.session.user && req.session.user.userId);

    if (!productId || !userId) {
      // respond with JSON for AJAX or redirect for normal form posts
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
        return res.status(400).json({ success: false, message: 'Missing productId or user not authenticated.' });
      }
      req.flash && req.flash('error', 'Missing product or user.');
      return res.redirect('/favourites');
    }

    Favourite.add({ productId, userId }, function(err, result) {
      if (err) {
        console.error('FavouriteController.add error:', err);
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
          return res.status(500).json({ success: false, message: 'Unable to add favourite.' });
        }
        req.flash && req.flash('error', 'Unable to add favourite.');
        return res.redirect('/favourites');
      }

      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
        return res.json({ success: true, message: 'Item added to favourites' });
      }
      req.flash && req.flash('success', 'Added to favourites.');
      return res.redirect('/favourites');
    });
  },

  // Remove a favourite by favouriteId
  remove: function(req, res) {
    const id = req.params.id;
    if (!id) {
      req.flash && req.flash('error', 'Missing favourite id.');
      return res.redirect('/favourites'); // changed from 'back'
    }

    Favourite.remove(id, function(err, result) {
      if (err) {
        console.error('FavouriteController.remove error:', err);
        req.flash && req.flash('error', 'Unable to remove favourite.');
      } else {
        req.flash && req.flash('success', 'Favourite removed.');
      }
      // send user to the favourites list explicitly
      return res.redirect('/favourites');
    });
  },

  // Remove by userId + productId (useful for toggling)
  removeByUserProduct: function(req, res) {
    const userId = req.body.userId || (req.session && req.session.user && req.session.user.userId);
    const productId = req.body.productId || req.params.productId;
    if (!userId || !productId) {
      req.flash && req.flash('error', 'Missing parameters.');
      return res.status(400).json({ error: 'Missing parameters' });
    }

    Favourite.removeByUserProduct(userId, productId, function(err, result) {
      if (err) {
        console.error('FavouriteController.removeByUserProduct error:', err);
        return res.status(500).json({ error: 'DB error' });
      }
      return res.json({ success: true });
    });
  }
};

module.exports = FavouriteController;