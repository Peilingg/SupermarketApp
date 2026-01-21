// Quick test to check if database tables exist
// Run this with: node test_refund_db.js

const db = require('./db');

console.log('Testing Refund System Database Setup...\n');

// Test 1: Check if refund_requests table exists
db.query("SHOW TABLES LIKE 'refund_requests'", function(err, results) {
  if (err) {
    console.error('❌ Error checking tables:', err.message);
    process.exit(1);
  }
  
  if (results.length === 0) {
    console.error('❌ refund_requests table NOT FOUND');
    console.log('\nFIX: Run the database migration:');
    console.log('   mysql -u username -p database < REFUND_SETUP.sql');
    process.exit(1);
  } else {
    console.log('✅ refund_requests table exists');
  }
  
  // Test 2: Check if store_credit column exists
  db.query("DESC users", function(err, results) {
    if (err) {
      console.error('❌ Error checking users table:', err.message);
      process.exit(1);
    }
    
    const hasStoreCredit = results.some(row => row.Field === 'store_credit');
    
    if (!hasStoreCredit) {
      console.error('❌ store_credit column NOT FOUND in users table');
      console.log('\nFIX: Run the database migration:');
      console.log('   mysql -u username -p database < REFUND_SETUP.sql');
      process.exit(1);
    } else {
      console.log('✅ store_credit column exists in users table');
    }
    
    console.log('\n✅ All database tables are set up correctly!');
    console.log('\nYou can now use the refund system.');
    process.exit(0);
  });
});
