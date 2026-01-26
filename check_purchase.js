const db = require('./db');

const purchaseId = 15;

console.log(`\nChecking Purchase ID: ${purchaseId}`);
console.log('=' .repeat(60));

// Check purchases table
db.query('SELECT * FROM purchases WHERE purchaseId = ?', [purchaseId], (err, purchases) => {
  if (err) {
    console.error('Error fetching purchase:', err);
    process.exit(1);
  }
  
  console.log('\n📦 Purchase Details:');
  console.log(JSON.stringify(purchases[0], null, 2));
  
  // Check purchase items
  db.query('SELECT * FROM purchase_items WHERE purchaseId = ?', [purchaseId], (err, items) => {
    if (err) {
      console.error('Error fetching purchase items:', err);
      process.exit(1);
    }
    
    console.log('\n🛒 Purchase Items:');
    items.forEach(item => {
      console.log(`  - Product ID ${item.productId}: ${item.quantity} x $${item.price} = $${item.subtotal}`);
    });
    
    const calculatedTotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
    console.log(`\n💰 Calculated Total from Items: $${calculatedTotal.toFixed(2)}`);
    console.log(`💰 Stored Total in Purchases: $${parseFloat(purchases[0].total).toFixed(2)}`);
    console.log(`💰 Final Total (after discount): $${parseFloat(purchases[0].final_total || purchases[0].total).toFixed(2)}`);
    
    if (Math.abs(calculatedTotal - parseFloat(purchases[0].total)) > 0.01) {
      console.log('\n⚠️  WARNING: Mismatch detected!');
    } else {
      console.log('\n✅ Totals match!');
    }
    
    process.exit(0);
  });
});
