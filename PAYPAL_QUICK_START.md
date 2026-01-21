# PayPal Integration Quick Start

## 🚀 Quick Setup (5 minutes)

### 1. Add PayPal Credentials to `.env`
```env
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_id_here
PAYPAL_CLIENT_SECRET=your_secret_here
APP_URL=http://localhost:3000
```

Get credentials from: https://developer.paypal.com/dashboard/

### 2. Install Dependencies
```bash
npm install
```

### 3. Done! 🎉

## 💳 How to Use

1. Add items to cart
2. Click "Proceed to Checkout"
3. Select **PayPal** as payment method
4. Click **Confirm & Pay**
5. You'll be redirected to PayPal
6. Log in and approve payment
7. Invoice is generated!

## 🔧 What Was Added

### New Files
- `controllers/PayPalController.js` - Payment handling logic
- `.env.example` - Environment template
- `PAYPAL_INTEGRATION.md` - Full documentation

### Updated Files
- `app.js` - Added PayPal routes and imports
- `package.json` - Added PayPal SDK packages
- `views/confirmationPurchase.ejs` - Added PayPal option

### New Routes
- `POST /checkout/confirm` - Detects PayPal and routes accordingly
- `GET /paypal/create` - Create payment
- `GET /paypal/execute` - Process payment
- `GET /paypal/cancel` - Handle cancellation

## 📋 Features Included

✅ PayPal Sandbox mode for testing  
✅ Automatic purchase recording  
✅ Cart clearing after payment  
✅ Voucher discount support  
✅ Invoice generation  
✅ Transaction ID tracking  
✅ Error handling & logging  
✅ Session management  

## 🧪 Test It

### Using Sandbox Accounts
1. Go to: https://developer.paypal.com/dashboard/accounts/
2. Create test buyer account
3. Use that email to test checkout

### Test Card Details (if needed)
- Email: Your sandbox test account
- Password: Available in PayPal dashboard

## ⚠️ Important Notes

- Keep `.env` file **private** (add to `.gitignore`)
- Use **sandbox mode** for development
- Switch to **live mode** for production
- Requires **HTTPS** in production
- PayPal credentials in `.env` are required

## 📚 Full Documentation

See `PAYPAL_INTEGRATION.md` for detailed setup, troubleshooting, and production deployment.

## ❓ Common Issues

**"Missing PayPal credentials"**
→ Add `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to `.env`

**"Cannot find PayPal approval URL"**
→ Check PayPal credentials are correct

**"Payment failed"**
→ Check your internet connection and PayPal status

## 🎯 Next Steps

1. ✅ Update `.env` with PayPal credentials
2. ✅ Run `npm install`
3. ✅ Restart your server
4. ✅ Test payment flow
5. ✅ Go live when ready!

---
**Questions?** Check the full `PAYPAL_INTEGRATION.md` file or PayPal docs at developer.paypal.com
