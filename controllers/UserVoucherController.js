const Voucher = require('../models/Voucher');
const UserVoucher = require('../models/UserVoucher');

const UserVoucherController = {
  list: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');
    UserVoucher.listByUser(sessionUser.userId, (err, vouchers) => {
      if (err) {
        console.error('UserVoucher.list', err);
        req.flash && req.flash('error', 'Unable to load your vouchers.');
        return res.redirect('/vouchers');
      }
      return res.json(vouchers || []);
    });
  },

  claim: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');
    const voucherId = req.params.voucherId || req.body.voucherId;
    if (!voucherId) return res.redirect('/vouchers');

    UserVoucher.claim(sessionUser.userId, voucherId, (err) => {
      if (err) {
        req.flash && req.flash('error', 'Unable to claim voucher: ' + err.message);
      } else {
        req.flash && req.flash('success', 'Voucher claimed.');
      }
      return res.redirect('/vouchers');
    });
  },

  apply: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');
    const code = (req.body.code || '').trim();
    if (!code) {
      req.flash && req.flash('error', 'Enter a voucher code to apply.');
      return res.redirect('/vouchers');
    }
    UserVoucher.findByCode(sessionUser.userId, code, (err, userVoucher) => {
      if (err || !userVoucher) {
        req.flash && req.flash('error', 'Voucher not found or not claimed.');
        return res.redirect('/vouchers');
      }
      if (userVoucher.status === 'used') {
        req.flash && req.flash('error', 'Voucher already used.');
        return res.redirect('/vouchers');
      }
      // store minimal info in session
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
      req.flash && req.flash('success', 'Voucher applied.');
      return res.redirect('/checkout');
    });
  },

  clear: function(req, res) {
    delete req.session.appliedVoucher;
    req.flash && req.flash('success', 'Voucher removed.');
    return res.redirect('/checkout');
  },

  markUsed: function(userVoucherId, callback) {
    UserVoucher.markUsed(userVoucherId, callback);
  },

  computeDiscount: Voucher.computeDiscount
};

module.exports = UserVoucherController;
