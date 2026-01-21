# Refund System - Troubleshooting Guide

## Issue: "Request Refund" button doesn't work

### Most Common Cause: Database Not Set Up

The refund_requests table hasn't been created yet.

### Solution: Run the Database Migration

#### Option 1: Command Line (Recommended)
```bash
# Navigate to your project directory
cd "C:\Users\24045100\Desktop\Republic Poly\Year 2 Semester 2\C372 Payment Technologies\supermarketMVC\SupermarketApp"

# Run the SQL migration
mysql -u your_username -p your_database < REFUND_SETUP.sql
```

#### Option 2: phpMyAdmin
1. Open phpMyAdmin
2. Select your database
3. Go to "SQL" tab
4. Copy contents of REFUND_SETUP.sql
5. Paste and execute

#### Option 3: MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. Open REFUND_SETUP.sql
4. Execute the script

### Verify the Migration

After running the migration, verify the table was created:

```bash
# Check if table exists
mysql -u your_username -p your_database -e "SHOW TABLES LIKE 'refund_requests';"

# Check if column was added
mysql -u your_username -p your_database -e "DESC users;" | grep store_credit
```

### After Database Migration

1. **Restart Node.js**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart
   node app.js
   ```

2. **Test the Feature**
   - Go to http://localhost:3000/purchases
   - Click "Request Refund"
   - Submit the form
   - Check if refund appears in history at /refundhistory

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Table doesn't exist" | Database migration not run | Run REFUND_SETUP.sql |
| "Unknown column store_credit" | ALTER TABLE didn't run | Check migration completed |
| Modal opens but button doesn't work | Route not found (404) | Verify app.js has routes |
| "Flash message undefined" | Flash middleware missing | Check app.js middleware setup |

### Check App.js Configuration

Make sure these are in app.js:

```javascript
// Line 16: Import RefundController
const RefundController = require('./controllers/RefundController');

// Line 353-354: Route for requesting refund
app.post('/refund/request/:purchaseId', checkAuthenticated, (req, res) => {
    RefundController.requestRefund(req, res);
});
```

### Still Having Issues?

1. Check browser console (F12) for JavaScript errors
2. Check Node.js console for server errors
3. Verify database credentials in .env file
4. Ensure RefundRequest.js model exists
5. Ensure RefundController.js exists

