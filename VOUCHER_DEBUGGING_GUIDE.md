# Voucher Code Debugging Guide

## Quick Start: Finding the Issue

Your voucher system has **two separate implementations** working in parallel:
- **`VoucherController.js`** + **`Voucher.js`** (older approach)
- **`UserVoucherController.js`** + **`UserVoucher.js`** (newer approach)

This duplication **may be causing your issues**. Follow this guide to diagnose exactly where the problem is.

---

## Step 1: Check Your Database

First, verify your database tables have the correct data:

```sql
-- Check vouchers exist
SELECT voucherId, code, description, discountType, discountValue, minSpend, isActive, startDate, endDate 
FROM vouchers 
ORDER BY voucherId DESC;

-- Check if you've claimed any vouchers
SELECT uv.userVoucherId, uv.userId, uv.status, uv.claimed_at, uv.used_at, v.code, v.description
FROM user_vouchers uv
LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
WHERE uv.userId = 1;  -- Replace 1 with your user ID

-- Check for any inactive vouchers
SELECT * FROM vouchers WHERE isActive = 0;

-- Check for expired vouchers (assuming today is when you're testing)
SELECT * FROM vouchers WHERE endDate < NOW();
```

If these queries return **no results**, your vouchers haven't been created yet.

---

## Step 2: Test Your Voucher Routes (Using Browser or Postman)

### Test 2A: List Your Claimed Vouchers

**URL**: `http://localhost:3000/vouchers`

**Expected**: 
- Page loads with "Available to claim" and "Your vouchers" sections
- If you've never claimed one, "Your vouchers" section is empty

**If error**: Check browser console and Node.js terminal for error messages

---

### Test 2B: Create a Test Voucher (Admin Panel)

**URL**: `http://localhost:3000/admin/vouchers`

**Create a test voucher**:
- Code: `SAVE5`
- Description: `Save $5 off`
- Discount Type: `amount`
- Discount Value: `5`
- Min Spend: `0`
- Start Date: Today
- End Date: 30 days from now
- Active: ✓

**Expected**: Success message, redirect back to voucher list

---

### Test 2C: Claim the Voucher

**URL**: Go back to `http://localhost:3000/vouchers`

**Click "Claim"** on the SAVE5 voucher

**Expected**: 
- Success message: "Voucher claimed"
- Move to "Your vouchers" section

**If fails**: Check Node.js terminal for error. Look for any database errors.

---

### Test 2D: Apply Voucher at Checkout

1. **Add items to cart** with total > $5
2. **Go to checkout**: Add items, click "Proceed to Checkout"
3. **On confirmation page**: Look for applied voucher section
4. **Apply voucher**:
   - Go to `/vouchers` 
   - Enter code "SAVE5" 
   - Click "Apply"
5. **Expected**: Redirected to checkout with:
   - Discount amount: $5.00
   - New total: (original - 5)

---

## Step 3: Enable Debug Logging

Add this debug code to see what's happening:

### Add to `app.js` (around line 436, in the `/checkout` route):

```javascript
app.get('/checkout', checkAuthenticated, (req, res) => {
  // ... existing code ...
  
  const appliedVoucher = req.session.appliedVoucher || null;
  const voucherCalc = VoucherController.computeDiscount(appliedVoucher, subtotal);
  
  // ADD THESE DEBUG LOGS:
  console.log('=== CHECKOUT DEBUG ===');
  console.log('Applied Voucher:', JSON.stringify(appliedVoucher, null, 2));
  console.log('Subtotal:', subtotal);
  console.log('Voucher Calc Result:', JSON.stringify(voucherCalc, null, 2));
  console.log('==================');
  
  const voucherDiscount = +(voucherCalc.discount || 0).toFixed(2);
  // ... rest of code ...
});
```

### Restart your server and try checkout again

Check your **Node.js terminal** for output like:

```
=== CHECKOUT DEBUG ===
Applied Voucher: {
  userVoucherId: 1,
  voucherId: 1,
  code: "SAVE5",
  discountType: "amount",
  discountValue: 5,
  ...
}
Subtotal: 25
Voucher Calc Result: { discount: 5, reason: null }
==================
```

**If voucher is null**: Voucher never got applied at `/vouchers/apply`
**If discount is 0**: `computeDiscount` function is rejecting it. Check the `reason` field.

---

## Step 4: Common Issues & Solutions

### Issue 1: "Voucher not found or not claimed"

**Cause**: Either:
1. Voucher with that code doesn't exist in database
2. You haven't claimed it yet
3. Database query is failing

**Fix**:
```sql
-- Find all voucher codes
SELECT code FROM vouchers;

-- Find all vouchers claimed by you
SELECT v.code, uv.status FROM user_vouchers uv
LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
WHERE uv.userId = 1;  -- Replace with your user ID
```

---

### Issue 2: "Voucher already used"

**Cause**: You already used this voucher in a previous purchase

**Fix**: 
- Check database:
  ```sql
  SELECT * FROM user_vouchers WHERE userVoucherId = X;  -- Replace X with ID
  ```
- You'll see `status` = 'used' and `used_at` timestamp
- Try with a different voucher or create a new one

---

### Issue 3: Discount shows $0 even though voucher applied

**Cause**: One of these conditions is failing:
- `isActive = 0` (voucher disabled)
- `startDate > now` (voucher not started yet)
- `endDate < now` (voucher expired)
- `minSpend > subtotal` (you didn't spend enough)

**Fix**: Check the dates and settings:

```sql
SELECT code, isActive, startDate, endDate, minSpend FROM vouchers WHERE code = 'SAVE5';
```

Make sure:
- `isActive` = 1 ✓
- `startDate` ≤ TODAY ✓
- `endDate` ≥ TODAY ✓
- `minSpend` ≤ YOUR_SUBTOTAL ✓

---

### Issue 4: Page redirects to `/checkout` instead of `/vouchers/apply`

**Cause**: Controller method is returning incorrect redirect

**Check in `UserVoucherController.js`**:
```javascript
apply: function(req, res) {
  // ... validation ...
  req.session.appliedVoucher = { ... };
  req.flash && req.flash('success', 'Voucher applied.');
  return res.redirect('/checkout');  // <-- Should be /checkout for apply
}
```

This is **correct** - it should redirect to checkout after applying.

---

## Step 5: Database Schema Validation

**Run this to ensure tables exist and have correct structure**:

```sql
-- Check vouchers table
SHOW CREATE TABLE vouchers\G

-- Expected columns:
-- voucherId (INT, PRIMARY KEY, AUTO_INCREMENT)
-- code (VARCHAR, UNIQUE)
-- description (TEXT)
-- discountType (VARCHAR: 'amount' or 'percent')
-- discountValue (DECIMAL)
-- minSpend (DECIMAL)
-- startDate (DATETIME, nullable)
-- endDate (DATETIME, nullable)
-- isActive (TINYINT: 0 or 1)

-- Check user_vouchers table  
SHOW CREATE TABLE user_vouchers\G

-- Expected columns:
-- userVoucherId (INT, PRIMARY KEY, AUTO_INCREMENT)
-- userId (INT, FOREIGN KEY)
-- voucherId (INT, FOREIGN KEY)
-- status (VARCHAR: 'claimed' or 'used')
-- claimed_at (DATETIME)
-- used_at (DATETIME, nullable)
```

---

## Step 6: Test Discount Calculation Function Directly

**In Node.js terminal or test file**:

```javascript
const VoucherController = require('./controllers/VoucherController');

// Test 1: Valid voucher, should apply
const testVoucher1 = {
  code: 'SAVE5',
  isActive: 1,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2026-12-31'),
  minSpend: 0,
  discountType: 'amount',
  discountValue: 5,
  userVoucherId: 1
};

const result1 = VoucherController.computeDiscount(testVoucher1, 50);
console.log('Test 1 (valid, $50 subtotal):');
console.log(result1);
// Expected: { discount: 5, reason: null }

// Test 2: Minimum spend not met
const result2 = VoucherController.computeDiscount(testVoucher1, 2);
console.log('\nTest 2 (valid, but $2 subtotal):');
console.log(result2);
// Expected: { discount: 0, reason: 'Minimum spend not met' }

// Test 3: Expired voucher
const testVoucher3 = {
  ...testVoucher1,
  endDate: new Date('2020-01-01')  // Past date
};

const result3 = VoucherController.computeDiscount(testVoucher3, 50);
console.log('\nTest 3 (expired):');
console.log(result3);
// Expected: { discount: 0, reason: 'Voucher expired' }

// Test 4: Percent discount
const testVoucher4 = {
  ...testVoucher1,
  discountType: 'percent',
  discountValue: 10  // 10% off
};

const result4 = VoucherController.computeDiscount(testVoucher4, 100);
console.log('\nTest 4 (10% off $100):');
console.log(result4);
// Expected: { discount: 10, reason: null }
```

---

## Step 7: Check Session Storage

**Add to `confirmationPurchase.ejs` view** (after the form starts):

```html
<!-- DEBUG: Show what's in session -->
<script>
  console.log('Applied Voucher from server:', <%= JSON.stringify(voucher) %>);
  console.log('Voucher Discount:', <%= voucherDiscount %>);
  console.log('Voucher Reason:', '<%= voucherReason %>');
</script>
```

Open browser console (F12) and check if:
1. `Applied Voucher` shows your voucher object or `null`
2. `Voucher Discount` shows correct amount
3. `Voucher Reason` shows nothing (means it's valid) or explanation

---

## Step 8: Network Request Check

**In browser (F12 > Network tab)**:

1. **When applying voucher**: 
   - Should see POST to `/vouchers/apply`
   - Response: 302 redirect to `/checkout` ✓
   - OR: Form re-rendered with errors

2. **When at checkout**:
   - Should see GET `/checkout`
   - Page HTML should contain voucher info in the data

---

## Most Likely Issues (Based on Code Review)

### 🔴 **Most Likely #1: Routes Mismatch**

You have **TWO sets of voucher routes**:

```javascript
// Route Set 1 (NOT USED in views)
app.get('/uservouchers', ...)
app.post('/uservouchers/claim/:voucherId', ...)
app.post('/uservouchers/apply', ...)

// Route Set 2 (USED in views)
app.get('/vouchers', ...)
app.post('/vouchers/claim/:voucherId', ...)
app.post('/vouchers/apply', ...)  
app.post('/vouchers/clear', ...)
```

**Your views are using Route Set 2**, so that's correct.

**But check**: Does your `app.js` have **BOTH** routes defined? If yes, that's fine but redundant.

---

### 🔴 **Most Likely #2: Voucher Not Being Validated on Apply**

In `UserVoucherController.js` line 35-50, the `apply` function **does not check**:
- ✗ If voucher is still `isActive`
- ✗ If voucher dates are still valid
- ✗ If minimum spend is met

**Temporary Fix**: Add these checks:

```javascript
// In UserVoucherController.js apply function, after checking status === 'used':

// Validate voucher is still active and valid
const now = Date.now();
if (!userVoucher.isActive) {
  req.flash && req.flash('error', 'This voucher is no longer active.');
  return res.redirect('/vouchers');
}
if (userVoucher.startDate && new Date(userVoucher.startDate).getTime() > now) {
  req.flash && req.flash('error', 'This voucher has not started yet.');
  return res.redirect('/vouchers');
}
if (userVoucher.endDate && new Date(userVoucher.endDate).getTime() < now) {
  req.flash && req.flash('error', 'This voucher has expired.');
  return res.redirect('/vouchers');
}
```

---

### 🔴 **Most Likely #3: Missing EWallet Route**

In `ewallet.ejs` line 302-308, there's a form:

```html
<form action="/ewallet/convert-points" method="POST" class="d-flex gap-2">
```

But this route might not exist in `app.js`. 

**Check**: Search `app.js` for `/ewallet/convert-points`

**If missing**: Add to `app.js`:

```javascript
app.post('/ewallet/convert-points', checkAuthenticated, (req, res) => {
    EWalletController.convertPoints(req, res);
});
```

---

## Complete Testing Checklist

- [ ] Database has voucher records
- [ ] Can view vouchers list (`/vouchers`)
- [ ] Can claim a voucher
- [ ] Claimed voucher appears in "Your vouchers"
- [ ] Can apply voucher code at checkout
- [ ] Discount amount shown correctly
- [ ] Can't apply expired vouchers
- [ ] Can't apply below minimum spend
- [ ] Voucher marked as 'used' after purchase
- [ ] Can't reuse same voucher twice

---

## If Still Not Working

Run this comprehensive test:

```bash
# 1. Check if server is running
curl http://localhost:3000/shopping

# 2. Check if routes are registered (Node.js console)
console.log(app._router.stack.filter(r => r.route && r.route.path.includes('voucher')));

# 3. Check database connectivity
mysql -u root -p supermarket_db -e "SELECT COUNT(*) FROM vouchers;"
```

---

**Need more help?** Enable the debug logs from Step 3 and share:
1. Terminal output from Node.js
2. Browser console errors (F12)
3. Network requests (F12 > Network tab)
4. Database query results from Step 1
