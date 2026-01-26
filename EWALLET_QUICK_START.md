# E-Wallet & Points System - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Update Database
Run the SQL migration file to add e-wallet tables:

```bash
mysql -u your_username -p your_database < EWALLET_SETUP.sql
```

This will:
- Add `ewallet_balance` column to users
- Add `points_balance` column to users
- Create `ewallet_transactions` table
- Create `points_transactions` table

### Step 2: Verify Files Are in Place
✅ Models:
- `models/EWallet.js`
- `models/User.js` (updated)

✅ Controllers:
- `controllers/EWalletController.js`

✅ Views:
- `views/ewallet.ejs`
- `views/topupWallet.ejs`

✅ Routes:
- Added to `app.js`

### Step 3: Test the Features
1. **Start your server:**
   ```bash
   node app.js
   ```

2. **Login as a user** and navigate to "💰 E-Wallet"

3. **Test Top-Up:**
   - Click "Top Up Wallet"
   - Enter amount (e.g., $100)
   - Select payment method
   - Complete payment

4. **Test Points:**
   - Make a purchase
   - Check invoice - should show "Points Earned"
   - Go to E-Wallet - points should be updated

5. **Test Conversion:**
   - In E-Wallet, convert 100+ points to store credit
   - Should see store credit updated

## 📋 Features Overview

| Feature | Rate | Details |
|---------|------|---------|
| **Points Earning** | 10 pts per $1 | Automatic on checkout |
| **Points to Credit** | 100 pts = $1 | Anytime conversion |
| **Top-Up Range** | $10 - $10,000 | Multiple payment methods |
| **Transaction History** | Full log | E-wallet & points |

## 🎯 User Workflows

### Workflow 1: Top Up & Purchase
```
1. User goes to E-Wallet
2. Clicks "Top Up Wallet"
3. Enters $100
4. Selects payment method
5. Completes payment
6. E-wallet shows $100
7. User shops and earns points
8. Points visible in E-Wallet
```

### Workflow 2: Convert Points to Credit
```
1. User accumulates points (e.g., 500 pts)
2. Goes to E-Wallet
3. In Points section, enters 500 points
4. Clicks "Convert"
5. 500 pts → $5.00 store credit
6. Store credit ready to use
```

### Workflow 3: Use Credit at Checkout
```
1. User adds items to cart
2. Goes to checkout
3. Sees store credit option
4. Toggles "Use Store Credit"
5. Total amount reduced by credit
6. Completes payment
7. Invoice shows credit used & remaining
8. Earns points on purchase
```

## 💻 Technical Overview

### Points Calculation
```javascript
// On every successful purchase
pointsEarned = Math.floor(subtotal * 10);

// Example:
// Subtotal: $50.00
// Points: 500
```

### Points to Credit Conversion
```javascript
// 100 points = $1.00
creditAmount = points / 100;

// Example:
// 100 points → $1.00
// 500 points → $5.00
```

### Database Tables

**ewallet_transactions**
- Tracks all top-ups, deductions, refunds
- Shows transaction type, amount, status, date

**points_transactions**
- Tracks points earned, spent, redeemed
- Shows description, purchase reference

## 🔍 How to Verify It's Working

### Check E-Wallet Dashboard
```
Visit: http://localhost:3000/ewallet
Should see:
- E-Wallet Balance: $X.XX
- Points Balance: Y
- Transaction history
- Points conversion form
```

### Check Invoice After Purchase
```
Should display:
- Points Earned: +X pts
- Store Credit Used: -$X.XX (if used)
- Remaining Store Credit: $X.XX
```

### Check Database
```sql
-- View user's e-wallet balance
SELECT userId, ewallet_balance, points_balance FROM users WHERE userId = 1;

-- View e-wallet transactions
SELECT * FROM ewallet_transactions WHERE userId = 1 ORDER BY createdAt DESC;

-- View points transactions
SELECT * FROM points_transactions WHERE userId = 1 ORDER BY createdAt DESC;
```

## ⚙️ Configuration

### Customize Points Rate
To change from 10 points per $1, edit in `app.js`:

**Line in checkout confirm:**
```javascript
const pointsEarned = Math.floor(subtotal * 10); // Change 10 to desired rate
```

**Line in EWallet model:**
```javascript
// For conversion rate (currently 100 points = $1)
const creditAmount = (points / 100).toFixed(2);
```

### Customize Top-Up Limits
In `controllers/EWalletController.js`:
```javascript
if (topupAmount > 10000) { // Change 10000 to desired max
  // ...
}
```

## 🐛 Troubleshooting

### Points Not Showing After Purchase
- Ensure database migration was run
- Check `points_transactions` table exists
- Verify EWallet model is imported correctly

### E-Wallet Route Not Working
- Ensure `EWalletController.js` exists in `/controllers`
- Verify routes are added to `app.js`
- Check for syntax errors: `node app.js`

### Balance Not Updating
- Try refreshing the page
- Check database directly for values
- Verify User model is fetching ewallet_balance

### Top-Up Payment Not Processing
- Verify payment method is configured
- Check session is being saved
- Look for errors in server console

## 📚 Additional Resources

- **Full Guide:** See `EWALLET_SETUP_GUIDE.md`
- **Summary:** See `EWALLET_IMPLEMENTATION_SUMMARY.md`
- **Database Schema:** See `EWALLET_SETUP.sql`

## ✅ Verification Checklist

- [ ] Database migration executed
- [ ] All new files present
- [ ] Server starts without errors
- [ ] Can navigate to `/ewallet`
- [ ] Can top up wallet
- [ ] Points earned on purchase
- [ ] Can convert points to credit
- [ ] Invoice shows points and credit info
- [ ] E-Wallet link appears in navbar for users

## 🎓 Example User Story

**As a customer:**
1. I register and login
2. I top up my e-wallet with $50 via credit card
3. I purchase items worth $30
4. I automatically earn 300 points (30 × 10)
5. Invoice shows "Points Earned: +300 pts"
6. I convert 100 points to $1 store credit
7. My points become 200 and store credit increases by $1
8. On next purchase, I use $1 store credit as payment

---

**Ready to go!** 🚀 Your e-wallet system is now fully integrated and ready to use.
