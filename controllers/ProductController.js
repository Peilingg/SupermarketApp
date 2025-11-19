const Product = require('../models/Product');

const ProductController = {
    // list all products for inventory (admin view)
    listAll: function(req, res) {
        Product.getAll(function(err, products) {
            if (err) {
                console.error(err);
                return res.status(500).render('inventory', { products: [], error: 'Database error' });
            }
            return res.render('inventory', { products, error: null });
        });
    },

    // list products for shopping view (all users)
    listForShopping: function(req, res) {
        Product.getAll(function(err, products) {
            if (err) {
                console.error(err);
                return res.status(500).render('shopping', { products: [], error: 'Database error' });
            }
            return res.render('shopping', { products, error: null });
        });
    },

    // get a product by ID -> render product.ejs
    getById: function(req, res) {
        const id = req.params.id;
        Product.getById(id, function(err, product) {
            if (err) {
                console.error(err);
                return res.status(500).render('product', { product: null, error: 'Database error' });
            }
            if (!product) {
                return res.status(404).render('product', { product: null, error: 'Product not found' });
            }
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
            if (err) {
                console.error(err);
                return res.status(500).render('updateProduct', { product: null, error: 'Database error' });
            }
            if (!product) {
                return res.status(404).render('updateProduct', { product: null, error: 'Product not found' });
            }
            return res.render('updateProduct', { product });
        });
    },

    // add a new product
    add: function(req, res) {
        const image = req.file ? req.file.filename : (req.body.image || null);
        const product = {
            productName: req.body.productName,
            quantity: req.body.quantity,
            price: req.body.price,
            image: image,
            user_id: req.body.user_id || (req.session.user && req.session.user.id) || null
        };

        Product.add(product, function(err, result) {
            if (err) {
                console.error(err);
                return res.status(500).render('addProduct', { product, error: 'Failed to add product' });
            }
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
            image: image,
            user_id: req.body.user_id || (req.session.user && req.session.user.id) || null
        };

        Product.update(id, product, function(err, result) {
            if (err) {
                console.error(err);
                product.id = id;
                return res.status(500).render('updateProduct', { product, error: 'Failed to update product' });
            }
            return res.redirect('/inventory');
        });
    },

    // delete a product by ID
    delete: function(req, res) {
        const id = req.params.id;
        Product.delete(id, function(err, result) {
            if (err) {
                console.error(err);
                return res.status(500).render('inventory', { products: [], error: 'Failed to delete product' });
            }
            return res.redirect('/inventory');
        });
    }
};

module.exports = ProductController;