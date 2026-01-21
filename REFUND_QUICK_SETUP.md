# Refund System - Quick Setup Checklist

## Step 1: Database Setup ✓
Run the SQL script to add the required tables and columns:

```sql
-- Option A: Run from command line
mysql -u your_user -p your_database < REFUND_SETUP.sql

-- Option B: Run in phpMyAdmin or MySQL Workbench
-- Copy and paste the contents of REFUND_SETUP.sql and execute
```

**Verify:**
- [ ] New `refund_requests` table exists
- [ ] `store_credit` column added to `users` table
- [ ] All indexes created successfully

---

## Step 2: File Structure ✓

**New Files Created:**
- [x] `models/RefundRequest.js` - Refund database model
- [x] `controllers/RefundController.js` - Refund business logic
- [x] `views/manageRefunds.ejs` - Admin refund dashboard
- [x] `views/refundDetail.ejs` - Single refund detail view
- [x] `views/refundHistory.ejs` - User refund history
- [x] `REFUND_SETUP.sql` - Database setup script
- [x] `REFUND_IMPLEMENTATION.md` - Full documentation

**Updated Files:**
- [x] `models/User.js` - Added store credit methods
- [x] `controllers/app.js` - Added refund routes
- [x] `views/invoice.ejs` - Added refund button
- [x] `views/profile.ejs` - Display store credit
- [x] `views/partials/navbar.ejs` - Added refund links

---

## Step 3: Verify Routes ✓

Check `app.js` contains these imports:
```javascript
const RefundController = require('./controllers/RefundController');
```

Check these routes are registered:
```javascript
// User routes
app.post('/refund/request/:purchaseId', checkAuthenticated, RefundController.requestRefund);
app.get('/refundhistory', checkAuthenticated, RefundController.listByUser);

// Admin routes
app.get('/managerefunds', checkAuthenticated, checkAdmin, RefundController.listAll);
app.get('/refund/:refundId', checkAuthenticated, checkAdmin, RefundController.getDetail);
app.post('/refund/:refundId/approve', checkAuthenticated, checkAdmin, RefundController.approve);
app.post('/refund/:refundId/reject', checkAuthenticated, checkAdmin, RefundController.reject);
```

---

## Step 4: Test User Flow ✓

### As a Regular User:
1. [ ] Login to your account
2. [ ] Navigate to `/purchases` (Purchase History)
3. [ ] Click on an invoice to view details
4. [ ] Click "Request Refund" button
5. [ ] Fill in optional reason and submit
6. [ ] Check `/refundhistory` to see the refund request
7. [ ] Check profile (`/profile`) for store credit display

### As an Admin:
1. [ ] Login with admin account
2. [ ] Navigate to `/managerefunds`
3. [ ] See pending refund requests
4. [ ] Click "View" on a refund
5. [ ] Review refund details
6. [ ] Click "Approve Refund" or "Reject Refund"
7. [ ] Add optional admin notes
8. [ ] Confirm action
9. [ ] Verify status changed and store credit was added
10. [ ] Check user's profile shows increased store credit

---

## Step 5: Verify Invoice Updates ✓

1. [ ] Invoice page shows "Request Refund" button next to "Print / Save PDF"
2. [ ] Modal opens when button is clicked
3. [ ] Modal shows refund amount and reason field
4. [ ] Submit button works and creates refund request
5. [ ] User is redirected with success message

---

## Step 6: Verify Profile Updates ✓

1. [ ] User profile page shows "Store Credit" field
2. [ ] Store credit amount displays correctly (formatted as currency)
3. [ ] Store credit updates after admin approves refund

---

## Step 7: Verify Navbar ✓

Check navbar has these new links:

**For Admin Users:**
- [ ] "Manage Refunds" link appears in admin menu

**For Regular Users:**
- [ ] "Refund Requests" link appears in user menu

---

## Troubleshooting

### Database Error: "Table doesn't exist"
**Solution:** Run REFUND_SETUP.sql again. Verify database name is correct.

### Error: "store_credit is undefined"
**Solution:** Run SQL ALTER TABLE command. Restart app.js.

### Routes not found (404 errors)
**Solution:** 
1. Verify RefundController import in app.js
2. Check all routes are correctly defined
3. Restart Node.js server

### Modal not working on invoice page
**Solution:** 
1. Verify Bootstrap JS is loaded
2. Check browser console for errors
3. Verify modal ID matches button data-bs-target

### Store credit not updating after approval
**Solution:**
1. Check approval route in RefundController
2. Verify database transaction completes
3. Check User.addStoreCredit() method

---

## Navigation

After setup, users can access refund features from:

**Regular Users:**
- Invoice page → "Request Refund" button
- Main menu → "Refund Requests" → View status
- Profile page → See store credit balance

**Admins:**
- Main menu → "Manage Refunds" → Process requests
- Refund detail page → Approve/Reject with notes
- Dashboard → Filter by status

---

## Database Backup

Before running the setup, it's recommended to backup your database:

```bash
# MySQL command line backup
mysqldump -u your_user -p your_database > backup_before_refund.sql

# Then restore if needed:
mysql -u your_user -p your_database < backup_before_refund.sql
```

---

## Next Steps

Once setup is complete:

1. **Test thoroughly** - Try all user and admin flows
2. **Monitor logs** - Watch for any errors in console
3. **Get user feedback** - Ensure UX is clear
4. **Plan enhancements** - Consider future improvements listed in documentation

---

## Quick Reference: Key URLs

| URL | Role | Purpose |
|-----|------|---------|
| `/purchases` | User | View purchase history & request refunds |
| `/refundhistory` | User | Check refund request status |
| `/profile` | User | View store credit balance |
| `/managerefunds` | Admin | Manage all refund requests |
| `/refund/:id` | Admin | View & process specific refund |

---

## Support

If you encounter issues:

1. Check `REFUND_IMPLEMENTATION.md` for detailed documentation
2. Review console logs for error messages
3. Verify database structure with `REFUND_SETUP.sql`
4. Test with fresh user account if needed
5. Check that all files are in correct locations

---

**Setup Status: Ready to Deploy** ✓

All components have been implemented and integrated. Follow the checklist above to verify everything is working correctly.
