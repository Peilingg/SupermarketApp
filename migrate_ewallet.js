const db = require('./db');

console.log('Starting e-wallet database migration...\n');

const migrations = [
  'ALTER TABLE users ADD COLUMN ewallet_balance DECIMAL(10, 2) DEFAULT 0.00',
  'ALTER TABLE users ADD COLUMN points_balance INT DEFAULT 0',
  'ALTER TABLE users ADD COLUMN store_credit DECIMAL(10, 2) DEFAULT 0.00',
  'ALTER TABLE users ADD COLUMN auto_convert_points TINYINT(1) DEFAULT 0',
  `CREATE TABLE IF NOT EXISTS ewallet_transactions (
    transactionId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transactionType ENUM('top_up', 'deduction', 'refund') DEFAULT 'top_up',
    paymentMethod VARCHAR(50),
    description VARCHAR(255),
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    referenceId VARCHAR(100),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    INDEX idx_userId (userId),
    INDEX idx_createdAt (createdAt)
  )`,
  `CREATE TABLE IF NOT EXISTS points_transactions (
    transactionId INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    pointsAmount INT NOT NULL,
    transactionType ENUM('earned', 'spent', 'redeemed', 'refund') DEFAULT 'earned',
    description VARCHAR(255),
    purchaseId INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
    INDEX idx_userId (userId),
    INDEX idx_createdAt (createdAt)
  )`,
  'ALTER TABLE ewallet_transactions ADD INDEX idx_status (status)',
  'ALTER TABLE ewallet_transactions ADD INDEX idx_transactionType (transactionType)',
  'ALTER TABLE points_transactions ADD INDEX idx_transactionType (transactionType)'
];

let completed = 0;
let failed = 0;

function runMigration(index) {
  if (index >= migrations.length) {
    console.log(`\n✅ Migration complete! ${completed} successful, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  }

  const sql = migrations[index];
  console.log(`\n[${index + 1}/${migrations.length}] Running migration...`);
  console.log(`SQL: ${sql.substring(0, 80)}...`);
  
  db.query(sql, (err, result) => {
    if (err) {
      // Ignore "column already exists" errors (ER_DUP_FIELDNAME)
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
        console.log(`✅ Already exists (skipped)`);
        completed++;
      } else {
        console.log(`❌ Error: ${err.code || err.errno} - ${err.message}`);
        failed++;
      }
    } else {
      console.log(`✅ Success`);
      completed++;
    }
    runMigration(index + 1);
  });
}

runMigration(0);
