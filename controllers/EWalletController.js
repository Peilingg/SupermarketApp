const EWallet = require('../models/EWallet');
const User = require('../models/User');
const RefundRequest = require('../models/RefundRequest');

const EWalletController = {
  // View e-wallet dashboard
  viewWallet: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    User.getById(sessionUser.userId, (userErr, user) => {
      if (userErr || !user) {
        req.flash && req.flash('error', 'Failed to load wallet data');
        return res.render('ewallet', { 
          user: sessionUser, 
          ewallet_balance: 0, 
          points_balance: 0,
          store_credit: 0,
          auto_convert_points: 0,
          lastTopupMethod: '—',
          lastTopupDate: null,
          transactions: [],
          pointsTransactions: [],
          conversionRate: 100
        });
      }

        EWallet.getTransactions(sessionUser.userId, 50, (txnErr, transactions) => {
          const txns = transactions || [];
          // Find the most recent completed top-up (already sorted DESC by DB)
          const lastTopup = txns.find(t => t && t.transactionType === 'top_up' && t.status === 'completed');
          const lastTopupMethod = lastTopup ? (lastTopup.paymentMethod || 'Top-up') : '—';
          const lastTopupDate = lastTopup ? lastTopup.createdAt : null;

          EWallet.getPointsTransactions(sessionUser.userId, 50, (ptxnErr, pointsTransactions) => {
            // Fetch store credit transactions
            EWallet.getStoreCreditTransactions(sessionUser.userId, 50, (scTxnErr, storeCreditTransactions) => {
              RefundRequest.listByUser(sessionUser.userId, (refundErr, refunds) => {
                return res.render('ewallet', {
                  user: user,
                  ewallet_balance: user.ewallet_balance || 0,
                  points_balance: user.points_balance || 0,
                  store_credit: user.store_credit || 0,
                  auto_convert_points: user.auto_convert_points || 0,
                  lastTopupMethod: lastTopupMethod,
                  lastTopupDate: lastTopupDate,
                  transactions: txns,
                  pointsTransactions: pointsTransactions || [],
                  storeCreditTransactions: storeCreditTransactions || [],
                  refunds: refunds || [],
                  conversionRate: 100 // 100 points = $1
                });
              });
            });
          });
        });
    });
  },

  // Show top-up form
  showTopup: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    User.getById(sessionUser.userId, (userErr, user) => {
      const paymentMethods = ['Credit/Debit card', 'PayPal', 'NETS QR'];
      
      return res.render('topupWallet', {
        user: user || sessionUser,
        paymentMethods,
        ewallet_balance: (user && user.ewallet_balance) || 0,
        paypalClientId: process.env.PAYPAL_CLIENT_ID
      });
    });
  },

  // Process top-up payment
  processTopup: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const paymentMethod = req.body.paymentMethod || 'Credit/Debit card';
    const topupAmount = parseFloat(req.body.topupAmount || 0);

    console.log('=== TOPUP PROCESS DEBUG ===');
    console.log('Payment Method:', paymentMethod);
    console.log('Top-up Amount:', topupAmount);
    console.log('All req.body:', req.body);

    if (!topupAmount || topupAmount <= 0) {
      req.flash && req.flash('error', 'Please enter a valid amount');
      return res.redirect('/ewallet/topup');
    }

    if (topupAmount > 10000) {
      req.flash && req.flash('error', 'Maximum top-up amount is $10,000');
      return res.redirect('/ewallet/topup');
    }

    // Validate credit/debit card if selected
    if (paymentMethod === 'Credit/Debit card') {
      const { cardholderName, cardNumber, expiryDate, cvv } = req.body;
      
      console.log('Card validation - Name:', cardholderName, 'Number:', cardNumber);
      
      // Validate cardholder name
      if (!cardholderName || !cardholderName.trim()) {
        req.flash && req.flash('error', 'Cardholder name is required');
        return res.redirect('/ewallet/topup');
      }

      // Validate card number (exactly 16 digits)
      const cleanCardNumber = cardNumber ? cardNumber.replace(/\s/g, '') : '';
      if (!/^\d{16}$/.test(cleanCardNumber)) {
        req.flash && req.flash('error', 'Card number must be 16 digits');
        return res.redirect('/ewallet/topup');
      }

      // Validate expiry date format (MM/YY) and not expired
      if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
        req.flash && req.flash('error', 'Expiry date must be in MM/YY format');
        return res.redirect('/ewallet/topup');
      }

      const [month, year] = expiryDate.split('/');
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear() % 100; // Get last 2 digits
      const currentMonth = currentDate.getMonth() + 1; // Months are 0-indexed
      const cardYear = parseInt(year);
      const cardMonth = parseInt(month);

      if (cardYear < currentYear || (cardYear === currentYear && cardMonth < currentMonth)) {
        req.flash && req.flash('error', 'Card has expired');
        return res.redirect('/ewallet/topup');
      }

      // Validate CVV (3-4 digits)
      if (!/^\d{3,4}$/.test(cvv)) {
        req.flash && req.flash('error', 'CVV must be 3-4 digits');
        return res.redirect('/ewallet/topup');
      }

      console.log('✓ Credit card validation passed for:', cardholderName);
    }

    // Store topup data in session
    req.session.topupData = {
      userId: sessionUser.userId,
      amount: topupAmount,
      paymentMethod: paymentMethod,
      timestamp: new Date()
    };

    console.log('About to process - Payment Method is:', paymentMethod);

    // Save session and redirect to payment method specific pages
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        req.flash && req.flash('error', 'Session error. Please try again.');
        return res.redirect('/ewallet/topup');
      }

      // Redirect to payment method specific pages
      if (paymentMethod === 'PayPal') {
        console.log('Redirecting to PayPal');
        return res.redirect('/ewallet/topup/paypal');
      } else if (paymentMethod === 'NETS QR') {
        console.log('Redirecting to NETS QR');
        return res.redirect('/ewallet/topup/nets-qr');
      } else {
        console.log('Processing Credit/Debit card - adding funds directly');
        // Credit/Debit card: automatically add funds (no confirmation page needed)
        const transactionId = `TOPUP-${Date.now()}`;
        EWallet.addFunds(sessionUser.userId, topupAmount, paymentMethod, transactionId, (err, result) => {
          if (err) {
            console.error('Failed to add funds:', err);
            req.flash && req.flash('error', 'Failed to complete top-up');
            return res.redirect('/ewallet/topup');
          }

          console.log('✓ Funds added successfully, redirecting to /ewallet');
          req.flash && req.flash('success', `Successfully topped up $${parseFloat(topupAmount).toFixed(2)} to your e-wallet`);
          return res.redirect('/ewallet');
        });
      }
    });
  },

  // Confirm top-up (after payment)
  confirmTopup: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const transactionId = req.body.transactionId;
    const topupAmount = req.body.topupAmount;

    if (!transactionId || !topupAmount) {
      req.flash && req.flash('error', 'Invalid top-up request');
      return res.redirect('/ewallet');
    }

    // Add funds to wallet
    EWallet.addFunds(sessionUser.userId, parseFloat(topupAmount), 'Manual Confirmation', transactionId, (err, result) => {
      if (err) {
        console.error('Failed to add funds:', err);
        req.flash && req.flash('error', 'Failed to complete top-up');
        return res.redirect('/ewallet');
      }

      req.flash && req.flash('success', `Successfully topped up $${parseFloat(topupAmount).toFixed(2)} to your e-wallet`);
      return res.redirect('/ewallet');
    });
  },

  // Convert points to store credit
  convertPoints: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const pointsToConvert = parseInt(req.body.pointsAmount || 0);

    if (!pointsToConvert || pointsToConvert <= 0) {
      req.flash && req.flash('error', 'Please enter valid points amount');
      return res.redirect('/ewallet');
    }

    if (pointsToConvert % 100 !== 0) {
      req.flash && req.flash('error', 'Points must be in multiples of 100');
      return res.redirect('/ewallet');
    }

    EWallet.convertPointsToCredit(sessionUser.userId, pointsToConvert, (err, result) => {
      if (err) {
        console.error('Conversion error:', err);
        req.flash && req.flash('error', err.message || 'Failed to convert points');
        return res.redirect('/ewallet');
      }

      req.flash && req.flash('success', `Successfully converted ${pointsToConvert} points to $${result.creditAmount} store credit`);
      return res.redirect('/ewallet');
    });
  },

  // Toggle auto-convert points preference
  toggleAutoConvert: function(req, res) {
    const sessionUser = req.session && req.session.user;
    if (!sessionUser || !sessionUser.userId) return res.redirect('/login');

    const enabled = (req.body && (req.body.enabled === 'true' || req.body.enabled === 'on' || req.body.enabled === '1')) ? 1 : 0;
    const sql = 'UPDATE users SET auto_convert_points = ? WHERE userId = ?';
    require('../db').query(sql, [enabled, sessionUser.userId], (err) => {
      if (err) {
        console.error('Failed to update auto-convert preference:', err);
        req.flash && req.flash('error', 'Could not update preference');
      } else {
        req.flash && req.flash('success', `Auto-convert points ${enabled ? 'enabled' : 'disabled'}`);
      }
      return res.redirect('/ewallet');
    });
  }
};

module.exports = EWalletController;
