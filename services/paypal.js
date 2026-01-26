const fetch = require('node-fetch');
require('dotenv').config();

const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_API = process.env.PAYPAL_API;

async function getAccessToken() {
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(PAYPAL_CLIENT + ':' + PAYPAL_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  return data.access_token;
}

async function createOrder(amount) {
  // Ensure amount is a string with proper decimal places
  const amountStr = String(parseFloat(amount).toFixed(2));
  console.log('PayPal createOrder - Amount value:', amountStr, 'Type:', typeof amountStr, 'Currency: SGD');
  
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Auth-Assertion': '' // Optional: for additional security
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      payer: {
        email_address: 'buyer@example.com'
      },
      purchase_units: [{
        reference_id: `order-${Date.now()}`,
        amount: {
          currency_code: 'SGD',
          value: amountStr,
          breakdown: {
            item_total: {
              currency_code: 'SGD',
              value: amountStr
            }
          }
        },
        items: [{
          name: 'Order',
          sku: 'order-item',
          unit_amount: {
            currency_code: 'SGD',
            value: amountStr
          },
          quantity: '1'
        }]
      }]
    })
  });
  const data = await response.json();
  console.log('PayPal createOrder response:', data);
  return data;
}

async function captureOrder(orderId) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
  const data = await response.json();
  console.log('PayPal captureOrder response:', data);
  return data;
}

module.exports = { createOrder, captureOrder };