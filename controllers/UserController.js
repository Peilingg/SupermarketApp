// ...existing code...
const User = require('../models/User');

const UserController = {
    // list all users -> render users.ejs
    listAll: function(req, res) {
        User.getAll(function(err, users) {
            if (err) {
                console.error(err);
                return res.status(500).render('users', { users: [], error: 'Database error' });
            }
            return res.render('users', { users, error: null });
        });
    },

    // get a user by ID -> render user.ejs
    getById: function(req, res) {
        const id = req.params.id;
        User.getById(id, function(err, user) {
            if (err) {
                console.error(err);
                return res.status(500).render('user', { user: null, error: 'Database error' });
            }
            if (!user) {
                return res.status(404).render('user', { user: null, error: 'User not found' });
            }
            return res.render('user', { user, error: null });
        });
    },

    // render edit user form
    getForEdit: function(req, res) {
        const id = req.params.id;
        User.getById(id, function(err, user) {
            if (err) {
                console.error(err);
                return res.status(500).render('editUser', { user: null, error: 'Database error' });
            }
            if (!user) {
                return res.status(404).render('editUser', { user: null, error: 'User not found' });
            }
            return res.render('editUser', { user, error: null });
        });
    },

    // get own profile -> render profile.ejs
    profile: function(req, res) {
    const userId = req.session.userId;  // must exist
    if (!userId) {
        return res.redirect('/login'); // redirect if not logged in
    }

    User.getById(userId, function(err, user) {
        if (err) {
            return res.status(500).send("Database error");
        }
        if (!user) {
            return res.status(404).send("User not found");
        }

        res.render('profile', { users: user });  // <-- pass user to EJS
    });
    },

    // add a new user (expects form data)
    add: function(req, res) {
        const user = {
            username: req.body.username,
            email: req.body.email,
            password: req.body.password, // plain password; model hashes
            address: req.body.address || null,
            contact: req.body.contact || null,
            role: req.body.role || 'user'
        };

        User.add(user, function(err, result) {
            if (err) {
                console.error(err);
                return res.status(500).render('register', { user, error: 'Failed to create user' });
            }
            req.flash('success', 'Registration successful! Please log in.');
            return res.redirect('/login');
        });
    },

    // login handler: authenticates and sets session.user
    login: function(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/login');
        }
        User.authenticate(email, password, function(err, user) {
            if (err) {
                console.error(err);
                req.flash('error', 'Database error');
                return res.redirect('/login');
            }
            if (!user) {
                req.flash('error', 'Invalid email or password.');
                return res.redirect('/login');
            }
            // set session user (user object contains id and role)
            req.session.user = user;
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
            password: req.body.password || null, // if provided will be hashed by model
            address: req.body.address || null,
            contact: req.body.contact || null,
            role: req.body.role || 'user'
        };

        // If password not provided preserve existing by fetching current hashed pw (model handles omitted password)
        User.update(id, newData, function(err, result) {
            if (err) {
                console.error(err);
                return res.status(500).render('editUser', { user: Object.assign({ id }, newData), error: 'Failed to update user' });
            }
            return res.redirect('/users/' + id);
        });
    },

    // delete a user by ID
    delete: function(req, res) {
        const id = req.params.id;
        User.delete(id, function(err, result) {
            if (err) {
                console.error(err);
                return res.status(500).render('users', { users: [], error: 'Failed to delete user' });
            }
            return res.redirect('/users');
        });
    }
};

module.exports = UserController;
// ...existing code...