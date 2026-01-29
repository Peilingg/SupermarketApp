# Voucher Dropdown Feature - Visual Guide

## 🎨 UI Layout

### Checkout Page Layout (New)

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFIRM PURCHASE                         │
└─────────────────────────────────────────────────────────────┘

┌─ LEFT SIDE ────────────────┐    ┌─ RIGHT SIDE ──────────────┐
│                            │    │                           │
│ Bill to                    │    │ Subtotal:        $50.00   │
│ ─────────────────────      │    │ Tax:             $ 3.50   │
│ Name: Mary Tan             │    │ Shipping:        $ 5.00   │
│ Email: mary@...            │    │ Voucher (D22):  -$ 0.80   │
│ Address: Pasir Ris Ave 3   │    │ ─────────────────────────┤
│ Contact: 12345678          │    │ Total:          $57.70    │
│                            │    │                           │
│ Payment Methods:           │    │ ┌─ Select a voucher ─┐  │
│ ◉ Credit/Debit card        │    │ │ Your available:    │  │
│ ◯ E-Wallet                 │    │ ├─────────────────────┤  │
│ ◯ PayPal                   │    │ │▼ D22 (-$0.80)   ✓  │  │
│ ◯ NETS QR                  │    │ │ SAVE10 (-$10)      │  │
│                            │    │ │ SAVE20 (20%)       │  │
│ [ Manage vouchers ]        │    │ │ -- No Voucher --   │  │
│                            │    │ │                    │  │
│                            │    │ [ Apply Selected ]  │  │
│                            │    │ └────────────────────┘  │
│                            │    │                         │
│                            │    │ [Confirm & Pay]       │
│                            │    │ [Edit Cart]           │
│                            │    │                         │
└────────────────────────────┘    └──────────────────────────┘
```

---

## 📱 Feature Breakdown

### Before: Manual Code Entry
```
┌─────────────────────────────────────────┐
│ Manage vouchers                         │
│ [Button: Takes you to /vouchers page]   │
│                                         │
│ (User must:)                            │
│ 1. Click "Manage vouchers"              │
│ 2. Remember or find voucher code       │
│ 3. Enter code manually                  │
│ 4. Go back to checkout                  │
│ 5. See updated total                    │
└─────────────────────────────────────────┘
```

### After: Visual Dropdown
```
┌─────────────────────────────────────────┐
│ Select a voucher                        │
│ ┌─────────────────────────────────────┐ │
│ │▼ D22 (-$0.80)                   ✓  │ │
│ │ SAVE10 (-$10)                      │ │
│ │ SAVE20 (20%)                       │ │
│ │ -- No Voucher --                   │ │
│ └─────────────────────────────────────┘ │
│ [Apply Selected Voucher]                │
│                                         │
│ Manage vouchers                         │
│ [Button: To claim new vouchers]         │
└─────────────────────────────────────────┘
```

---

## 🔄 User Flow Diagram

```
START: Checkout Page Loaded
│
├─ Has Claimed Vouchers?
│  │
│  ├─ YES: Show Dropdown
│  │  │
│  │  ├─ User Selects Voucher
│  │  │  │
│  │  │  └─ Click "Apply Selected"
│  │  │     │
│  │  │     ├─ Send AJAX to /vouchers/apply
│  │  │     │
│  │  │     ├─ Server applies voucher
│  │  │     │
│  │  │     └─ Page reloads with new total
│  │  │
│  │  └─ User Proceeds to Payment
│  │     │
│  │     └─ Voucher discount applied ✓
│  │
│  └─ NO: Hide Dropdown
│     │
│     └─ Show "Manage vouchers" button only
│        │
│        └─ User clicks to claim vouchers
│
END: Payment Processed
```

---

## 📊 Data Flow

```
DATABASE
    │
    ├─ vouchers (all available)
    │  ├─ voucherId
    │  ├─ code
    │  ├─ description
    │  ├─ discountType (amount/percent)
    │  ├─ discountValue
    │  ├─ minSpend
    │  ├─ startDate, endDate
    │  └─ isActive
    │
    └─ user_vouchers (claimed by user)
       ├─ userVoucherId
       ├─ userId ◄─── CURRENT USER
       ├─ voucherId
       └─ status ('claimed' or 'used')


APP.JS /checkout Route
    │
    ├─ Fetch user's cart items
    ├─ Calculate subtotal, tax, shipping
    ├─ Get applied voucher from session
    ├─ Calculate voucher discount
    │
    └─ NEW: Fetch claimed vouchers
       │
       └─ Filter status = 'claimed'
          │
          └─ Pass to view as claimedVouchers[]


CONFIRMATIONPURCHASE.EJS View
    │
    ├─ Show order summary
    ├─ Show payment methods
    │
    └─ NEW: Show Dropdown
       │
       ├─ Loop through claimedVouchers
       ├─ Create <option> for each
       └─ Set selected on currently applied


USER SELECTS & CLICKS "APPLY"
    │
    └─ JavaScript AJAX
       │
       └─ POST to /vouchers/apply
          │
          └─ Server applies to session.appliedVoucher
             │
             └─ Page reloads
                │
                └─ New total displayed ✓
```

---

## 🎯 State Management

### Session Storage

```javascript
// Before selecting voucher:
req.session.appliedVoucher = {
  code: 'D22',
  discountValue: 0.80,
  discountType: 'amount',
  // ... other properties
}

// User selects SAVE10 and clicks Apply
// → POST /vouchers/apply with code='SAVE10'

// After applying:
req.session.appliedVoucher = {
  code: 'SAVE10',
  discountValue: 10,
  discountType: 'amount',
  // ... other properties
}

// User selects "-- No Voucher --"
// → POST /vouchers/clear
// → delete req.session.appliedVoucher
```

---

## 🔐 Validation Flow

```
User Selects Voucher
│
└─ Click "Apply Selected Voucher"
   │
   ├─ FRONTEND (JavaScript)
   │  └─ Get selected code from dropdown
   │
   └─ BACKEND (app.js → VoucherController.apply)
      │
      ├─ Verify user is logged in ✓
      ├─ Verify voucher code exists ✓
      ├─ Verify user claimed it ✓
      ├─ Verify status ≠ 'used' ✓
      │
      └─ IF ALL PASS:
         │
         ├─ Store in session.appliedVoucher
         │
         └─ Page reload shows new discount ✓
         
         ELSE:
         │
         └─ Error message displayed
            (Voucher expired, already used, etc.)
```

---

## 💾 Database Queries

### Query 1: Fetch Claimed Vouchers
```sql
SELECT 
  uv.userVoucherId,
  uv.status,
  uv.claimed_at,
  v.voucherId,
  v.code,
  v.description,
  v.discountType,
  v.discountValue,
  v.minSpend,
  v.startDate,
  v.endDate,
  v.isActive
FROM user_vouchers uv
LEFT JOIN vouchers v ON uv.voucherId = v.voucherId
WHERE uv.userId = 1 AND uv.status = 'claimed'
ORDER BY uv.claimed_at DESC;

Results Example:
┌──────────────┬────────┬────────────────────────┐
│ code         │ discount | description            │
├──────────────┼────────┼────────────────────────┤
│ SAVE10       │ $10    │ Save $10 off           │
│ SAVE20       │ 20%    │ 20% off purchase       │
│ D22          │ $0.80  │ Summer Deal            │
└──────────────┴────────┴────────────────────────┘
```

### Query 2: After User Applies Voucher
```sql
-- Mark old voucher as used (when purchase completed)
UPDATE user_vouchers 
SET status = 'used', used_at = NOW() 
WHERE userVoucherId = X;

-- So next checkout, it won't appear in dropdown
SELECT ... WHERE status = 'claimed' -- ← Now excludes used ones
```

---

## 🎨 UI Component Code Structure

```
confirmationPurchase.ejs
│
├─ Voucher Dropdown Card
│  │
│  ├─ Card Header
│  │  └─ "Select a voucher"
│  │
│  ├─ Card Body
│  │  │
│  │  ├─ Label: "Your available vouchers:"
│  │  │
│  │  ├─ Select Dropdown (id="voucherSelect")
│  │  │  │
│  │  │  ├─ <option value="">-- No Voucher --</option>
│  │  │  │
│  │  │  └─ <% claimedVouchers.forEach() %>
│  │  │     │
│  │  │     ├─ <option value="SAVE10">
│  │  │     │   SAVE10 - Save $10 (-$10.00)
│  │  │     │ </option>
│  │  │     │
│  │  │     └─ ... repeat for each voucher
│  │  │
│  │  └─ Button (id="applyVoucherBtn")
│  │     └─ "Apply Selected Voucher"
│  │
│  └─ Bootstrap Classes
│     ├─ card, mb-3, border-info
│     ├─ card-header, bg-light
│     ├─ card-body
│     ├─ form-select
│     └─ btn btn-sm btn-primary w-100
│
└─ JavaScript (DOMContentLoaded)
   │
   └─ Event Listener on applyVoucherBtn
      │
      ├─ Get selected value
      ├─ If empty: POST /vouchers/clear
      └─ Else: POST /vouchers/apply with code
         │
         └─ Reload page on success
```

---

## 📈 Impact Summary

### Before Implementation
- 🔴 Users had to manually type voucher codes
- 🔴 Easy to make typos
- 🔴 Hard to see available options
- 🔴 Multiple clicks to switch vouchers

### After Implementation
- 🟢 One-click voucher selection
- 🟢 Visual list of all options
- 🟢 No typos possible
- 🟢 Easy voucher switching
- 🟢 See discount amount before applying
- 🟢 Professional checkout experience

---

**Status**: ✅ Fully Implemented & Ready to Use
