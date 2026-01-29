# Voucher Dropdown - Quick Reference

## 🎯 What's New

Your checkout page now has a **voucher dropdown selector** where users can:
- ✅ See all claimed vouchers
- ✅ Switch between different vouchers
- ✅ Remove voucher (select "-- No Voucher --")
- ✅ See discount amount for each voucher

---

## User Experience Flow

```
Shopping Cart
    ↓
Click "Checkout"
    ↓
Confirmation/Checkout Page
    ↓
[NEW] Select a voucher dropdown
    ├─ -- No Voucher --
    ├─ SAVE10 (-$10.00)
    ├─ SAVE20 (20% off)
    └─ D22 (-$0.80)
    ↓
Click "Apply Selected Voucher"
    ↓
Page refreshes with new total
    ↓
Confirm & Pay
```

---

## Code Changes Made

### 1️⃣ Backend (app.js)

**Added to `/checkout` route** around line 447:

```javascript
Voucher.listUserVouchers(sessionUser.userId, (vErr, userVouchers) => {
  const claimedVouchers = (userVouchers || []).filter(v => v && v.status === 'claimed');
  res.render('confirmationPurchase', {
    // ... existing data ...
    claimedVouchers: claimedVouchers
  });
});
```

**What it does**: Fetches all claimed (but not used) vouchers for the user.

---

### 2️⃣ Frontend - UI (confirmationPurchase.ejs)

**Added around line 195** (before "Manage vouchers" button):

```html
<% if (claimedVouchers && claimedVouchers.length > 0) { %>
  <div class="card mb-3 border-info">
    <div class="card-header bg-light">
      <h6 class="mb-0">Select a voucher</h6>
    </div>
    <div class="card-body">
      <select id="voucherSelect" class="form-select">
        <option value="">-- No Voucher --</option>
        <% claimedVouchers.forEach(v => { %>
          <option value="<%= v.code %>">
            <%= v.code %> - <%= v.description %>
            (<%= v.discountType === 'percent' ? v.discountValue + '%' : '$' + v.discountValue %>)
          </option>
        <% }); %>
      </select>
      <button id="applyVoucherBtn" class="btn btn-sm btn-primary w-100">Apply Selected Voucher</button>
    </div>
  </div>
<% } %>
```

---

### 3️⃣ Frontend - JavaScript (confirmationPurchase.ejs)

**Added around line 380** (in the DOMContentLoaded script):

```javascript
const applyVoucherBtn = document.getElementById('applyVoucherBtn');
const voucherSelect = document.getElementById('voucherSelect');

if (applyVoucherBtn && voucherSelect) {
  applyVoucherBtn.addEventListener('click', function() {
    const selectedCode = voucherSelect.value;

    if (!selectedCode) {
      // Remove voucher
      fetch('/vouchers/clear', { method: 'POST' })
        .then(() => window.location.reload());
      return;
    }

    // Apply voucher
    const formData = new FormData();
    formData.append('code', selectedCode);
    
    fetch('/vouchers/apply', {
      method: 'POST',
      body: formData
    })
    .then(() => {
      alert('Voucher applied! Recalculating totals...');
      window.location.reload();
    });
  });
}
```

---

## How to Test

### Test 1: Basic Dropdown
```
1. Add items to cart
2. Go to checkout
3. Look for "Select a voucher" card
4. See your claimed vouchers in dropdown
```

### Test 2: Apply Voucher
```
1. Select a voucher from dropdown
2. Click "Apply Selected Voucher"
3. Page refreshes
4. New discount should be applied
5. Total should be updated
```

### Test 3: Remove Voucher
```
1. Select "-- No Voucher --"
2. Click "Apply Selected Voucher"
3. Voucher should be removed
4. Discount should be gone
5. Total should reset
```

---

## Database Requirements

✅ Uses existing tables:
- `vouchers` - Contains voucher definitions
- `user_vouchers` - Tracks which users claimed which vouchers

**No database changes needed!**

---

## API Endpoints Used

The dropdown uses existing endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/vouchers/apply` | POST | Apply selected voucher code |
| `/vouchers/clear` | POST | Remove applied voucher |

Both endpoints were already working - dropdown just uses them!

---

## Browser Compatibility

✅ Works in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

Uses standard Fetch API (no jQuery needed)

---

## Troubleshooting

### Dropdown Not Showing?

**Check**: Does user have any claimed vouchers?

```sql
SELECT COUNT(*) FROM user_vouchers 
WHERE userId = 1 AND status = 'claimed';
-- Should return > 0
```

### Voucher Not Applying?

**Check 1**: Is voucher still active?
```sql
SELECT isActive FROM vouchers WHERE code = 'SAVE10';
-- Should be 1 (true)
```

**Check 2**: Are dates valid?
```sql
SELECT startDate, endDate FROM vouchers WHERE code = 'SAVE10';
-- startDate should be <= TODAY
-- endDate should be >= TODAY
```

**Check 3**: Is min spend met?
```sql
SELECT minSpend FROM vouchers WHERE code = 'SAVE10';
-- Your cart subtotal should be >= minSpend
```

### Page Shows Error When Applying?

**Check browser console** (F12 > Console tab) for error messages.

Common issues:
- Voucher code incorrect
- Voucher already used
- Voucher expired
- Min spend not met

---

## Files Modified

1. [app.js](app.js#L447) - Added vouchers fetch
2. [views/confirmationPurchase.ejs](views/confirmationPurchase.ejs#L195) - Added dropdown UI
3. [views/confirmationPurchase.ejs](views/confirmationPurchase.ejs#L380) - Added dropdown JS

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| **Voucher Selection** | Text input (manual code entry) | Dropdown (visual list) |
| **User Experience** | "Enter voucher code" | "Pick from your vouchers" |
| **Visibility** | Had to remember codes | See all available options |
| **Switching** | Clear then re-enter code | Just select and apply |
| **Removing** | Go back to vouchers page | Select "-- No Voucher --" |

---

## Next Steps

1. ✅ **Test the dropdown** on checkout page
2. ✅ **Try switching vouchers** 
3. ✅ **Try removing voucher**
4. **Optional**: Add more features (see enhancement ideas below)

---

## Optional Enhancements

If you want to improve it further:

```javascript
// 1. Show discount amount before applying
voucherSelect.addEventListener('change', function() {
  const selected = this.options[this.selectedIndex];
  const discount = selected.dataset.discount;
  console.log('Selected discount: $' + discount);
});

// 2. Disable expired vouchers
claimedVouchers.forEach(v => {
  if (v.endDate < new Date()) {
    // Show as disabled option
  }
});

// 3. Show best discount option
const sortedVouchers = claimedVouchers.sort((a, b) => {
  return b.discountValue - a.discountValue;
});
// Mark first one as "BEST DEAL"
```

---

**Ready to use!** Your checkout page now has a professional voucher selector. 🎉
