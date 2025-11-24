const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const ProductController = require('./controllers/ProductController');
const UserController = require('./controllers/UserController');
const { checkAuthenticated, checkAdmin, validateRegistration } = require('./middleware');

const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
// enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({ extended: false }));

// Session & flash
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

// Make session user available in all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    // expose specific flash arrays so views can use `errors` or `success`
    res.locals.errors = req.flash('error') || [];
    res.locals.success = req.flash('success') || [];
    // keep a messages object for backwards compatibility
    res.locals.messages = { error: res.locals.errors, success: res.locals.success };
    next();
});

// Routes ------------------------------------------------------------------

// Home
app.get('/', (req, res) => {
    res.render('index');
});

// Inventory (admin only) - list all products via controller
app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    ProductController.listAll(req, res);
});

// Shopping (all authenticated users) - list products via controller, render shopping.ejs
app.get('/shopping', checkAuthenticated, (req, res) => {
    ProductController.listForShopping(req, res);
});

// Single product view
app.get('/product/:id', checkAuthenticated, (req, res) => {
    ProductController.getById(req, res);
});

// Add product - render form (admin)
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct');
});

// Add product - POST (admin) - handle upload and map form fields to controller expectations
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    // map incoming form fields used by previous views to the controller/model field names
    if (req.body.name) req.body.productName = req.body.name;
    // Map category - this is the missing line!
    if (req.body.category) req.body.category = req.body.category;
    // attach owner user id for FK linking
    if (req.session.user && req.session.user.id) req.body.user_id = req.session.user.id;
    ProductController.add(req, res);
});

// Update product form (admin)
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    // controller will render the edit form
    ProductController.getForEdit(req, res);
});

// Update product POST (admin)
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    if (req.body.name) req.body.productName = req.body.name;
    // Map category - this is the missing line!
    if (req.body.category) req.body.category = req.body.category;
    // preserve/attach user_id in case controller/model uses it
    if (req.session.user && req.session.user.id) req.body.user_id = req.session.user.id;
    ProductController.update(req, res);
});

// Delete product (admin)
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    ProductController.delete(req, res);
});

// Cart routes (adds to session cart). Use Product model via controller helper to fetch product data (controller returns/render).
// We'll call a lightweight controller helper that returns product data in req (fetchForCart).
app.post('/add-to-cart/:id', checkAuthenticated, async (req, res) => {
    // ProductController.fetchForCart will send product JSON via res.locals._product or handle redirect on error.
    // For simplicity call a controller helper that returns a product via callback style
    ProductController.fetchForCart(req, res, function(err, product) {
        if (err) {
            console.error(err);
            return res.status(500).send('Error adding to cart');
        }
        const productId = product.productd;
        const qty = parseInt(req.body.quantity) || 1;
        if (!req.session.cart) req.session.cart = [];

        const existing = req.session.cart.find(i => i.productId === productId);
        if (existing) existing.quantity += qty;
        else {
            req.session.cart.push({
                productId: product.productId,
                productName: product.productName,
                price: product.price,
                category: product.category,
                quantity: qty,
                image: product.image
            });
        }
        res.redirect('/cart');
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart });
});

// User routes --------------------------------------------------------------

// Register form
app.get('/register', (req, res) => {
    res.render('register', { formData: req.flash('formData')[0] });
});

// Register POST -> handled by controller
app.post('/register', validateRegistration, (req, res) => {
    // map incoming fields to controller expectation
    UserController.add(req, res);
});

// Login form
app.get('/login', (req, res) => {
    res.render('login');
});

// Login POST -> handled by controller (controller will set req.session.user on success)
app.post('/login', (req, res) => {
    UserController.login(req, res);
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Profile (view own profile)
app.get('/profile', checkAuthenticated, (req, res) => {
    UserController.profile(req, res);
});

// Users listing (admin)
app.get('/users', checkAuthenticated, checkAdmin, (req, res) => {
    UserController.listAll(req, res);
});

// Get user by id (admin)
app.get('/users/:id', checkAuthenticated, checkAdmin, (req, res) => {
    UserController.getById(req, res);
});

// Edit user form (admin) - reuse user controller or render edit view
app.get('/users/:id/edit', checkAuthenticated, checkAdmin, (req, res) => {
    // Controller will render edit view (UserController.getForEdit may be implemented)
    UserController.getForEdit(req, res);
});

// Update user (admin)
app.post('/users/:id', checkAuthenticated, checkAdmin, (req, res) => {
    UserController.update(req, res);
});

// Delete user (admin)
app.get('/users/:id/delete', checkAuthenticated, checkAdmin, (req, res) => {
    UserController.delete(req, res);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
