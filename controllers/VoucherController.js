const Voucher = require('../models/Voucher');

function computeDiscount(voucher, subtotal) {
  if (!voucher) return { discount: 0, reason: 'No voucher' };
  if (!voucher.isActive) return { discount: 0, reason: 'Inactive voucher' };

  const now = Date.now();
  if (voucher.startDate && new Date(voucher.startDate).getTime() > now) {
    return { discount: 0, reason: 'Voucher not started' };
  }
  if (voucher.endDate && new Date(voucher.endDate).getTime() < now) {
    return { discount: 0, reason: 'Voucher expired' };
  }

  if (Number(voucher.minSpend || 0) > subtotal) {
    return { discount: 0, reason: 'Minimum spend not met' };
  }

  const type = (voucher.discountType || 'amount').toLowerCase();
  const val = Number(voucher.discountValue || 0);
  let discount = 0;
  if (type === 'percent') {
    discount = subtotal * (val / 100);
  } else {
    discount = val;
  }
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  return { discount, reason: null };
}

const VoucherController = {
  // User: list vouchers page
  listForUser: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    // Get cart item count to show/hide checkout button
    const CartItem = require('../models/CartItem');
    CartItem.listAll(sessionUser.userId, (cartErr, cartItems) => {
      const cartItemCount = cartItems ? cartItems.length : 0;

      Voucher.listClaimableForUser(sessionUser.userId, (err, available) => {
        if (err) {
          console.error('Voucher.listClaimableForUser', err);
          req.flash && req.flash('error', 'Unable to load vouchers.');
        }
        Voucher.listUserVouchers(sessionUser.userId, (uErr, mine) => {
          if (uErr) {
            console.error('Voucher.listUserVouchers', uErr);
            req.flash && req.flash('error', 'Unable to load your vouchers.');
          }
          return res.render('vouchers', {
            available: available || [],
            myVouchers: mine || [],
            applied: req.session.appliedVoucher || null,
            user: sessionUser,
            cartItemCount: cartItemCount
          });
        });
      });
    });
  },

  // User: claim a voucher
  claim: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');
    const voucherId = req.params.voucherId || req.body.voucherId;
    if (!voucherId) return res.redirect('/vouchers');

    Voucher.claim(sessionUser.userId, voucherId, (err) => {
      if (err) {
        req.flash && req.flash('error', 'Unable to claim voucher: ' + err.message);
      } else {
        req.flash && req.flash('success', 'Voucher claimed. You can apply it at checkout.');
      }
      return res.redirect('/vouchers');
    });
  },

  // User: apply voucher by code
  apply: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');
    const code = (req.body && req.body.code ? req.body.code : '').trim();
    if (!code) {
      req.flash && req.flash('error', 'Enter a voucher code to apply.');
      return res.redirect('/vouchers');
    }

    Voucher.findUserVoucherByCode(sessionUser.userId, code, (err, userVoucher) => {
      if (err || !userVoucher) {
        req.flash && req.flash('error', 'Voucher not found or not claimed.');
        return res.redirect('/vouchers');
      }
      if (userVoucher.status === 'used') {
        req.flash && req.flash('error', 'Voucher already used.');
        return res.redirect('/vouchers');
      }

      // Validate voucher against current cart
      const CartItem = require('../models/CartItem');
      CartItem.listAll(sessionUser.userId, (cartErr, items) => {
        if (cartErr || !items || items.length === 0) {
          req.flash && req.flash('error', 'Your cart is empty. Add items before applying a voucher.');
          return res.redirect('/vouchers');
        }

        // Calculate cart totals
        const mapped = items.map(it => {
          const price = Number(it.price || it.unitPrice || 0);
          const qty = Number(it.quantity || it.qty || 0);
          return { price, quantity: qty, lineTotal: price * qty };
        });
        const subtotal = mapped.reduce((s, i) => s + i.lineTotal, 0);
        const tax = subtotal * 0.07;
        const shipping = subtotal > 50 ? 0 : 5;
        const preVoucherTotal = subtotal + tax + shipping;

        // Calculate voucher discount
        const discountCalc = computeDiscount(userVoucher, subtotal);
        const voucherDiscount = discountCalc.discount || 0;

        // Check if voucher value is greater than or equal to pre-voucher total
        if (voucherDiscount >= preVoucherTotal) {
          req.flash && req.flash('error', 
            `Unable to use this voucher. The voucher value ($${voucherDiscount.toFixed(2)}) is greater than or equal to your order total ($${preVoucherTotal.toFixed(2)}). Please add more items to your cart or choose a different voucher.`
          );
          return res.redirect('/checkout');
        }

        // Check if voucher can be applied (minimum spend, etc.)
        if (discountCalc.reason) {
          req.flash && req.flash('error', `Unable to apply voucher: ${discountCalc.reason}`);
          return res.redirect('/checkout');
        }

        // store minimal info in session for checkout use
        req.session.appliedVoucher = {
          userVoucherId: userVoucher.userVoucherId,
          voucherId: userVoucher.voucherId,
          code: userVoucher.code,
          description: userVoucher.description,
          discountType: userVoucher.discountType,
          discountValue: userVoucher.discountValue,
          minSpend: userVoucher.minSpend,
          startDate: userVoucher.startDate,
          endDate: userVoucher.endDate,
          isActive: userVoucher.isActive
        };
        
        // Explicitly save session before redirecting to ensure it persists
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Failed to save session:', saveErr);
          }
          req.flash && req.flash('success', 'Voucher applied. It will be used at checkout if eligible.');
          return res.redirect('/checkout');
        });
      });
    });
  },

  // User: clear applied voucher
  clearApplied: function(req, res) {
    delete req.session.appliedVoucher;
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Failed to save session:', saveErr);
      }
      req.flash && req.flash('success', 'Voucher removed.');
      return res.redirect('/checkout');
    });
  },

  // Admin: list/manage
  adminList: function(req, res) {
    Voucher.getAll((err, vouchers) => {
      if (err) {
        console.error('Voucher.getAll', err);
        req.flash && req.flash('error', 'Unable to load vouchers.');
      }
      return res.render('adminVouchers', { vouchers: vouchers || [], user: req.session.user });
    });
  },

  // Admin: create
  adminCreate: function(req, res) {
    const payload = {
      code: req.body.code,
      description: req.body.description,
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      minSpend: req.body.minSpend,
      startDate: req.body.startDate ? new Date(req.body.startDate).toISOString().slice(0, 19).replace('T', ' ') : null,
      endDate: req.body.endDate ? new Date(req.body.endDate).toISOString().slice(0, 19).replace('T', ' ') : null,
      isActive: req.body.isActive === 'on' || req.body.isActive === '1' || req.body.isActive === 1
    };
    Voucher.create(payload, (err) => {
      if (err) {
        console.error('Voucher.create', err);
        req.flash && req.flash('error', 'Failed to create voucher.');
      } else {
        req.flash && req.flash('success', 'Voucher created.');
      }
      return res.redirect('/admin/vouchers');
    });
  },

  // Admin: update basic fields
  adminUpdate: function(req, res) {
    const id = req.params.id;
    const payload = {
      code: req.body.code,
      description: req.body.description,
      discountType: req.body.discountType,
      discountValue: req.body.discountValue,
      minSpend: req.body.minSpend,
      startDate: req.body.startDate ? new Date(req.body.startDate).toISOString().slice(0, 19).replace('T', ' ') : null,
      endDate: req.body.endDate ? new Date(req.body.endDate).toISOString().slice(0, 19).replace('T', ' ') : null,
      isActive: req.body.isActive === 'on' || req.body.isActive === '1' || req.body.isActive === 1
    };
    Voucher.update(id, payload, (err) => {
      if (err) {
        console.error('Voucher.update', err);
        req.flash && req.flash('error', 'Failed to update voucher.');
      } else {
        req.flash && req.flash('success', 'Voucher updated.');
      }
      return res.redirect('/admin/vouchers');
    });
  },

  // Admin: delete
  adminDelete: function(req, res) {
    const id = req.params.id;
    Voucher.delete(id, (err) => {
      if (err) {
        console.error('Voucher.delete', err);
        req.flash && req.flash('error', 'Failed to delete voucher.');
      } else {
        req.flash && req.flash('success', 'Voucher deleted.');
      }
      return res.redirect('/admin/vouchers');
    });
  },

  // Reuse discount logic for checkout controllers
  computeDiscount
};

module.exports = VoucherController;
