@echo off
REM Database Migration Script for Refund System
REM This script runs the REFUND_SETUP.sql file

echo.
echo ========================================
echo  Refund System - Database Setup
echo ========================================
echo.

REM Check if mysql is available
where mysql >nul 2>nul
if errorlevel 1 (
    echo ERROR: MySQL command not found!
    echo Please ensure MySQL is installed and added to PATH
    echo.
    pause
    exit /b 1
)

echo Enter your MySQL credentials:
set /p DB_USER="Database Username: "
set /p DB_PASS="Database Password: "
set /p DB_NAME="Database Name: "

echo.
echo Running database migration...
echo.

mysql -u %DB_USER% -p%DB_PASS% %DB_NAME% < REFUND_SETUP.sql

if errorlevel 1 (
    echo.
    echo ERROR: Database migration failed!
    echo Please check your credentials and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  SUCCESS: Database migration completed!
echo ========================================
echo.
echo The following changes were made:
echo  - Added store_credit column to users table
echo  - Created refund_requests table
echo  - Created performance indexes
echo.
echo Next steps:
echo  1. Restart Node.js server (Ctrl+C then "node app.js")
echo  2. Test the refund feature
echo.
pause
