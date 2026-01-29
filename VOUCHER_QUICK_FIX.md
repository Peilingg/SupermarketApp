# Voucher System - Quick Fix Checklist

## 🎯 The Problem: Vouchers Not Working

Before applying any fixes, **identify which of these is your actual issue**:

---

## Quick Diagnosis (Choose ONE)

- [ ] **A**: Vouchers page loads but "Available to claim" is empty
- [ ] **B**: Can claim voucher, but can't apply it at checkout
- [ ] **C**: Applied voucher shows $0 discount instead of $X.XX
- [ ] **D**: Get error "Voucher not found or not claimed"
- [ ] **E**: Voucher applies but doesn't show in confirmation
- [ ] **F**: All above - entire system broken

---

## If You Chose A: "Available to claim" is empty

### Reason: No active vouchers exist

**Fix**:

1. **Login as admin**
2. **Go to**: `/admin/vouchers`
3. **Click**: "Add New Voucher"
4. **Fill**:
   - Code: `SAVE10`
   - Description: `Save $10`
   - Type: `amount`
   - Value: `10`
   - Min Spend: `0`
   - Start: Today
   - End: 30 days from now
   - **Active**: ✓ CHECK THIS BOX
5. **Click**: Create

Then go back to `/vouchers` - should see it now.

---

## If You Chose B: Can't apply voucher at checkout

### Reason: Missing form action or wrong controller

**Fix**:

1. **Open** [views/vouchers.ejs](views/vouchers.ejs#L82)

2. **Find** the form that submits voucher code (around line 82):
   ```html
   <form class="d-flex" method="POST" action="/vouchers/apply">
   ```

3. **If `action` is missing or wrong**, change it to:
   ```html
   <form class="d-flex" method="POST" action="/vouchers/apply">
   ```

4. **Verify in app.js** this route exists (should be around line 191):
   ```javascript
   app.post('/vouchers/apply', checkAuthenticated, (req, res) => {
       VoucherController.apply(req, res);
   });
   ```

---

## If You Chose C: Shows $0 discount

### Reason: One of these conditions is failing

**Checklist**:

1. **Is voucher Active?**
   ```sql
   SELECT code, isActive FROM vouchers WHERE code = 'YOURCODE';
   ```
   If `isActive` = 0, go admin panel and set Active ✓

2. **Are dates valid?**
   ```sql
   SELECT code, startDate, endDate FROM vouchers WHERE code = 'YOURCODE';
   ```
   - If `startDate` is in future - wait or change it
   - If `endDate` is in past - change it to future date

3. **Is minimum spend met?**
   ```sql
   SELECT code, minSpend FROM vouchers WHERE code = 'YOURCODE';
   ```
   - Your cart subtotal must be >= minSpend

4. **Is controller check missing?**
   
   Open [controllers/UserVoucherController.js](controllers/UserVoucherController.js#L35)
   
   In the `apply` function, add after line 49:
   ```javascript
   if (!userVoucher.isActive) {
     req.flash && req.flash('error', 'Voucher is no longer active.');
     return res.redirect('/vouchers');
   }
   
   const now = Date.now();
   if (userVoucher.startDate && new Date(userVoucher.startDate).getTime() > now) {
     req.flash && req.flash('error', 'Voucher has not started yet.');
     return res.redirect('/vouchers');
   }
   if (userVoucher.endDate && new Date(userVoucher.endDate).getTime() < now) {
     req.flash && req.flash('error', 'Voucher has expired.');
     return res.redirect('/vouchers');
   }
   ```

---

## If You Chose D: "Voucher not found or not claimed"

### Reason: Voucher doesn't exist OR you haven't claimed it

**Fix**:

1. **Check database**:
   ```sql
   SELECT code FROM vouchers;
   ```
   - If no results: Create vouchers first (see Fix A)
   - If has results: Go to `/vouchers` and claim it

2. **Make sure you claimed it**:
   ```sql
   SELECT v.code FROM user_vouchers uv
   LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
   WHERE uv.userId = 1;  -- Replace 1 with YOUR user ID
   ```
   - If empty: Go to `/vouchers` and click Claim
   - If has results: Try applying that code again

---

## If You Chose E: Voucher doesn't show in confirmation

### Reason: Session not storing voucher or display missing

**Fix**:

1. **Check session storage**:
   
   Add this to [app.js](app.js#L436) after line 436:
   ```javascript
   console.log('Applied voucher:', req.session.appliedVoucher);
   ```
   
   Go to checkout, check Node.js terminal output.
   - If shows `null`: Voucher is not applying
   - If shows object: Problem is display

2. **If it's null**: Review Fixes B, C, D above

3. **If it's an object**: Check [views/confirmationPurchase.ejs](views/confirmationPurchase.ejs)
   
   Look for:
   ```html
   <% if (voucherDiscount > 0) { %>
     <div>Discount: $<%= voucherDiscount.toFixed(2) %></div>
   <% } %>
   ```
   
   If missing, add it to the order summary section.

---

## If You Chose F: Entire system broken

### Complete the sequence:

**Step 1**: Check database
```sql
SELECT COUNT(*) FROM vouchers;
SELECT COUNT(*) FROM user_vouchers;
SHOW TABLES;
```
- If tables don't exist: Run [EWALLET_SETUP.sql](EWALLET_SETUP.sql) and [REFUND_SETUP.sql](REFUND_SETUP.sql)

**Step 2**: Restart server
```bash
# Kill current process
# Clear any cached modules
npm cache clean --force

# Start fresh
npm start
```

**Step 3**: Try Test Voucher Flow
- Admin creates test voucher
- User claims it
- User applies code at checkout
- Should see discount

**Step 4**: Check logs
- Open Node.js terminal
- Look for any red error messages
- Share them in a debugging session

**Step 5**: Check browser console
- Open browser (F12)
- Go to `/vouchers`
- Check Console tab for JavaScript errors

---

## Most Common Fixes

### Fix #1: Add Missing Validations
[UserVoucherController.js](controllers/UserVoucherController.js#L48)

After line 48 (status check), add:
```javascript
// Validate active and dates
if (!userVoucher.isActive) {
  req.flash && req.flash('error', 'This voucher is inactive.');
  return res.redirect('/vouchers');
}

const now = Date.now();
if (userVoucher.startDate && new Date(userVoucher.startDate).getTime() > now) {
  req.flash && req.flash('error', 'This voucher has not started yet.');
  return res.redirect('/vouchers');
}
if (userVoucher.endDate && new Date(userVoucher.endDate).getTime() < now) {
  req.flash && req.flash('error', 'This voucher has expired.');
  return res.redirect('/vouchers');
}
```

### Fix #2: Ensure Routes Exist in app.js

Check these lines exist around line 189-196:
```javascript
app.post('/vouchers/apply', checkAuthenticated, (req, res) => {
    VoucherController.apply(req, res);
});

app.post('/vouchers/clear', checkAuthenticated, (req, res) => {
    VoucherController.clearApplied(req, res);
});
```

If missing, add them.

### Fix #3: Verify EWallet Route Exists

Check if this route exists for the e-wallet convert points:
```javascript
app.post('/ewallet/convert-points', checkAuthenticated, (req, res) => {
    // Handle conversion - check if method exists in EWalletController
});
```

### Fix #4: Add Debug Logging

To [VoucherController.js](controllers/VoucherController.js#L2):

Replace the `computeDiscount` function start with:
```javascript
function computeDiscount(voucher, subtotal) {
  console.log('[VOUCHER] Computing discount for code:', voucher?.code);
  
  if (!voucher) {
    console.log('[VOUCHER] No voucher provided');
    return { discount: 0, reason: 'No voucher' };
  }
  
  if (!voucher.isActive) {
    console.log('[VOUCHER] Voucher inactive:', voucher.code);
    return { discount: 0, reason: 'Inactive voucher' };
  }
  
  // ... rest of function with more console.log statements ...
}
```

---

## Test After Each Fix

After applying each fix:

1. **Restart server**: Ctrl+C, then `npm start`
2. **Clear session**: Log out and log back in
3. **Test**: Go through the full voucher flow
4. **Check**: Node.js terminal for debug logs

---

## If Still Broken

Create test case:
```bash
curl -X GET http://localhost:3000/vouchers
# Check if page loads or shows errors
```

And provide:
1. Which error code (A, B, C, D, E, F)?
2. What fixes you already tried?
3. What error messages appear?
4. Terminal output from Node.js?

---

**Want code review?** I can check specific files if you describe:
- Current behavior
- Expected behavior  
- Error messages shown
- Which of A-F applies to you
