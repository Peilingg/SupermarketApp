const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const dotenv = require('dotenv');
const checkoutNodejssdk = require('@paypal/checkout-server-sdk');
const axios = require('axios');
const ProductController = require('./controllers/ProductController');
const UserController = require('./controllers/UserController');
const CartItemController = require('./controllers/CartItemController');
const FavouriteController = require('./controllers/FavouriteController');
const PurchaseController = require('./controllers/PurchaseController');
const PurchaseItemController = require('./controllers/PurchaseItemController');
const UserVoucherController = require('./controllers/UserVoucherController');
const VoucherController = require('./controllers/VoucherController');
const RefundController = require('./controllers/RefundController');
const Purchase = require('./models/Purchase');
const Voucher = require('./models/Voucher');
const CartItem = require('./models/CartItem');
const { checkAuthenticated, checkAdmin, validateRegistration } = require('./middleware');
const netsService = require('./services/nets');

// Load environment variables
dotenv.config();

// Configure PayPal SDK
let paypalClient = null;
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  const paypalEnv = process.env.PAYPAL_MODE === 'live'
    ? new checkoutNodejssdk.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
    : new checkoutNodejssdk.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
  paypalClient = new checkoutNodejssdk.core.PayPalHttpClient(paypalEnv);
  console.log('✓ PayPal SDK configured');
} else {
  console.warn('⚠ PayPal credentials not found. PayPal payment will not work. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
}

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
app.get('/admin/vouchers', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminList(req, res);
});
app.post('/admin/vouchers', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminCreate(req, res);
});
app.post('/admin/vouchers/:id', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminUpdate(req, res);
});
app.post('/admin/vouchers/:id/delete', checkAuthenticated, checkAdmin, (req, res) => {
    VoucherController.adminDelete(req, res);
});

// Legacy admin voucher path support (old link/bookmark)
app.get('/adminVouchers', (req, res) => res.redirect('/admin/vouchers'));


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

// Refund Request Routes (User)
app.post('/refund/request/:purchaseId', checkAuthenticated, (req, res) => {
    RefundController.requestRefund(req, res);
});
app.get('/refundhistory', checkAuthenticated, (req, res) => {
    RefundController.listByUser(req, res);
});

// Refund Management Routes (Admin)
app.get('/managerefunds', checkAuthenticated, checkAdmin, (req, res) => {
    RefundController.listAll(req, res);
});
app.get('/refund/:refundId', checkAuthenticated, checkAdmin, (req, res) => {
    RefundController.getDetail(req, res);
});
app.post('/refund/:refundId/approve', checkAuthenticated, checkAdmin, (req, res) => {
    RefundController.approve(req, res);
});
app.post('/refund/:refundId/reject', checkAuthenticated, checkAdmin, (req, res) => {
    RefundController.reject(req, res);
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

  const paymentMethods = ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'PayNow', 'PayPal', 'NETS QR'];
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

// Confirm + "pay" (handles all payment methods including PayPal)
app.post('/checkout/confirm', checkAuthenticated, (req, res) => {
  const CartItem = require('./models/CartItem');
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

  const paymentMethods = ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'PayNow', 'PayPal', 'NETS QR'];
  const paymentMethod = req.body.paymentMethod || paymentMethods[0];

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

    // PAYPAL PAYMENT HANDLING
    if (paymentMethod === 'PayPal') {
      if (!paypalClient) {
        req.flash && req.flash('error', 'PayPal is not configured. Please contact support.');
        return res.redirect('/checkout');
      }

      const requestBody = {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'SGD',
            value: total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: 'SGD',
                value: subtotal.toFixed(2)
              },
              tax_total: {
                currency_code: 'SGD',
                value: tax.toFixed(2)
              },
              shipping: {
                currency_code: 'SGD',
                value: shipping.toFixed(2)
              },
              discount: {
                currency_code: 'SGD',
                value: voucherDiscount.toFixed(2)
              }
            }
          },
          items: mapped.map(item => ({
            name: item.productName || item.name || 'Product',
            sku: item.productId || item.id || 'SKU',
            unit_amount: {
              currency_code: 'SGD',
              value: Number(item.price || item.unitPrice || 0).toFixed(2)
            },
            quantity: String(item.quantity || 1)
          }))
        }],
        payer: {
          email_address: sessionUser.email || 'buyer@example.com',
          name: {
            given_name: sessionUser.username || 'Customer'
          }
        },
        application_context: {
          brand_name: 'Supermarket Store',
          user_action: 'PAY_NOW',
          return_url: `${process.env.APP_URL || 'http://localhost:3000'}/paypal/return`,
          cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/checkout`
        }
      };

      try {
        const request = new checkoutNodejssdk.orders.OrdersCreateRequest();
        request.prefer('return=representation');
        request.requestBody(requestBody);

        paypalClient.execute(request)
          .then(response => {
            // Save to session for later
            req.session.paypalOrderId = response.result.id;
            req.session.checkoutData = {
              items: mapped,
              subtotal, tax, shipping, total,
              appliedVoucher,
              voucherDiscount
            };

            // Find PayPal approval link
            const approvalLink = response.result.links.find(l => l.rel === 'approve');
            if (approvalLink) {
              return res.redirect(approvalLink.href);
            } else {
              console.error('PayPal response:', response.result);
              req.flash && req.flash('error', 'Unable to process PayPal payment.');
              return res.redirect('/checkout');
            }
          })
          .catch(error => {
            console.error('PayPal error:', error.message || error);
            req.flash && req.flash('error', 'Failed to create PayPal payment. ' + (error.message || ''));
            return res.redirect('/checkout');
          });
      } catch (error) {
        console.error('PayPal execution error:', error.message || error);
        req.flash && req.flash('error', 'PayPal error: ' + (error.message || 'Unknown error'));
        return res.redirect('/checkout');
      }
      return;
    }

    // NETS QR PAYMENT HANDLING
    if (paymentMethod === 'NETS QR') {
      // Store checkout data in session for later retrieval after payment
      req.session.checkoutData = {
        items: mapped,
        subtotal, tax, shipping, total,
        appliedVoucher,
        voucherDiscount
      };

      // Pass data to generateQrCode - add cartTotal to body
      req.body.cartTotal = total;

      // Call the NETS QR service to generate QR code
      return netsService.generateQrCode(req, res);
    }

    // REGULAR PAYMENT METHODS (Credit/Debit, Apple Pay, PayNow)
    const paymentDetails = (method => {
      if (method === 'Contactless payment (Apple Pay)') return 'Pay with your linked Apple Pay device.';
      if (method === 'PayNow') return 'PayNow UEN: 20241234A (Reference: your email)';
      return 'Visa / Mastercard / AMEX supported.';
    })(paymentMethod);
    const orderId = req.body.orderId || `INV-${Date.now()}`;

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

// ==================== PayPal Return Callback ====================

// Handle PayPal return (after user approves payment)
app.get('/paypal/return', checkAuthenticated, (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

  if (!paypalClient) {
    req.flash && req.flash('error', 'PayPal is not configured.');
    return res.redirect('/checkout');
  }

  const orderId = req.query.token;
  const checkoutData = req.session.checkoutData;

  if (!orderId || !checkoutData) {
    req.flash && req.flash('error', 'Invalid PayPal session. Please try again.');
    return res.redirect('/checkout');
  }

  // Capture the payment
  try {
    const request = new checkoutNodejssdk.orders.OrdersCaptureRequest(orderId);
    request.prefer('return=representation');

    paypalClient.execute(request)
      .then(response => {
        if (response.result.status === 'COMPLETED') {
          // Payment successful - record purchase
          const summary = {
            subtotal: checkoutData.subtotal,
            tax: checkoutData.tax,
            shipping: checkoutData.shipping,
            total: checkoutData.total,
            paymentMethod: 'PayPal',
            paymentDetails: `PayPal Transaction ID: ${response.result.id}`
          };

          Purchase.record(sessionUser.userId, summary, checkoutData.items, (saveErr, purchaseId) => {
            if (saveErr) console.error('Failed to record purchase:', saveErr);

            // Mark voucher as used if applied
            if (checkoutData.appliedVoucher && checkoutData.voucherDiscount > 0 && checkoutData.appliedVoucher.userVoucherId) {
              Voucher.markUsed(checkoutData.appliedVoucher.userVoucherId, (vErr) => {
                if (vErr) console.error('Failed to mark voucher used', vErr);
              });
            }

            // Clear cart
            CartItem.clear(sessionUser.userId, (clearErr) => {
            if (clearErr) console.error('Failed to clear cart:', clearErr);
          });

          // Clean up session
          delete req.session.paypalOrderId;
          delete req.session.checkoutData;
          delete req.session.appliedVoucher;

          // Show invoice
          res.render('invoice', {
            user: sessionUser,
            items: checkoutData.items,
            subtotal: checkoutData.subtotal,
            tax: checkoutData.tax,
            shipping: checkoutData.shipping,
            total: checkoutData.total,
            voucher: checkoutData.appliedVoucher,
            voucherDiscount: checkoutData.voucherDiscount,
            invoice: true,
            paymentMethod: 'PayPal',
            paymentDetails: `PayPal Transaction ID: ${response.result.id}`,
            paymentMethods: ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'PayNow', 'PayPal'],
            orderId: purchaseId,
            generatedAt: new Date()
          });
        });
      } else {
        req.flash && req.flash('error', 'PayPal payment was not completed.');
        return res.redirect('/checkout');
      }
    })
    .catch(error => {
      console.error('PayPal capture error:', error.message || error);
      req.flash && req.flash('error', 'PayPal payment failed. ' + (error.message || 'Please try again.'));
      return res.redirect('/checkout');
    });
  } catch (error) {
    console.error('PayPal return error:', error.message || error);
    req.flash && req.flash('error', 'PayPal error: ' + (error.message || 'Unknown error'));
    return res.redirect('/checkout');
  }
});

// ==================== End PayPal Routes ====================

// ==================== NETS QR Status SSE ====================
// Client listens on /sse/payment-status/:txnRetrievalRef and receives { success: true } or { fail: true }
app.get('/sse/payment-status/:txnRetrievalRef', checkAuthenticated, async (req, res) => {
  const txnRetrievalRef = req.params.txnRetrievalRef;
  const courseInitId = req.query.course_init_id || '';

  // Allow headers from EventSourcePolyfill, or fall back to env
  const apiKey = req.headers['api-key'] || process.env.API_KEY;
  const projectId = req.headers['project-id'] || process.env.PROJECT_ID;
  const baseUrl = process.env.NETS_BASE_URL || 'https://sandbox.nets.openapipaas.com';

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  // Poll NETS query API every 3 seconds, up to 5 minutes
  const startedAt = Date.now();
  const timeoutMs = 5 * 60 * 1000;

  const poll = async () => {
    // Stop if timed out
    if (Date.now() - startedAt > timeoutMs) {
      res.write(`data: ${JSON.stringify({ fail: true, reason: 'timeout' })}\n\n`);
      clearInterval(heartbeat);
      clearInterval(interval);
      return res.end();
    }

    try {
      // Try POST to nets-qr/query (preferred in some NETS docs)
      const postUrl1 = `${baseUrl}/api/v1/common/payments/nets-qr/query`;
      let response;
      try {
        response = await axios.post(postUrl1, {
          txn_retrieval_ref: txnRetrievalRef,
          course_init_id: courseInitId || undefined,
        }, {
          headers: {
            'api-key': apiKey,
            'project-id': projectId,
          },
        });
      } catch (err1) {
        // Fallback: GET nets-qr/query with query params
        const getUrl1 = `${baseUrl}/api/v1/common/payments/nets-qr/query?txn_retrieval_ref=${encodeURIComponent(txnRetrievalRef)}${courseInitId ? `&course_init_id=${encodeURIComponent(courseInitId)}` : ''}`;
        try {
          response = await axios.get(getUrl1, {
            headers: {
              'api-key': apiKey,
              'project-id': projectId,
            },
          });
        } catch (err2) {
          // Second fallback: POST nets/query (alternate path used by some environments)
          const postUrl2 = `${baseUrl}/api/v1/common/payments/nets/query`;
          try {
            response = await axios.post(postUrl2, {
              txn_retrieval_ref: txnRetrievalRef,
              course_init_id: courseInitId || undefined,
            }, {
              headers: {
                'api-key': apiKey,
                'project-id': projectId,
              },
            });
          } catch (err3) {
            // Final fallback: GET nets/query
            const getUrl2 = `${baseUrl}/api/v1/common/payments/nets/query?txn_retrieval_ref=${encodeURIComponent(txnRetrievalRef)}${courseInitId ? `&course_init_id=${encodeURIComponent(courseInitId)}` : ''}`;
            try {
              response = await axios.get(getUrl2, {
                headers: {
                  'api-key': apiKey,
                  'project-id': projectId,
                },
              });
            } catch (err4) {
              // If all attempts fail, keep polling but log once
              console.error('NETS QR query error:', (err4 && err4.response && err4.response.status) ? `HTTP ${err4.response.status}` : (err4.message || err4));
              return; // continue polling
            }
          }
        }
      }

      const data = response && response.data && response.data.result && response.data.result.data 
        ? response.data.result.data 
        : (response && response.data && response.data.data ? response.data.data : response.data);
      
      if (!data) {
        console.log('No data in NETS response, continuing to poll...');
        return; // keep polling
      }

      console.log('NETS query response data:', JSON.stringify(data, null, 2));

      // Interpret NETS statuses:
      // - response_code === '00' and txn_status === 2 -> success (captured/paid)
      // - txn_status === 1 can also indicate successful transaction in some environments
      // - explicit error codes or network_status !== 0 -> fail
      const txnStatus = Number(data.txn_status);
      console.log(`NETS transaction status: response_code=${data.response_code}, txn_status=${txnStatus}, network_status=${data.network_status}`);

      // Accept txn_status of 1 or 2 as success (depending on NETS environment/simulator)
      if ((data.response_code === '00' || data.response_code === '') && (txnStatus === 1 || txnStatus === 2)) {
        console.log(`Payment successful - txn_status is ${txnStatus}`);
        res.write(`data: ${JSON.stringify({ success: true, txn_retrieval_ref: txnRetrievalRef })}\n\n`);
        clearInterval(heartbeat);
        clearInterval(interval);
        return res.end();
      }

      if (data.network_status && Number(data.network_status) !== 0) {
        console.log('Payment failed - network_status is not 0');
        res.write(`data: ${JSON.stringify({ fail: true, error: data.error_message || 'network_error' })}\n\n`);
        clearInterval(heartbeat);
        clearInterval(interval);
        return res.end();
      }
      // else: still pending (txn_status could be 1 -> created), continue polling
      console.log('Transaction still pending, will poll again in 3 seconds...');
    } catch (err) {
      // On API error, keep polling a few times; if persistent, report fail
      console.error('NETS QR query error:', err.message || err);
      if (err.response && err.response.data) {
        console.error('NETS API response error:', JSON.stringify(err.response.data, null, 2));
      }
    }
  };

  // Start polling
  const interval = setInterval(poll, 3000);
  // Run first poll immediately
  poll();
});

// ==================== End NETS QR Status SSE ====================

// ==================== NETS QR Routes ====================

// Generate NETS QR Code
app.post('/nets-qr/generate', checkAuthenticated, (req, res) => {
  netsService.generateQrCode(req, res);
});

// Handle NETS QR Success
app.get('/nets-qr/success', checkAuthenticated, (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

  const checkoutData = req.session.checkoutData;
  if (!checkoutData) {
    req.flash && req.flash('error', 'Invalid session. Please try checkout again.');
    return res.redirect('/checkout');
  }

  const summary = {
    subtotal: checkoutData.subtotal,
    tax: checkoutData.tax,
    shipping: checkoutData.shipping,
    total: checkoutData.total,
    paymentMethod: 'NETS QR',
    paymentDetails: `NETS QR Transaction Ref: ${req.query.txn_retrieval_ref || 'N/A'}`
  };

  Purchase.record(sessionUser.userId, summary, checkoutData.items, (saveErr, purchaseId) => {
    if (saveErr) console.error('Failed to record NETS QR purchase:', saveErr);

    // Mark voucher as used if applied
    if (checkoutData.appliedVoucher && checkoutData.voucherDiscount > 0 && checkoutData.appliedVoucher.userVoucherId) {
      Voucher.markUsed(checkoutData.appliedVoucher.userVoucherId, (vErr) => {
        if (vErr) console.error('Failed to mark voucher used', vErr);
      });
    }

    // Clear cart
    CartItem.clear(sessionUser.userId, (clearErr) => {
      if (clearErr) console.error('Failed to clear cart:', clearErr);
    });

    // Clean up session
    delete req.session.checkoutData;
    delete req.session.appliedVoucher;

    // Show invoice with success message
    res.render('invoice', {
      user: sessionUser,
      items: checkoutData.items,
      subtotal: checkoutData.subtotal,
      tax: checkoutData.tax,
      shipping: checkoutData.shipping,
      total: checkoutData.total,
      voucher: checkoutData.appliedVoucher,
      voucherDiscount: checkoutData.voucherDiscount,
      invoice: true,
      paymentMethod: 'NETS QR',
      paymentDetails: `NETS QR Transaction Ref: ${req.query.txn_retrieval_ref || 'N/A'}`,
      paymentMethods: ['Credit/Debit card', 'Contactless payment (Apple Pay)', 'PayNow', 'PayPal', 'NETS QR'],
      orderId: purchaseId,
      generatedAt: new Date()
    });
  });
});

// Handle NETS QR Failure
app.get('/nets-qr/fail', checkAuthenticated, (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

  // Clean up session
  delete req.session.checkoutData;
  delete req.session.appliedVoucher;

  res.render('netsTxnFailStatus', {
    errorMsg: 'Your NETS QR payment could not be processed.',
    responseCode: 'NETS_QR_FAILED'
  });
});

// ==================== End NETS QR Routes ====================

// --------------------- Start the server ---------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});