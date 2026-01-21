# Refund Handling Implementation Guide

## Overview
This document outlines the refund handling system added to the Supermarket MVC application. Users can now request refunds for their purchases, and admins can approve or reject those requests. Approved refunds are issued as store credit for future purchases.

---

## Features

### User-Side Features
1. **Request Refund** - Users can request a full refund for any completed purchase from the invoice page
2. **Track Refunds** - Users can view the status of all their refund requests
3. **Store Credit Balance** - Users can see their current store credit balance on their profile
4. **View Reason Status** - Users can track refund status with reason and admin notes

### Admin-Side Features
1. **Manage Refund Requests** - Admins can view all pending, approved, and rejected refunds
2. **Approve/Reject Refunds** - Admins can approve or reject refund requests with notes
3. **Add Admin Notes** - Provide feedback when approving or rejecting refunds
4. **Track Refund History** - View all refunds with their current status

---

## Database Setup

### Required Database Changes

Run the SQL script to update your database:

```sql
-- Add store_credit column to users table
ALTER TABLE users ADD COLUMN store_credit DECIMAL(10, 2) DEFAULT 0.00;

-- Create refund_requests table
CREATE TABLE IF NOT EXISTS refund_requests (
  refundRequestId INT AUTO_INCREMENT PRIMARY KEY,
  purchaseId INT NOT NULL,
  userId INT NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admin_notes TEXT,
  processed_at TIMESTAMP NULL,
  FOREIGN KEY (purchaseId) REFERENCES purchases(purchaseId) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_requested_at (requested_at),
  INDEX idx_userId (userId),
  INDEX idx_purchaseId (purchaseId)
);
```

### Steps:
1. Open your MySQL client or phpMyAdmin
2. Select your supermarket database
3. Run the SQL from `REFUND_SETUP.sql` file
4. Verify the new table and column are created

---

## File Structure

### New Files Created:

1. **Models**
   - `models/RefundRequest.js` - Database operations for refund requests

2. **Controllers**
   - `controllers/RefundController.js` - Business logic for refund handling

3. **Views**
   - `views/manageRefunds.ejs` - Admin dashboard for managing refund requests
   - `views/refundDetail.ejs` - Detailed view of a single refund request
   - `views/refundHistory.ejs` - User's refund request history

4. **Database**
   - `REFUND_SETUP.sql` - SQL script for database setup

### Updated Files:

1. **Models**
   - `models/User.js` - Added store credit methods:
     - `getStoreCredit()` - Get user's current store credit
     - `addStoreCredit()` - Add credit to account
     - `deductStoreCredit()` - Deduct credit from account

2. **Controllers**
   - `app.js` - Added refund routes and imported RefundController

3. **Views**
   - `views/invoice.ejs` - Added "Request Refund" button with modal
   - `views/profile.ejs` - Display store credit balance
   - `views/partials/navbar.ejs` - Added navigation links for refunds

---

## API Routes

### User Routes (Authenticated Users)

#### Request Refund
- **URL:** `POST /refund/request/:purchaseId`
- **Description:** Create a new refund request for a purchase
- **Parameters:** 
  - `purchaseId` (URL parameter)
  - `reason` (optional, form body)
- **Response:** Redirect to `/purchases` with flash message

#### View Refund History
- **URL:** `GET /refundhistory`
- **Description:** View all refund requests for the current user
- **Response:** Renders `refundHistory.ejs`

---

### Admin Routes (Admin Only)

#### List All Refunds
- **URL:** `GET /managerefunds`
- **Query Parameters:** `status=pending|approved|rejected|all` (default: pending)
- **Description:** View all refund requests with filtering
- **Response:** Renders `manageRefunds.ejs`

#### View Refund Details
- **URL:** `GET /refund/:refundId`
- **Description:** View detailed information about a specific refund request
- **Response:** Renders `refundDetail.ejs`

#### Approve Refund
- **URL:** `POST /refund/:refundId/approve`
- **Parameters:**
  - `refundId` (URL parameter)
  - `adminNotes` (optional, form body)
- **Description:** Approve refund and add store credit to user
- **Response:** Redirect to `/managerefunds` with flash message

#### Reject Refund
- **URL:** `POST /refund/:refundId/reject`
- **Parameters:**
  - `refundId` (URL parameter)
  - `adminNotes` (required, form body)
- **Description:** Reject refund request with reason
- **Response:** Redirect to `/managerefunds` with flash message

---

## User Flow

### For Regular Users:

1. User views purchase history (`/purchases`)
2. User clicks "Request Refund" button on any invoice
3. Modal opens with refund amount and optional reason field
4. User submits refund request
5. User can track refund status at `/refundhistory`
6. When admin approves, store credit is added to account
7. User sees updated store credit on profile (`/profile`)

### For Admins:

1. Admin navigates to `/managerefunds`
2. Filters by status: Pending, Approved, Rejected, or All
3. Clicks "View" to see full refund details
4. Admin can approve or reject with notes
5. Upon approval:
   - Refund amount is added to user's `store_credit`
   - Refund status changes to "approved"
   - User is notified (via status change in history)
6. Upon rejection:
   - Refund is marked as rejected
   - Admin notes explain the reason

---

## Data Models

### RefundRequest Schema

```javascript
{
  refundRequestId: Integer,        // Unique ID
  purchaseId: Integer,              // Foreign key to purchases
  userId: Integer,                  // Foreign key to users
  reason: String,                   // Customer's refund reason
  status: Enum,                     // 'pending', 'approved', 'rejected'
  requested_at: Timestamp,          // When refund was requested
  admin_notes: String,              // Admin's notes
  processed_at: Timestamp,          // When admin processed it
  refund_amount: Decimal,           // Full purchase total (from purchases table)
  username: String,                 // Customer username
  email: String,                    // Customer email
  purchase_date: Timestamp          // Original purchase date
}
```

### User Store Credit

The `users` table now includes:
- `store_credit` (DECIMAL(10,2)) - Current store credit balance

---

## Key Methods

### RefundRequest Model

- `create(purchaseId, userId, reason, callback)` - Create new refund request
- `getById(refundRequestId, callback)` - Get detailed refund info
- `listByUser(userId, callback)` - Get all refunds for a user
- `listAll(status, callback)` - Get all refunds (admin)
- `getByPurchaseId(purchaseId, callback)` - Get refund for a purchase
- `approve(refundRequestId, adminNotes, callback)` - Approve and issue credit
- `reject(refundRequestId, adminNotes, callback)` - Reject refund request
- `existsForPurchase(purchaseId, callback)` - Check if refund already exists

### User Model (New Methods)

- `getStoreCredit(userId, callback)` - Get user's current credit balance
- `addStoreCredit(userId, amount, callback)` - Add credit to account
- `deductStoreCredit(userId, amount, callback)` - Subtract credit from account

### RefundController Methods

- `requestRefund(req, res)` - Handle refund request creation
- `listByUser(req, res)` - Show user's refund history
- `listAll(req, res)` - Show all refunds (admin)
- `getDetail(req, res)` - Show refund details (admin)
- `approve(req, res)` - Approve refund (admin)
- `reject(req, res)` - Reject refund (admin)

---

## Business Logic

### Refund Request Creation
1. User must be authenticated and own the purchase
2. Check if refund already exists for this purchase
3. Create new refund request in "pending" status
4. User is redirected with success message

### Refund Approval
1. Admin views pending refund request
2. Admin clicks "Approve Refund"
3. System validates refund is still pending
4. Refund amount (full purchase total) is added to user's `store_credit`
5. Refund status changes to "approved"
6. `processed_at` timestamp is set
7. Admin notes are saved

### Refund Rejection
1. Admin provides reason in rejection notes
2. Refund status changes to "rejected"
3. `processed_at` timestamp is set
4. User can see rejection reason in refund history

---

## Security Considerations

1. **User Verification** - Users can only request refunds for their own purchases
2. **Admin Only** - Only admin users can approve/reject refunds
3. **Status Validation** - Can only process pending refunds
4. **Duplicate Prevention** - Only one active refund per purchase allowed

---

## Testing Checklist

### User-Side Tests
- [ ] Request refund from invoice page
- [ ] Verify refund appears in `/refundhistory`
- [ ] Verify store credit shows on `/profile`
- [ ] Cannot request duplicate refund for same order

### Admin-Side Tests
- [ ] View all refunds at `/managerefunds`
- [ ] Filter refunds by status
- [ ] View refund details at `/refund/:id`
- [ ] Approve refund → store credit is added
- [ ] Reject refund → user sees rejection reason
- [ ] Admin notes are saved and displayed

### Database Tests
- [ ] New refund_requests table exists
- [ ] store_credit column in users table exists
- [ ] Proper indexes are created
- [ ] Foreign keys work correctly

---

## Future Enhancements

Possible improvements to consider:

1. **Partial Refunds** - Allow refunding specific items from an order
2. **Refund Timeline** - Set deadline for refund requests (e.g., 30 days)
3. **Refund History Export** - CSV/PDF export for admins
4. **Email Notifications** - Send emails when refund status changes
5. **Store Credit Expiration** - Expire unused credit after set period
6. **Refund Reasons** - Pre-defined refund reason categories
7. **Photo Evidence** - Allow users to upload photos for refund requests
8. **Automatic Refunds** - Auto-approve refunds within specific criteria
9. **Partial Approvals** - Approve refunds for less than full amount
10. **Store Credit Usage** - Track how credit is spent in future purchases

---

## Troubleshooting

### "Refund request not found"
- Verify purchase belongs to authenticated user
- Check that refund was actually created in database

### "A refund request for this order already exists"
- Each purchase can only have one active refund request (pending or approved)
- User must wait for response or contact admin

### Store credit not showing
- Ensure `store_credit` column exists in users table
- Verify approval process completed successfully
- Check user queries include store_credit field

### Admin can't see refund requests
- Verify user has admin role
- Check that refund_requests table exists
- Ensure foreign keys are set up correctly

---

## Contact & Support

For issues or questions about the refund system:
1. Check database setup is complete
2. Review error messages in application logs
3. Verify all files are created correctly
4. Ensure routes are properly registered in app.js
5. Test with sample data to confirm functionality

