# PayPal Integration Guide

## Overview
PayPal has been integrated as a payment method in your Supermarket MVC application. This guide explains how to set it up and use it.

## Setup Instructions

### Step 1: Get PayPal Developer Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Sign in with your PayPal account (or create one)
3. Navigate to **Apps & Credentials** tab
4. Make sure you're in **Sandbox** mode (for testing)
5. Under **Sandbox** section, you'll find:
   - **Client ID**
   - **Secret**

### Step 2: Configure Environment Variables

1. Create a `.env` file in your project root (or copy from `.env.example`):
   ```
   PAYPAL_MODE=sandbox
   PAYPAL_CLIENT_ID=your_client_id_here
   PAYPAL_CLIENT_SECRET=your_client_secret_here
   APP_URL=http://localhost:3000
   PORT=3000
   ```

2. Replace placeholders with your actual PayPal credentials

### Step 3: Install Dependencies

Run the following command to install PayPal SDK:
```bash
npm install
```

This will install:
- `@paypal/checkout-server-sdk` - PayPal's official SDK
- `paypal-rest-sdk` - REST API wrapper

## How It Works

### Payment Flow

1. **Customer selects PayPal** on the confirmation page
2. **Clicks "Confirm & Pay"** button
3. **Redirected to PayPal login** page
4. **Approves payment** on PayPal
5. **Redirected back** to your application
6. **Purchase is recorded** and invoice is generated

### File Structure

```
controllers/
├── PayPalController.js        # Handles PayPal payment logic
├── PurchaseController.js      # Updated to work with PayPal

app.js
├── Added PayPal routes:
│   ├── GET /paypal/create     # Create payment
│   ├── GET /paypal/execute    # Execute payment (PayPal callback)
│   └── GET /paypal/cancel     # Handle cancellation

views/
└── confirmationPurchase.ejs   # Updated with PayPal option
```

## Routes Added

### POST /checkout/confirm
- **Updated** to detect PayPal selection
- If PayPal is selected, redirects to `/paypal/create`
- For other payment methods, uses original flow

### GET /paypal/create
- Creates a PayPal payment object
- Stores order data in session
- Redirects user to PayPal approval page

### GET /paypal/execute
- Called by PayPal after user approves
- Receives `PayerID` from PayPal
- Executes the payment
- Records purchase in database
- Clears cart and shows invoice

### GET /paypal/cancel
- Called if user cancels PayPal payment
- Clears session data
- Redirects to checkout page with error message

## Testing in Sandbox Mode

### Test Accounts

1. Go to [PayPal Sandbox Accounts](https://developer.paypal.com/dashboard/accounts/)
2. Create test buyer and seller accounts
3. Use these accounts to test payments

### Test Buyer Account Details
- Email: `sb-[random].paypal.com`
- Password: Available in dashboard

## Code Example

### Creating a PayPal Payment

```javascript
const paymentJson = {
  intent: 'sale',
  payer: {
    payment_method: 'paypal',
    payer_info: {
      email: user.email,
      first_name: user.username
    }
  },
  redirect_urls: {
    return_url: 'http://localhost:3000/paypal/execute',
    cancel_url: 'http://localhost:3000/checkout'
  },
  transactions: [{
    item_list: { items: [...] },
    amount: {
      currency: 'USD',
      total: '100.00'
    }
  }]
};

paypal.payment.create(paymentJson, callback);
```

## Error Handling

The PayPal controller includes error handling for:
- **Invalid payment session**: Redirects to checkout
- **PayPal API errors**: Shows error message and redirects
- **Payment failure**: Logs error and allows retry
- **Database errors**: Logs error but completes PayPal flow

## Security Considerations

1. **Environment Variables**: Never commit `.env` file to version control
2. **HTTPS**: Use HTTPS in production (PayPal requires it)
3. **Credentials**: Keep Client ID and Secret secure
4. **Session Management**: PayPal data is cleared after transaction
5. **CSRF Protection**: Consider adding CSRF tokens for production

## Transitioning to Production

1. Switch `PAYPAL_MODE` from `sandbox` to `live`
2. Update `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` with live credentials
3. Change `APP_URL` to your production domain
4. Enable HTTPS on your server
5. Test thoroughly before going live

## Troubleshooting

### "Failed to create PayPal payment"
- Check that credentials are correct in `.env`
- Verify `PAYPAL_MODE` is set to `sandbox` (for testing)
- Check PayPal API status

### "PayPal payment was cancelled"
- User clicked cancel on PayPal page
- Automatically redirects to checkout with error message

### "Unable to find PayPal approval URL"
- Check PayPal API response format
- Verify `dotenv` is loaded in app.js

### Payment not recorded
- Check database logs
- Verify MySQL connection
- Check purchase model methods

## Integration Points

### Models Used
- `Purchase` - Records completed transactions
- `CartItem` - Gets cart contents and clears after payment
- `Voucher` - Marks vouchers as used after payment

### Views Updated
- `confirmationPurchase.ejs` - Added PayPal radio button and logic
- `invoice.ejs` - Shows PayPal transaction ID in payment details

## Future Enhancements

Possible improvements:
1. **PayPal Subscription** for recurring purchases
2. **Refund Handling** - Allow refunds via PayPal API
3. **Webhooks** - Use PayPal webhooks for async notifications
4. **PayPal Express** - Button-based fast checkout
5. **Multiple Currencies** - Support different currencies

## Support & Resources

- [PayPal Developer Documentation](https://developer.paypal.com/docs/)
- [PayPal REST API Reference](https://developer.paypal.com/docs/api/overview/)
- [paypal-rest-sdk GitHub](https://github.com/paypal/PayPal-node-SDK)
- [Node.js Integration Guide](https://developer.paypal.com/docs/checkout/integrate/)

## License & Compliance

- Follow PayPal's Acceptable Use Policy
- Display PayPal branding appropriately
- Ensure PCI compliance for sensitive data
- Keep transaction records for accounting
