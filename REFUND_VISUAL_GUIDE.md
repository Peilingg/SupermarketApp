# Refund System - Visual Guide & Workflows

## User Journey: Request Refund

```
┌─────────────────────────────────────────────────────────┐
│                    USER DASHBOARD                        │
│                                                          │
│  Purchase History (/purchases)                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Order #123  |  $99.99  |  2024-01-15             │  │
│  │ View Invoice ✓                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    INVOICE PAGE                          │
│                  (/invoice route)                        │
│                                                          │
│  Invoice #123                                            │
│  ═══════════════════════════════════════════════════    │
│  Product 1          $50.00  x1    $50.00               │
│  Product 2          $45.00  x1    $45.00               │
│                                    ─────────            │
│  Total:                            $99.99              │
│                                                          │
│  [Continue Shopping]  [Print]  [Request Refund] ◄──┐   │
│                                                   │   │
│  "Amount to refund: $99.99"                      │   │
│  "Reason (optional): [____________]"             │   │
│  [Submit Refund Request]                         │   │
└─────────────────────────────────────────────────────────┘
                         ↓
          User Reason: "Changed mind"
                         ↓
          Refund Request Created (PENDING)
                         ↓
┌─────────────────────────────────────────────────────────┐
│              REFUND HISTORY PAGE                         │
│                 (/refundhistory)                         │
│                                                          │
│  Refund #456                                             │
│  Order ID: 123         Amount: $99.99                   │
│  Status: [PENDING]                                       │
│  Requested: 2024-01-16                                  │
│  Admin Notes: (awaiting review)                         │
│                                                          │
│  "Please wait for admin review..."                      │
└─────────────────────────────────────────────────────────┘
```

---

## Admin Journey: Process Refund

```
┌─────────────────────────────────────────────────────────┐
│               ADMIN DASHBOARD                            │
│                                                          │
│  [Inventory] [Users] [Orders] [Manage Refunds] ◄──┐   │
│                                                   │   │
│  Manage Refunds (/managerefunds)                 │   │
│  ═════════════════════════════════════════════════    │
│  [Pending] [Approved] [Rejected]                │   │
│                                                  │   │
│  ┌──────────────────────────────────────────┐  │   │
│  │ #456 | Customer: john | $99.99 | PENDING│  │   │
│  │ [View] [Approve] [Reject]               │  │   │
│  └──────────────────────────────────────────┘  │   │
│                                                  │   │
│  ┌──────────────────────────────────────────┐  │   │
│  │ #457 | Customer: jane | $150.00| PENDING│  │   │
│  │ [View] [Approve] [Reject]               │  │   │
│  └──────────────────────────────────────────┘  │   │
│                                                  │   │
└─────────────────────────────────────────────────┬───┘
                                                  │
                         ↓ (Click View)
                                                  │
┌─────────────────────────────────────────────────┴───┐
│            REFUND DETAIL PAGE                       │
│              (/refund/:refundId)                    │
│                                                     │
│  Refund #456 - PENDING                             │
│  ═════════════════════════════════════════════     │
│                                                     │
│  Customer Information:                              │
│  ├─ Name: john                                     │
│  ├─ Email: john@email.com                          │
│  └─ Order: #123                                    │
│                                                     │
│  Refund Details:                                    │
│  ├─ Amount: $99.99                                 │
│  └─ Reason: "Changed mind"                         │
│                                                     │
│  Order Items:                                       │
│  ├─ Product 1  $50.00  x1  =  $50.00              │
│  └─ Product 2  $45.00  x1  =  $45.00              │
│                                                     │
│  Admin Action:                                      │
│  ┌────────────────────────────────────────────┐   │
│  │ Decision: [Approve] [Reject]               │   │
│  │ Notes: [_______________________]           │   │
│  │        [Submit]                            │   │
│  └────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
       ↓ (Click Approve)                    ↓ (Click Reject)
```

---

## Refund Processing Flow

```
                    REFUND REQUEST SUBMITTED
                              │
                              ↓
                    ┌──────────────────┐
                    │  PENDING STATUS  │
                    └────────┬─────────┘
                             │
                    Admin Views in Dashboard
                             │
              ┌──────────────┴──────────────┐
              ↓                             ↓
        ADMIN APPROVES                ADMIN REJECTS
              │                             │
              ↓                             ↓
    ┌─────────────────┐          ┌─────────────────┐
    │ APPROVED STATUS │          │ REJECTED STATUS │
    └────────┬────────┘          └────────┬────────┘
             │                            │
             ↓                            ↓
    ADD STORE CREDIT          SEND REJECTION REASON
    TO USER ACCOUNT           TO USER (IN NOTES)
             │                            │
             ↓                            ↓
    User Sees Balance         User Sees Rejection
    Updated on Profile        Details in History
             │                            │
             ↓                            ↓
    Can Use Credit for      Can Re-apply or
    Future Purchases        Contact Admin
```

---

## Database Relationships

```
USERS TABLE
┌────────────────────────┐
│ userId (PK)            │
│ username               │
│ email                  │
│ ... other fields ...   │
│ store_credit (NEW) ◄───┼──┐
└────────────────────────┘  │
                             │
                             │ 1 user can have
PURCHASES TABLE              │ many refunds
┌────────────────────────┐   │
│ purchaseId (PK)        │   │
│ userId (FK) ────────────┘  │
│ ... other fields ...   │   │
└────────────────────────┘   │
     ↑                       │
     │ 1 purchase can        │
     │ have 1 refund        │
     │                       │
REFUND_REQUESTS TABLE (NEW) │
┌────────────────────────┐  │
│ refundRequestId (PK)   │  │
│ purchaseId (FK) ───────┘  │
│ userId (FK) ─────────────┘
│ reason                 │
│ status (pending/       │
│  approved/rejected)    │
│ requested_at           │
│ admin_notes            │
│ processed_at           │
└────────────────────────┘
```

---

## Status Lifecycle Diagram

```
                        ┌─────────────┐
                        │   CREATED   │
                        │   (Client   │
                        │   Submits)  │
                        └──────┬──────┘
                               │
                               ↓
                        ┌─────────────┐
                        │   PENDING   │
                        │  (Awaiting  │
                        │   Admin     │
                        │   Review)   │
                        └──────┬──────┘
                               │
                 ┌─────────────┴──────────────┐
                 │                           │
                 ↓                           ↓
          ┌────────────┐           ┌──────────────┐
          │  APPROVED  │           │   REJECTED   │
          │ (Credit    │           │ (Request     │
          │  Added)    │           │  Denied)     │
          └────────────┘           └──────────────┘
                 │                           │
                 ↓                           ↓
            User Can Use              User Can View
            Credit Balance             Rejection Reason
```

---

## Feature Comparison: Before & After

```
┌─────────────────────────────────────┬──────────────┬──────────────┐
│         FEATURE                     │    BEFORE    │    AFTER     │
├─────────────────────────────────────┼──────────────┼──────────────┤
│ Request Refund                      │      ✗       │      ✓       │
│ Track Refund Status                 │      ✗       │      ✓       │
│ Admin Manage Refunds                │      ✗       │      ✓       │
│ Issue Store Credit                  │      ✗       │      ✓       │
│ View Store Credit Balance           │      ✗       │      ✓       │
│ Admin Approval Workflow             │      ✗       │      ✓       │
│ Refund History                      │      ✗       │      ✓       │
│ Admin Notes/Tracking                │      ✗       │      ✓       │
│ Duplicate Prevention                │      ✗       │      ✓       │
│ Audit Trail                         │      ✗       │      ✓       │
└─────────────────────────────────────┴──────────────┴──────────────┘
```

---

## Data Flow: Refund Approval

```
1. USER SUBMITS REFUND
   ├─ POST /refund/request/:purchaseId
   ├─ Verify user owns purchase
   ├─ Check no duplicate refund exists
   └─ Create refund_requests row (PENDING)

2. ADMIN REVIEWS
   ├─ GET /managerefunds
   ├─ GET /refund/:refundId
   └─ Review customer & order details

3. ADMIN APPROVES
   ├─ POST /refund/:refundId/approve
   ├─ Validate refund is PENDING
   ├─ Fetch purchase total from purchases table
   ├─ UPDATE users SET store_credit = store_credit + total
   ├─ UPDATE refund_requests SET status = 'approved'
   └─ Set processed_at timestamp

4. USER SEES CHANGES
   ├─ GET /refundhistory → Status shows APPROVED
   ├─ GET /profile → store_credit balance increased
   └─ User can use credit on next purchase
```

---

## Navigation Map

```
┌─────────────────────────────────────────────────────┐
│              NAVBAR / MAIN MENU                      │
│                                                      │
│  REGULAR USERS              │    ADMIN USERS        │
│  ──────────────────────────────────────────────     │
│  [Shopping]                 │    [Inventory]        │
│  [Purchase History] ◄──┐    │    [Add Product]      │
│  [Refund Requests]  ◄──┤    │    [Manage Users]     │
│  [Vouchers]         ◄──┤    │    [Manage Orders]    │
│  [Profile]          ◄──┤    │    [Manage Refunds]   │
│  [Logout]              │    │    [Vouchers]         │
│                        │    │    [Logout]           │
└────────────────────────┼────────────────────────────┘
                         │
    ┌────────────────────┴──────────────────┐
    ↓                                       ↓
/purchases                            /managerefunds
(Show orders + refund button)          (Pending/Approved/
                                       Rejected list)
    ↓                                       ↓
/invoice                              /refund/:id
(Click "Request Refund")              (Approve/Reject)
    ↓
/refundhistory
(View refund status)
    ↓
/profile
(See store credit)
```

---

## Message & Notification Flow

```
USER ACTION              SYSTEM MESSAGE              RESULT
──────────────────────────────────────────────────────────
Request Refund       → "Refund requested"     → Redirected
(on invoice)            (Flash Message)        to /purchases

                                              Store credit
Admin Approves       → "Refund of $X.XX      → added to
                        approved & credited"   user account

                                              User can see
View Profile         → (no message needed)   → store credit
                                              balance

Admin Rejects        → Rejection notes      → User sees
                        available in history  reason in
                                             /refundhistory
```

---

## File Structure Tree

```
SupermarketApp/
├── models/
│   ├── RefundRequest.js ◄────── NEW
│   ├── User.js (UPDATED)
│   ├── Purchase.js
│   └── ... other models
│
├── controllers/
│   ├── RefundController.js ◄─── NEW
│   ├── UserController.js
│   └── ... other controllers
│
├── views/
│   ├── manageRefunds.ejs ◄───── NEW
│   ├── refundDetail.ejs ◄─────── NEW
│   ├── refundHistory.ejs ◄────── NEW
│   ├── invoice.ejs (UPDATED)
│   ├── profile.ejs (UPDATED)
│   ├── partials/
│   │   └── navbar.ejs (UPDATED)
│   └── ... other views
│
├── REFUND_SETUP.sql ◄─────────── NEW
├── REFUND_IMPLEMENTATION.md ◄─── NEW
├── REFUND_QUICK_SETUP.md ◄────── NEW
├── REFUND_SUMMARY.md ◄────────── NEW
└── REFUND_VISUAL_GUIDE.md ◄───── THIS FILE
```

---

## Quick Reference Icons

```
User Actions:
  📝 Request Refund      Submit refund request
  👁️ View Status         Check refund status
  💰 Store Credit        Use credit balance
  📋 History             View past requests

Admin Actions:
  📊 Dashboard           View all refunds
  👤 Customer Info       See user details
  ✅ Approve             Add store credit
  ❌ Reject              Deny refund
  📝 Notes               Add admin notes
  🔍 Audit Trail         Track changes

Status Indicators:
  ⏳ PENDING             Awaiting admin review
  ✓ APPROVED            Credit added
  ✗ REJECTED            Request denied
```

---

**This visual guide helps understand the refund system flow and data relationships. Refer to other documentation files for implementation details.**
