const Product = require('../models/Product');

// simple categories list — adjust to match your app or replace with DB-driven list
const CATEGORIES = ['Grocery', 'Beverages', 'Household', 'Personal Care', 'Other'];

const ProductController = {
    // list all products for inventory (admin view)
    listAll: function(req, res) {
        Product.getAll(function(err, products) {
            if (err) {
                console.error('ProductController.listAll - DB error:', err);
                return res.status(500).render('inventory', { products: [], error: 'Database error' });
            }
            console.log('ProductController.listAll - products returned:', Array.isArray(products) ? products.length : typeof products);
            return res.render('inventory', { products, error: null });
        });
    },

    // list products for shopping view (all users)
    listForShopping: function(req, res) {
        Product.getAll(function(err, products) {
            if (err) {
                console.error('ProductController.listForShopping - DB error:', err);
                return res.status(500).render('shopping', { products: [], error: 'Database error' });
            }
            console.log('ProductController.listForShopping - products returned:', Array.isArray(products) ? products.length : typeof products);
            return res.render('shopping', { products, error: null });
        });
    },

    // get a product by ID -> render product.ejs
    getById: function(req, res) {
        const id = req.params.id;
        Product.getById(id, function(err, product) {
            if (err) { console.error(err); return res.status(500).render('product', { product: null, error: 'Database error' }); }
            if (!product) return res.status(404).render('product', { product: null, error: 'Product not found' });
            return res.render('product', { product, error: null });
        });
    },

    // helper used by cart route to fetch product and return via callback
    fetchForCart: function(req, res, cb) {
        const id = req.params.id;
        Product.getById(id, function(err, product) {
            if (err) return cb(err);
            if (!product) return cb(new Error('Product not found'));
            return cb(null, product);
        });
    },

    // render edit form
    getForEdit: function(req, res) {
        const id = req.params.id;
        Product.getById(id, function(err, product) {
            if (err) { console.error(err); return res.status(500).render('updateProduct', { product: null, categories: CATEGORIES, error: 'Database error' }); }
            if (!product) return res.status(404).render('updateProduct', { product: null, categories: CATEGORIES, error: 'Product not found' });
            return res.render('updateProduct', { product, categories: CATEGORIES, error: null });
        });
    },

    // add a new product
    add: function(req, res) {
        // multer file is in req.file; form fields in req.body
        console.log('ProductController.add - req.body:', req.body);
        console.log('ProductController.add - req.file:', req.file && req.file.filename);

        const image = req.file ? req.file.filename : (req.body.image || null);
        const product = {
            productName: req.body.productName,
            quantity: req.body.quantity,
            price: req.body.price,
            category: req.body.category || null,
            image: image,
            userId: req.body.userId || (req.session.user && req.session.user.userId) || null
        };

        Product.add(product, function(err, result) {
            if (err) {
                console.error('ProductController.add - DB error:', err);
                // render same form so user can correct; pass categories to populate dropdown
                return res.status(500).render('addProduct', { product, categories: CATEGORIES, error: 'Failed to add product' });
            }
            console.log('ProductController.add - insert OK, insertId:', result && result.insertId);
            // success -> redirect to inventory
            return res.redirect('/inventory');
        });
    },

    // update an existing product by ID
    update: function(req, res) {
        const id = req.params.id;
        const image = req.file ? req.file.filename : (req.body.image || req.body.currentImage || null);
        const product = {
            productName: req.body.productName,
            quantity: req.body.quantity,
            price: req.body.price,
            category: req.body.category || null,
            image: image,
            userId: req.body.userId || (req.session.user && req.session.user.userId) || null
        };

        Product.update(id, product, function(err, result) {
            if (err) { console.error('ProductController.update -', err); product.productId = id; return res.status(500).render('updateProduct', { product, categories: CATEGORIES, error: 'Failed to update product' }); }
            return res.redirect('/inventory');
        });
    },

    // delete a product by ID
    delete: function(req, res) {
        const id = req.params.id;
        Product.delete(id, function(err, result) {
            if (err) { console.error('ProductController.delete -', err); return res.status(500).render('inventory', { products: [], error: 'Failed to delete product' }); }
            return res.redirect('/inventory');
        });
    }
};

module.exports = ProductController;