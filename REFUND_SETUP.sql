-- SQL Script to add refund handling support
-- Run this script on your database to add the necessary tables and columns

-- Add store_credit column to users table
ALTER TABLE users ADD COLUMN store_credit DECIMAL(10, 2) DEFAULT 0.00;

-- Create refund_requests table
CREATE TABLE IF NOT EXISTS refund_requests (
  refundRequestId INT AUTO_INCREMENT PRIMARY KEY,
  purchaseId INT NOT NULL,
  userId INT NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admin_notes TEXT,
  processed_at TIMESTAMP NULL,
  FOREIGN KEY (purchaseId) REFERENCES purchases(purchaseId) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_requested_at (requested_at),
  INDEX idx_userId (userId),
  INDEX idx_purchaseId (purchaseId)
);

-- Add indexes for better query performance
CREATE INDEX idx_users_store_credit ON users(store_credit);
CREATE INDEX idx_refund_status ON refund_requests(status);
