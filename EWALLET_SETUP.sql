-- E-Wallet Setup SQL
-- Run this to add e-wallet and points system to your database

-- Add e-wallet and points columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS ewallet_balance DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance INT DEFAULT 0;
-- Ensure store_credit column exists (used for points conversion)
ALTER TABLE users ADD COLUMN IF NOT EXISTS store_credit DECIMAL(10, 2) DEFAULT 0.00;
-- Preference: auto convert points to store credit (0=false, 1=true)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_convert_points TINYINT(1) DEFAULT 0;

-- Create ewallet_transactions table to track top-ups
CREATE TABLE IF NOT EXISTS ewallet_transactions (
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
);

-- Create points_transactions table to track points earned/spent
CREATE TABLE IF NOT EXISTS points_transactions (
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
);

-- Add indexes for better query performance
ALTER TABLE ewallet_transactions ADD INDEX IF NOT EXISTS idx_status (status);
ALTER TABLE ewallet_transactions ADD INDEX IF NOT EXISTS idx_transactionType (transactionType);
ALTER TABLE points_transactions ADD INDEX IF NOT EXISTS idx_transactionType (transactionType);
