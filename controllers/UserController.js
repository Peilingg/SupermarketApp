const User = require('../models/User');

const UserController = {
    // list all users -> render users.ejs
    listAll: function(req, res) {
        User.getAll(function(err, users) {
            if (err) { console.error(err); return res.status(500).render('users', { users: [], error: 'Database error' }); }
            return res.render('users', { users, error: null });
        });
    },

    // get a user by ID -> render user.ejs
    getById: function(req, res) {
        const id = req.params.id;
        User.getById(id, function(err, user) {
            if (err) { console.error(err); return res.status(500).render('user', { user: null, error: 'Database error' }); }
            if (!user) return res.status(404).render('user', { user: null, error: 'User not found' });
            return res.render('user', { user, error: null });
        });
    },

    // render edit user form
    getForEdit: function(req, res) {
        const id = req.params.id;
        const sessionUser = req.session.user || null;

        User.getById(id, function(err, user) {
            if (err) { console.error('UserController.getForEdit -', err); return res.status(500).render('editUser', { user: null, action: `/users/${id}`, error: 'Database error', isAdmin: (sessionUser && sessionUser.role === 'admin') }); }
            if (!user) return res.status(404).render('editUser', { user: null, action: `/users/${id}`, error: 'User not found', isAdmin: (sessionUser && sessionUser.role === 'admin') });

            // Admin editing other user's profile -> action '/users/:id'
            // If you later want admin to use same route, leave as is
            return res.render('editUser', { user, action: `/users/${id}`, error: null, isAdmin: (sessionUser && sessionUser.role === 'admin') });
        });
    },

    // get own profile -> render profile.ejs
    profile: function(req, res) {
        const sessionUser = req.session.user || null;
        const requestedId = req.params && req.params.id ? req.params.id : null;
        const userId = requestedId || (sessionUser && sessionUser.userId);

        if (!userId) return res.redirect('/login');

        User.getById(userId, function(err, user) {
            if (err) { console.error('UserController.profile - DB error:', err); return res.status(500).render('profile', { user: null, error: 'Database error' }); }
            if (!user) return res.status(404).render('profile', { user: null, error: 'User not found' });

            const isOwner = sessionUser && sessionUser.userId && (String(sessionUser.userId) === String(user.userId));
            const isAdmin = sessionUser && sessionUser.role === 'admin';

            return res.render('profile', { user, isOwner, isAdmin, error: null });
        });
    },

    // Render profile edit form for the current logged-in user
    getForEditProfile: function(req, res) {
        const sessionUser = req.session.user || null;
        if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

        const userId = sessionUser.userId;
        User.getById(userId, function(err, user) {
            if (err) { console.error('getForEditProfile -', err); return res.status(500).render('editUser', { user: null, action: '/profile/edit', error: 'Database error', isAdmin: false }); }
            if (!user) return res.status(404).render('editUser', { user: null, action: '/profile/edit', error: 'User not found', isAdmin: false });

            return res.render('editUser', { user, action: '/profile/edit', error: null, isAdmin: (sessionUser.role === 'admin') });
        });
    },

    // POST handler for updating current user's own profile
    updateProfile: function(req, res) {
        const sessionUser = req.session.user || null;
        if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

        const id = sessionUser.userId;
        const newData = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password || null,
            address: req.body.address || null,
            contact: req.body.contact || null,
            role: (sessionUser.role === 'admin' && req.body.role) ? req.body.role : sessionUser.role // only admin can change role
        };

        User.update(id, newData, function(err, result) {
            if (err) {
                console.error('updateProfile -', err);
                return res.status(500).render('editUser', { user: Object.assign({ userId: id }, newData), action: '/profile/edit', error: 'Failed to update user', isAdmin: (sessionUser.role === 'admin') });
            }

            // refresh session user data after update
            User.getById(id, function(err2, updated) {
                if (!err2 && updated) req.session.user = updated;
                req.flash('success', 'Profile updated');
                return res.redirect('/profile');
            });
        });
    },

    // add a new user (expects form data)
    add: function(req, res) {
        const user = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            address: req.body.address || null,
            contact: req.body.contact || null,
            role: req.body.role || 'user'
        };

        User.add(user, function(err, result) {
            if (err) { console.error(err); return res.status(500).render('register', { user, error: 'Failed to create user' }); }
            req.flash('success', 'Registration successful! Please log in.');
            return res.redirect('/login');
        });
    },

    // login handler: authenticates and sets session.user
    login: function(req, res) {
        const { email, password } = req.body;
        if (!email || !password) { req.flash('error', 'All fields are required.'); return res.redirect('/login'); }
        User.authenticate(email, password, function(err, user) {
            if (err) { console.error(err); req.flash('error', 'Database error'); return res.redirect('/login'); }
            if (!user) { req.flash('error', 'Invalid email or password.'); return res.redirect('/login'); }
            // save user object with userId
            req.session.user = user; // user.userId present from model
            req.flash('success', 'Login successful!');
            if (user.role === 'user') return res.redirect('/shopping');
            return res.redirect('/inventory');
        });
    },

    // update an existing user by ID
    update: function(req, res) {
        const id = req.params.id;
        const newData = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password || null,
            address: req.body.address || null,
            contact: req.body.contact || null,
            role: req.body.role || 'user'
        };

        User.update(id, newData, function(err, result) {
            if (err) { console.error(err); return res.status(500).render('editUser', { user: Object.assign({ userId: id }, newData), error: 'Failed to update user' }); }
            return res.redirect('/users/' + id);
        });
    },

    // delete a user by ID
    delete: function(req, res) {
        const id = req.params.id;
        User.delete(id, function(err, result) {
            if (err) { console.error(err); return res.status(500).render('users', { users: [], error: 'Failed to delete user' }); }
            return res.redirect('/users');
        });
    }
};

module.exports = UserController;