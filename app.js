const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const ProductController = require('./controllers/ProductController');
const UserController = require('./controllers/UserController');
const CartItemController = require('./controllers/CartItemController');
const FavouriteController = require('./controllers/FavouriteController');
const PurchaseController = require('./controllers/PurchaseController');
const PurchaseItemController = require('./controllers/PurchaseItemController');
const UserVoucherController = require('./controllers/UserVoucherController');
const VoucherController = require('./controllers/VoucherController');
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
app.use(express.urlencoded({ extended: true })); // parse form POST bodies
app.use(express.json());

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
app.get('/shopping', checkAuthenticated, ProductController.listForShopping);


// View single product detail
app.get('/product/:id', checkAuthenticated, (req, res) => {
    ProductController.getById(req, res);
});
// ------------------ Cart routes (DB-backed, MVC) ------------------
// Use CartItemController methods (function-based model/controller)

// Show current user's cart (list all cart items)
app.get('/cart', checkAuthenticated, (req, res) => {
  // controller expects req and res and will render EJS view
  CartItemController.listAll(req, res);
});

// Update quantity for a cart item (expects body { quantity } or param)
// supports both POST /cart/update/:cart_itemsId and POST /cart/update
app.post('/cart/update/:cart_itemsId', checkAuthenticated, (req, res) => {
  // controller expects req.params.id or req.body.cart_itemsId
  req.params.id = req.params.cart_itemsId;
  CartItemController.update(req, res);
});
app.post('/cart/update', checkAuthenticated, (req, res) => {
  CartItemController.update(req, res);
});

// Remove a single cart item by cart_itemsId
app.post('/cart/remove/:cart_itemsId', checkAuthenticated, (req, res) => {
  // controller expects req.params.id or req.body.cart_itemsId
  req.params.id = req.params.cart_itemsId;
  CartItemController.remove(req, res);
});
app.post('/cart/remove', checkAuthenticated, (req, res) => {
  CartItemController.remove(req, res);
});

// Clear all items for current user (DB)
app.post('/cart/clear', checkAuthenticated, (req, res) => {
  // controller method name is `clear`
  CartItemController.clear(req, res);
});

// Get cart totals (AJAX or render partial) -> use subtotal endpoint
app.get('/cart/totals', checkAuthenticated, (req, res) => {
  CartItemController.subtotal(req, res);
});

// Add routes to support adding to cart (forms and AJAX)
app.post('/cart/add/:productId', checkAuthenticated, (req, res) => {
  // controller checks req.params.id or req.body.productId
  req.params.id = req.params.productId;
  req.body.productId = req.params.productId;
  CartItemController.add(req, res);
});
app.post('/cart/add', checkAuthenticated, (req, res) => {
  CartItemController.add(req, res);
});

// Alias for older form action: /add-to-cart/:productId -> existing CartItemController.add
app.post('/add-to-cart/:productId', checkAuthenticated, (req, res, next) => {
  // normalize param name controller expects (CartItemController.add reads req.params.id or req.body.productId)
  req.params.id = req.params.productId;
  req.body.productId = req.params.productId;
  return CartItemController.add(req, res, next);
});

// ------------------ Favourites routes (MVC) ------------------
// List current user's favourites
app.get('/favourites', checkAuthenticated, FavouriteController.listByUser);

// alias for singular path used in your nav/link
app.get('/favourite', checkAuthenticated, FavouriteController.listByUser);

// add POST alias if some forms post to singular path
app.post('/favourite/add', checkAuthenticated, FavouriteController.add);
app.post('/favourites/add', checkAuthenticated, FavouriteController.add); // alias for singular form POSTs

// Remove favourite by favouriteId (POST)
app.post('/favourites/remove/:id', checkAuthenticated, FavouriteController.remove);

// Optional alias so GET /favourites/remove/:id won't 404 (use only if needed)
app.get('/favourites/remove/:id', checkAuthenticated, FavouriteController.remove);

// Remove favourite by userId + productId (toggle) - accepts JSON/form body
app.post('/favourites/removeByProduct', checkAuthenticated, FavouriteController.removeByUserProduct);

// User vouchers (API-style)
app.get('/uservouchers', checkAuthenticated, (req, res) => {
    UserVoucherController.list(req, res);
});
app.post('/uservouchers/claim/:voucherId', checkAuthenticated, (req, res) => {
    UserVoucherController.claim(req, res);
});
app.post('/uservouchers/apply', checkAuthenticated, (req, res) => {
    UserVoucherController.apply(req, res);
});
app.post('/uservouchers/clear', checkAuthenticated, (req, res) => {
    UserVoucherController.clear(req, res);
});

// Vouchers (user)
app.get('/vouchers', checkAuthenticated, (req, res) => {
    VoucherController.listForUser(req, res);
});
app.post('/vouchers/claim/:voucherId', checkAuthenticated, (req, res) => {
    VoucherController.claim(req, res);
});
app.post('/vouchers/apply', checkAuthenticated, (req, res) => {
    VoucherController.apply(req, res);
});
app.post('/vouchers/clear', checkAuthenticated, (req, res) => {
    VoucherController.clearApplied(req, res);
});

// Vouchers (admin)
app.get('/adminVouchers', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminList(req, res);
});
app.post('/adminVouchers', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminCreate(req, res);
});
app.post('/adminVouchers/:id', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminUpdate(req, res);
});
app.post('/adminVouchers/:id/delete', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminDelete(req, res);
});


// Add product form (admin) - render with categories
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { categories: CATEGORIES, product: null, error: null });
});

// Add product - POST (admin)
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    // map front-end names to controller/model fields (keep UI unchanged)
    if (req.body.name) req.body.productName = req.body.name;
    // normalize numeric fields
    if (req.body.quantity) req.body.quantity = parseInt(req.body.quantity, 10) || 0;
    if (req.body.price) req.body.price = parseFloat(req.body.price) || 0;
    // ensure category flows through
    req.body.category = req.body.category || null;
    // attach owner user id for FK linking if session has userId
    if (req.session.user && req.session.user.userId) req.body.userId = req.session.user.userId;
    // forward to controller
    ProductController.add(req, res);
});

// Update product form (admin)
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    ProductController.getForEdit(req, res); // controller passes categories
});

// Update product POST (admin)
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    if (req.body.name) req.body.productName = req.body.name;
    if (req.body.category) req.body.category = req.body.category;
    if (req.session.user && req.session.user.userId) req.body.userId = req.session.user.userId;
    ProductController.update(req, res);
});

// Delete product (admin)
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    ProductController.delete(req, res);
});

const CATEGORIES = ['Bakery','Beverages','Dairy','Snacks','Fruits & Vegetables'];

// Redirects for category filtering
app.get('/filteredProduct', (req, res) => {
  const category = req.query.category || '';
  res.redirect('/shopping' + (category ? ('?category=' + encodeURIComponent(category)) : ''));
});
app.post('/filteredProduct', (req, res) => {
  const category = req.body.category || '';
  res.redirect('/shopping' + (category ? ('?category=' + encodeURIComponent(category)) : ''));
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

// Profile edit (current user)
app.get('/profile/edit', checkAuthenticated, (req, res) => {
    UserController.getForEditProfile(req, res);
});

app.post('/profile/edit', checkAuthenticated, (req, res) => {
    UserController.updateProfile(req, res);
});

// Users listing (admin)
app.get('/users', checkAuthenticated, checkAdmin, (req, res) => {
    UserController.listAll(req, res);
});
// Alias for manage users page
app.get('/manageusers', checkAuthenticated, checkAdmin, (req, res) => {
    UserController.listAll(req, res);
});

// Purchase history (current user)
app.get('/purchases', checkAuthenticated, (req, res) => {
    PurchaseController.listByUser(req, res);
});
// Reorder past purchase items -> adds back to cart
app.post('/purchases/:purchaseId/reorder', checkAuthenticated, (req, res) => {
    PurchaseController.reorder(req, res);
});

// Manage all orders (admin)
app.get('/manageorders', checkAuthenticated, checkAdmin, (req, res) => {
    PurchaseController.listAll(req, res);
});

// Admin purchase item helpers
app.get('/admin/purchase/:purchaseId/items', checkAuthenticated, checkAdmin, (req, res) => {
    PurchaseItemController.listByPurchase(req, res);
});
app.post('/admin/purchase/items', checkAuthenticated, checkAdmin, (req, res) => {
    PurchaseItemController.create(req, res);
});
app.post('/admin/purchase/items/:id/delete', checkAuthenticated, checkAdmin, (req, res) => {
    PurchaseItemController.remove(req, res);
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

// ---------- (optional) session-cart endpoints kept if you need them ----------
// If you still want a simple session-based cart (not DB-backed), add distinct routes
// to avoid conflicting with the DB-backed /cart endpoints above.

// Handle checkout form POST from the cart page (avoid "Cannot POST /cart/checkout")
app.post('/cart/checkout', checkAuthenticated, (req, res) => {
  // simple flow: redirect to the checkout/invoice summary page (GET /checkout)
  return res.redirect('/checkout');
});

// Show checkout/invoice summary
app.get('/checkout', checkAuthenticated, (req, res) => {
  const CartItem = require('./models/CartItem');
  const Product = require('./models/Product');
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

  const paymentMethods = ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'PayNow'];
  const paymentMethod = req.query.paymentMethod || paymentMethods[0];

  CartItem.listAll(sessionUser.userId, (err, items) => {
    if (err) return res.status(500).send('Server error');

    const mapped = (items || []).map(it => {
      const price = Number(it.price || it.unitPrice || 0);
      const qty = Number(it.quantity || it.qty || 0);
      return Object.assign({}, it, { price, quantity: qty, lineTotal: +(price * qty) });
    });

    const subtotal = mapped.reduce((s, i) => s + (i.lineTotal || 0), 0);
    const tax = +((subtotal * 0.07)).toFixed(2);             // adjust tax rule if needed
    const shipping = +(subtotal > 50 ? 0 : 5).toFixed(2);     // adjust shipping rule if needed
    const appliedVoucher = req.session.appliedVoucher || null;
    const voucherCalc = VoucherController.computeDiscount(appliedVoucher, subtotal);
    const voucherDiscount = +(voucherCalc.discount || 0).toFixed(2);
    const total = +(subtotal + tax + shipping - voucherDiscount).toFixed(2);

    res.render('confirmationPurchase', {
      user: req.session.user,
      items: mapped,
      subtotal, tax, shipping, total,
      voucher: appliedVoucher,
      voucherDiscount,
      voucherReason: voucherCalc.reason || null,
      invoice: false,
      paymentMethod,
      paymentDetails: null,
      paymentMethods,
      orderId: null
    });
  });
});

// Confirm + "pay" (simple invoice stub)
app.post('/checkout/confirm', checkAuthenticated, (req, res) => {
  const CartItem = require('./models/CartItem');
  const Product = require('./models/Product');
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

  const paymentMethods = ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'PayNow'];
  const paymentMethod = req.body.paymentMethod || paymentMethods[0];
  const paymentDetails = (method => {
    if (method === 'Contactless payment (Apple Pay)') return 'Pay with your linked Apple Pay device.';
    if (method === 'PayNow') return 'PayNow UEN: 20241234A (Reference: your email)';
    return 'Visa / Mastercard / AMEX supported.';
  })(paymentMethod);
  const orderId = req.body.orderId || `INV-${Date.now()}`;

  CartItem.listAll(sessionUser.userId, (err, items) => {
    if (err) return res.status(500).send('Server error');
    const mapped = (items || []).map(it => {
      const price = Number(it.price || it.unitPrice || 0);
      const qty = Number(it.quantity || it.qty || 0);
      return Object.assign({}, it, { price, quantity: qty, lineTotal: +(price * qty) });
    });

    const subtotal = mapped.reduce((s, i) => s + (i.lineTotal || 0), 0);
    const tax = +((subtotal * 0.07)).toFixed(2);
    const shipping = +(subtotal > 50 ? 0 : 5).toFixed(2);
    const appliedVoucher = req.session.appliedVoucher || null;
    const voucherCalc = VoucherController.computeDiscount(appliedVoucher, subtotal);
    const voucherDiscount = +(voucherCalc.discount || 0).toFixed(2);
    const total = +(subtotal + tax + shipping - voucherDiscount).toFixed(2);

    // Record purchase then clear cart and render invoice
    const summary = {
      subtotal,
      tax,
      shipping,
      total,
      paymentMethod,
      paymentDetails: paymentDetails + (appliedVoucher && voucherDiscount > 0 ? ` | Voucher ${appliedVoucher.code} (-$${voucherDiscount.toFixed(2)})` : '')
    };

    Purchase.record(sessionUser.userId, summary, mapped, (saveErr, purchaseId) => {
      if (saveErr) console.error('Checkout confirm -> save purchase failed', saveErr);
      const finalOrderId = purchaseId || orderId;

       // mark voucher used if applied successfully
      if (!saveErr && appliedVoucher && voucherDiscount > 0 && appliedVoucher.userVoucherId) {
        Voucher.markUsed(appliedVoucher.userVoucherId, (vErr) => {
          if (vErr) console.error('Failed to mark voucher used', vErr);
        });
      }
      delete req.session.appliedVoucher;

      CartItem.clear(sessionUser.userId, (clearErr) => {
        if (clearErr) console.error('Checkout confirm -> clear cart failed', clearErr);

        res.render('invoice', {
          user: req.session.user,
          items: mapped,
          subtotal, tax, shipping, total,
          voucher: appliedVoucher,
          voucherDiscount,
          invoice: true,
          paymentMethod,
          paymentDetails,
          paymentMethods,
          orderId: finalOrderId,
          generatedAt: new Date()
        });
      });
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
