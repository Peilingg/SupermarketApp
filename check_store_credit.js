const db = require('./db');

console.log('Checking for store credit transactions...');

db.query(
  "SELECT * FROM points_transactions WHERE transactionType IN ('store_credit_used', 'store_credit_added') ORDER BY createdAt DESC LIMIT 10",
  (err, results) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Found', results.length, 'store credit transactions:');
      console.log(JSON.stringify(results, null, 2));
    }
    process.exit();
  }
);
