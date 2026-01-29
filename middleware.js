const User = require('./models/User');

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/shopping');
};

// Middleware to check if user account is suspended
const checkSuspension = (req, res, next) => {
    if (!req.session.user || !req.session.user.userId) {
        return next(); // Not logged in, skip check
    }

    User.isSuspended(req.session.user.userId, function(err, suspendStatus) {
        if (err) {
            console.error('Error checking suspension status:', err);
            return next(); // Continue on error, don't block the user
        }

        if (suspendStatus.suspended) {
            const suspendedUntil = new Date(suspendStatus.until);
            const remainingMinutes = Math.ceil((suspendedUntil - Date.now()) / 60000);
            req.flash('error', `Your account is temporarily suspended due to: ${suspendStatus.reason}. Please try again in ${remainingMinutes} minute(s).`);
            
            // Store suspension info in session for display
            req.session.suspensionInfo = {
                suspended: true,
                until: suspendStatus.until,
                reason: suspendStatus.reason,
                remainingMinutes: remainingMinutes
            };
            
            return res.redirect('/shopping');
        }

        // Clear any old suspension info from session
        if (req.session.suspensionInfo) {
            delete req.session.suspensionInfo;
        }
        
        next();
    });
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;
    if (!username || !email || !password || !address || !contact) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

module.exports = { checkAuthenticated, checkAdmin, checkSuspension, validateRegistration };