# E-Wallet & Points System Implementation Guide

## Overview
This document explains the e-wallet and points system integrated into the Supermarket MVC application.

## Features

### 1. E-Wallet Top-Up
- Users can top up their e-wallet with various payment methods
- Supported payment methods:
  - Credit/Debit Card
  - Apple Pay
  - PayNow
  - PayPal
- Top-up range: $10 - $10,000
- Quick preset amounts: $50, $100, $200, $500
- Track all top-up transactions

### 2. Points System
- Users earn 10 points for every $1 spent on purchases
- Points are automatically awarded upon successful checkout
- Points can be converted to store credit at a rate of 100 points = $1
- Points tracking and history are available in the e-wallet dashboard

### 3. Integration with Store Credit
- E-wallet, points, and store credit are linked together
- Points can be converted to store credit anytime
- Store credit can be used directly during checkout
- All balances are tracked and updated in real-time

## Database Setup

Run the EWALLET_SETUP.sql file to create necessary tables:

```bash
mysql -u <username> -p <database_name> < EWALLET_SETUP.sql
```

This creates:
- `ewallet_balance` column in users table
- `points_balance` column in users table
- `ewallet_transactions` table for tracking top-ups
- `points_transactions` table for tracking points activity

## File Structure

### Models
- **EWallet.js** - Handles all e-wallet operations (balance, transactions, points)

### Controllers
- **EWalletController.js** - Routes and logic for e-wallet features

### Views
- **ewallet.ejs** - Main e-wallet dashboard
- **topupWallet.ejs** - Top-up form with payment method selection

### Routes (in app.js)
```
GET  /ewallet - View e-wallet dashboard
GET  /ewallet/topup - Show top-up form
POST /ewallet/topup/process - Process top-up payment
POST /ewallet/topup/confirm - Confirm top-up after payment
POST /ewallet/convert-points - Convert points to store credit
```

## Usage

### For Users

1. **View E-Wallet Dashboard**
   - Navigate to "💰 E-Wallet" in the navbar
   - View wallet balance, points, and transaction history

2. **Top-Up Wallet**
   - Click "Top Up Wallet" button
   - Enter amount ($10 - $10,000)
   - Select payment method
   - Complete payment

3. **Convert Points to Store Credit**
   - Go to E-Wallet dashboard
   - In "Points Activity" section, enter points to convert (multiples of 100)
   - Click "Convert" to convert to store credit

4. **Use in Checkout**
   - E-wallet balance displays alongside store credit
   - Points earned on every purchase (visible on invoice)
   - Can use store credit to pay during checkout

### Points Earning Rate
- **$1 spent = 10 points earned**
- Points are based on the subtotal (before tax and shipping)
- Points are automatically added after successful purchase
- Users can track points in the Points Activity section

## Integration Points

### Points Awarded On:
1. Regular payment methods (Credit/Debit, Apple Pay, PayNow)
2. PayPal payments
3. NETS QR payments

### Points NOT Awarded On:
- Refunded purchases (can be implemented)
- Voucher discounts (points based on actual amount spent)

## Transaction Types

### E-Wallet Transactions
- `top_up` - Money added to wallet
- `deduction` - Money used for payment
- `refund` - Refund to wallet

### Points Transactions
- `earned` - Points earned from purchase
- `spent` - Points used for payment
- `redeemed` - Points converted to store credit
- `refund` - Points refunded

## Technical Details

### Points Calculation
```javascript
pointsEarned = Math.floor(subtotal * 10)
```

### Points to Store Credit Conversion
```javascript
creditAmount = points / 100
// Example: 100 points = $1.00
```

### Store Credit Deduction
Uses `GREATEST()` function to ensure balance never goes negative:
```sql
UPDATE users SET store_credit = GREATEST(0, store_credit - ?) WHERE userId = ?
```

## Error Handling

- Invalid amounts: Users receive feedback
- Insufficient points: Conversion fails with appropriate message
- Transaction failures: Logged and user is notified

## Security Considerations

1. **Balance Verification** - Points are verified before conversion
2. **User Authentication** - All e-wallet operations require login
3. **Transaction Logging** - All transactions are recorded for audit
4. **Permissions** - Users can only access their own e-wallet

## Future Enhancements

Possible features to add:
1. E-wallet withdrawal (transfer to bank)
2. Monthly rewards on e-wallet top-ups
3. Loyalty tiers based on points accumulated
4. Bonus points during promotional periods
5. Gift card functionality
6. E-wallet balance notifications

## Troubleshooting

### Points Not Appearing
- Ensure EWallet.addPoints() is called after Purchase.record()
- Check database for points_transactions records

### Top-Up Not Processing
- Check payment method implementation
- Verify session data is being saved
- Check transaction status in database

### Balance Not Updating
- Refresh page to see updated balance
- Check database for correct balance values
- Verify User.getById() is fetching latest data

## Testing Checklist

- [ ] Create test user account
- [ ] Top up with each payment method
- [ ] Make a purchase and verify points awarded
- [ ] Convert points to store credit
- [ ] Use store credit in checkout
- [ ] Verify invoice shows points earned
- [ ] Check transaction history accuracy
