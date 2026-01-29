# Voucher Code Audit Report

## Summary
This document provides a comprehensive audit of the voucher system implementation. Found **several potential issues** that may be causing vouchers not to work correctly.

---

## Architecture Overview

### Files Involved:
1. **Models**: `models/Voucher.js`, `models/UserVoucher.js` (referenced but not created)
2. **Controllers**: `controllers/VoucherController.js`
3. **Views**: `views/vouchers.ejs`, `views/cart.ejs`, `views/confirmationPurchase.ejs`
4. **Routes**: `app.js` (voucher routes and checkout logic)
5. **Database**: Tables `vouchers`, `user_vouchers`

---

## Issues Found

### 🔴 **CRITICAL ISSUE #1: UserVoucher.js Controller Does Not Exist**

**File**: `controllers/UserVoucherController.js`  
**Status**: Referenced in `app.js` line 13, but **file does not exist**

```javascript
// From app.js line 13
const UserVoucherController = require('./controllers/UserVoucherController');

// Routes using it:
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
```

**Impact**: These routes will crash with `Module not found` error.

---

### 🔴 **CRITICAL ISSUE #2: Dual Voucher Routes Cause Confusion**

**Routes Conflict**:
- `/uservouchers/*` - Uses missing `UserVoucherController.js`
- `/vouchers/*` - Uses existing `VoucherController.js`

**Problem**: Two sets of routes doing similar things. The system may be using one while the other is broken, causing inconsistency.

---

### 🟡 **ISSUE #3: Discount Calculation Logic May Be Flawed**

**File**: `controllers/VoucherController.js` lines 2-28

```javascript
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
```

**Issues**:
- Date comparison uses `Date.now()` (milliseconds) vs `getTime()` (milliseconds) - OK, but could be simpler
- **No console logging** - impossible to debug when discount calculation fails
- The `reason` field is returned but not displayed to users in most places
- Discounts > subtotal are capped at subtotal, but might need better handling

---

### 🟡 **ISSUE #4: Voucher Status Check Missing**

**File**: `controllers/VoucherController.js` line 95

```javascript
Voucher.findUserVoucherByCode(sessionUser.userId, code, (err, userVoucher) => {
  if (err || !userVoucher) {
    req.flash && req.flash('error', 'Voucher not found or not claimed.');
    return res.redirect('/vouchers');
  }
  if (userVoucher.status === 'used') {
    req.flash && req.flash('error', 'Voucher already used.');
    return res.redirect('/vouchers');
  }
  // ... continues to apply voucher
```

**Missing Check**: No validation that `userVoucher.isActive` is true or that dates are valid. Should revalidate before applying.

---

### 🟡 **ISSUE #5: Store Credit Not Properly Integrated with Vouchers**

**File**: `app.js` lines 436-450

Voucher discount and store credit are handled **independently**. In the `checkoutData`:

```javascript
req.session.checkoutData = {
  items: mapped,
  subtotal, tax, shipping, total,
  appliedVoucher,
  voucherDiscount,
  storeCreditUsed: 0  // <-- Hardcoded to 0!
};
```

**Problem**: `storeCreditUsed` is always 0. Store credit balance is never deducted from the wallet.

**Location of issue**: [app.js](app.js#L449)

---

### 🟡 **ISSUE #6: Voucher Routes Not Clearly Documented**

**In `app.js`** (line 189-195):

```javascript
// Vouchers (user)
app.get('/vouchers', checkAuthenticated, (req, res) => {
    VoucherController.listForUser(req, res);
});

app.post('/vouchers/claim/:voucherId', checkAuthenticated, (req, res) => {
    VoucherController.claim(req, res);
});
```

**Missing Routes**:
- `app.post('/vouchers/apply', ...)` - Used in `vouchers.ejs` form but might not be defined
- `app.post('/vouchers/clear', ...)` - Used in checkout but might not be defined

---

### 🟡 **ISSUE #7: Voucher Validation on Apply Not Strict Enough**

**File**: `controllers/VoucherController.js` line 90-115

The apply function checks:
1. ✓ Voucher exists
2. ✓ Voucher is claimed
3. ✓ Voucher not already used

But **does NOT revalidate**:
- ✗ `isActive` flag
- ✗ Start/end dates
- ✗ Minimum spend requirement (happens later at checkout)

This means if a voucher becomes inactive after claiming, it will still apply at checkout.

---

### 🟡 **ISSUE #8: No Error Logging in Discount Calculation**

**File**: `app.js` lines 437-439

```javascript
const voucherCalc = VoucherController.computeDiscount(appliedVoucher, subtotal);
const voucherDiscount = +(voucherCalc.discount || 0).toFixed(2);
```

**Problem**: If `voucherCalc.reason` is set (meaning voucher is invalid), it's stored but:
- Not logged to console for debugging
- Not clearly displayed to user in most templates
- User might not understand why their voucher didn't apply

---

## Verification Checklist

### Database Schema Issues

Run this query to verify table structure:

```sql
DESCRIBE vouchers;
DESCRIBE user_vouchers;
```

**Expected columns in `vouchers`**:
- voucherId (INT, PK)
- code (VARCHAR, UNIQUE)
- description (TEXT)
- discountType (VARCHAR: 'amount' or 'percent')
- discountValue (DECIMAL)
- minSpend (DECIMAL)
- startDate (DATETIME)
- endDate (DATETIME)
- isActive (BOOLEAN/TINYINT)

**Expected columns in `user_vouchers`**:
- userVoucherId (INT, PK)
- userId (INT, FK)
- voucherId (INT, FK)
- status (VARCHAR: 'claimed', 'used')
- claimed_at (DATETIME)
- used_at (DATETIME)

---

## Testing Steps

### Test 1: Create and Claim Voucher
1. Login as admin
2. Create a voucher:
   - Code: `TEST10`
   - Type: `amount`
   - Value: `10`
   - Min Spend: `0`
   - Active: ✓
   - Dates: Today to 30 days from now
3. Login as regular user
4. Go to `/vouchers`
5. **Verify**: "Available to claim" section shows the voucher

### Test 2: Apply Voucher at Checkout
1. Add items to cart (subtotal > $0)
2. Go to `/vouchers`
3. Claim the `TEST10` voucher
4. Enter code and click "Apply"
5. **Verify**: Redirected to checkout with voucher applied
6. **Verify**: Discount of $10 appears in checkout summary

### Test 3: Check Voucher Usage
1. Complete a purchase with the voucher
2. Login to database and check:
   ```sql
   SELECT * FROM user_vouchers WHERE code = 'TEST10';
   ```
3. **Verify**: `status` = 'used' and `used_at` is set

### Test 4: Can't Reuse Voucher
1. Try to apply the same voucher again
2. **Verify**: Error message "Voucher already used"

---

## Quick Fixes (Priority Order)

### 🔴 FIX #1: Create Missing UserVoucherController.js

Either:
- **Option A**: Delete all `/uservouchers/*` routes from `app.js` and use `/vouchers/*` instead
- **Option B**: Create `UserVoucherController.js` as a copy of `VoucherController.js`

**Recommended**: Option A (consolidate into one set of routes)

---

### 🔴 FIX #2: Ensure Routes Exist in app.js

Add these routes if missing:

```javascript
// Apply voucher by code
app.post('/vouchers/apply', checkAuthenticated, (req, res) => {
    VoucherController.apply(req, res);
});

// Clear applied voucher
app.post('/vouchers/clear', checkAuthenticated, (req, res) => {
    VoucherController.clearApplied(req, res);
});

// Convert points to store credit
app.post('/ewallet/convert-points', checkAuthenticated, (req, res) => {
    EWalletController.convertPoints(req, res);
});
```

---

### 🟡 FIX #3: Add Validation Recheck in Apply Function

Modify `VoucherController.js` `apply` function:

```javascript
apply: function(req, res) {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.userId) return res.redirect('/login');
  const code = (req.body.code || '').trim();
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
    
    // ADD THIS: Revalidate voucher is still active
    if (!userVoucher.isActive) {
      req.flash && req.flash('error', 'This voucher is no longer active.');
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
    
    // Continue with applying voucher...
    req.session.appliedVoucher = { ... };
    req.flash && req.flash('success', 'Voucher applied successfully.');
    return res.redirect('/checkout');
  });
}
```

---

### 🟡 FIX #4: Add Debug Logging to Discount Calculation

Modify `computeDiscount` function:

```javascript
function computeDiscount(voucher, subtotal) {
  if (!voucher) {
    console.log('[VOUCHER DEBUG] No voucher provided');
    return { discount: 0, reason: 'No voucher' };
  }
  
  if (!voucher.isActive) {
    console.log('[VOUCHER DEBUG] Voucher inactive:', voucher.code);
    return { discount: 0, reason: 'Inactive voucher' };
  }

  const now = Date.now();
  if (voucher.startDate && new Date(voucher.startDate).getTime() > now) {
    console.log('[VOUCHER DEBUG] Voucher not started:', voucher.code, 'starts', voucher.startDate);
    return { discount: 0, reason: 'Voucher not started' };
  }
  
  if (voucher.endDate && new Date(voucher.endDate).getTime() < now) {
    console.log('[VOUCHER DEBUG] Voucher expired:', voucher.code, 'ended', voucher.endDate);
    return { discount: 0, reason: 'Voucher expired' };
  }

  if (Number(voucher.minSpend || 0) > subtotal) {
    console.log('[VOUCHER DEBUG] Min spend not met:', voucher.code, 'requires', voucher.minSpend, 'subtotal', subtotal);
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
  
  console.log('[VOUCHER DEBUG] Applied successfully:', voucher.code, 'type:', type, 'value:', val, 'discount:', discount);
  return { discount, reason: null };
}
```

---

### 🟡 FIX #5: Display Discount Reason in Checkout

Update `confirmationPurchase.ejs` to show why voucher didn't apply:

```html
<% if (voucherReason) { %>
  <div class="alert alert-warning">
    <strong>Voucher not applied:</strong> <%= voucherReason %>
  </div>
<% } else if (voucherDiscount > 0) { %>
  <div class="alert alert-success">
    <strong>Voucher applied:</strong> <%= voucher.code %> - Saving $<%= voucherDiscount.toFixed(2) %>
  </div>
<% } %>
```

---

## Summary Table

| Issue | Severity | Location | Type | Impact |
|-------|----------|----------|------|--------|
| UserVoucherController missing | 🔴 CRITICAL | `app.js:13` | File | Routes crash |
| Dual voucher routes confuse | 🔴 CRITICAL | `app.js:175-195` | Design | Inconsistency |
| No debug logging in discount | 🟡 Medium | `VoucherController.js:2` | Debug | Hard to troubleshoot |
| Voucher not revalidated on apply | 🟡 Medium | `VoucherController.js:90` | Logic | Inactive vouchers apply |
| Store credit hardcoded to 0 | 🟡 Medium | `app.js:449` | Logic | Feature broken |
| Missing checkout routes | 🟡 Medium | `app.js` | Routes | Features missing |
| No error display in checkout | 🟡 Low | `confirmationPurchase.ejs` | UI | UX issue |

---

## Recommended Action Plan

1. **IMMEDIATELY**: Check if `UserVoucherController.js` exists. If not, consolidate routes.
2. **Check**: Verify all routes defined in `app.js` for `/vouchers/*` and `/ewallet/*`
3. **Fix**: Add revalidation to voucher apply function
4. **Add**: Debug logging to `computeDiscount` function
5. **Fix**: Update store credit handling in checkout
6. **Test**: Run through complete user journey

---

## Debug Command

Run this in your Node.js terminal to test discount calculation:

```javascript
const VoucherController = require('./controllers/VoucherController');

const testVoucher = {
  code: 'TEST10',
  isActive: true,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2026-12-31'),
  minSpend: 0,
  discountType: 'amount',
  discountValue: 10
};

const result = VoucherController.computeDiscount(testVoucher, 100);
console.log('Discount result:', result);
// Expected: { discount: 10, reason: null }
```

---

**End of Audit Report**
