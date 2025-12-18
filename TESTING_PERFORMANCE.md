# Performance Testing Guide - PERF-407

This guide explains how to test the performance improvements made to address ticket PERF-407.

## Overview

The performance fixes include:
1. **Fixed N+1 Query Problem** - Replaced loop-based queries with a single JOIN query
2. **Added Database Indexes** - Created indexes on frequently queried columns
3. **Optimized Transaction Retrieval** - Improved transaction fetching in `fundAccount`
4. **Added Pagination** - Implemented pagination for `getTransactions` query

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server should be running on `http://localhost:3000`

2. **Ensure you have a test user:**
   - Sign up or log in via the web interface at `http://localhost:3000`
   - Create at least one active account (checking or savings)

3. **Note your test email** (default: `71ashu@gmail.com`)

## Running the Performance Test Suite

### Automated Test Script

Run the comprehensive performance test:

```bash
npm run test:performance
```

Or directly:
```bash
node scripts/test-performance.js
```

**Customize the test:**
```bash
TEST_EMAIL=your-email@example.com node scripts/test-performance.js
```

### What the Test Does

The test script performs the following checks:

1. **Concurrent Transaction Processing**
   - Creates 20 transactions with a concurrency of 10
   - Measures throughput and average time per transaction
   - Tests system performance under concurrent load

2. **getTransactions Query Performance**
   - Tests the N+1 query fix
   - Measures query time for retrieving transactions
   - Verifies that JOIN query is faster than the previous loop-based approach

3. **Pagination Performance**
   - Tests pagination with different page sizes (10, 25, 50)
   - Verifies that pagination works correctly
   - Measures performance improvement with smaller page sizes

4. **Database Index Verification**
   - Checks if indexes were created successfully
   - Shows query execution plan to verify index usage
   - Confirms indexes are being used for optimal performance

## Manual Testing

### Test 1: Concurrent Transactions

Simulate multiple users funding accounts simultaneously:

```bash
# Terminal 1
npm run test:funding

# Terminal 2 (run simultaneously)
npm run test:funding

# Terminal 3 (run simultaneously)
npm run test:funding
```

**Expected Result:** All transactions should complete successfully without significant slowdown.

### Test 2: Transaction List Performance

1. Create many transactions first:
   ```bash
   npm run test:funding
   ```

2. Open the dashboard in your browser: `http://localhost:3000/dashboard`

3. View transactions for an account with many transactions

4. **Before Fix:** Page would load slowly or timeout with many transactions
5. **After Fix:** Page should load quickly, showing paginated results

### Test 3: API Response Times

Test the API directly using curl:

```bash
# Get your session token
TOKEN=$(npm run test:get-token -- 71ashu@gmail.com | tail -1)

# Get your account ID
ACCOUNT_ID=$(npm run test:get-account-id -- 71ashu@gmail.com | tail -1)

# Test getTransactions endpoint
time curl -X POST "http://localhost:3000/api/trpc/account.getTransactions" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$TOKEN" \
  -d "{\"json\":{\"accountId\":$ACCOUNT_ID}}" \
  -s -o /dev/null
```

**Expected Result:** Response time should be under 100ms for accounts with < 1000 transactions.

### Test 4: Pagination

Test pagination with different limits:

```bash
TOKEN=$(npm run test:get-token -- 71ashu@gmail.com | tail -1)
ACCOUNT_ID=$(npm run test:get-account-id -- 71ashu@gmail.com | tail -1)

# Test with limit 10
curl -X POST "http://localhost:3000/api/trpc/account.getTransactions" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$TOKEN" \
  -d "{\"json\":{\"accountId\":$ACCOUNT_ID,\"limit\":10}}" \
  | jq '.result.data.json'

# Test with limit 50
curl -X POST "http://localhost:3000/api/trpc/account.getTransactions" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=$TOKEN" \
  -d "{\"json\":{\"accountId\":$ACCOUNT_ID,\"limit\":50}}" \
  | jq '.result.data.json'
```

**Expected Result:** Both queries should return the correct number of transactions, and the limit 10 query should be faster.

## Verifying Database Indexes

Check if indexes were created:

```bash
sqlite3 bank.db ".indexes"
```

You should see indexes like:
- `idx_accounts_user_id`
- `idx_transactions_account_id`
- `idx_transactions_created_at`
- `idx_transactions_account_id_created_at`

To see the query plan (verify indexes are being used):

```bash
sqlite3 bank.db "EXPLAIN QUERY PLAN SELECT t.*, a.account_type FROM transactions t INNER JOIN accounts a ON t.account_id = a.id WHERE t.account_id = 1 ORDER BY t.created_at DESC LIMIT 50;"
```

**Expected Result:** The query plan should show "SEARCH" or "SCAN" operations using indexes.

## Performance Benchmarks

### Before Fixes:
- **N+1 Query:** For 100 transactions, ~100+ database queries
- **No Indexes:** Full table scans on every query
- **No Pagination:** Loading all transactions at once
- **Concurrent Load:** Significant slowdown with 10+ concurrent requests

### After Fixes:
- **Single JOIN Query:** 1 database query regardless of transaction count
- **Indexed Queries:** Fast lookups using indexes
- **Pagination:** Configurable page sizes (default: 50)
- **Concurrent Load:** Handles concurrent requests efficiently

## Troubleshooting

### Test script fails with "No session found"
- Make sure you're logged in via the web interface
- Check that your email matches the TEST_EMAIL environment variable

### Test script fails with "No active account found"
- Create an account via the dashboard: `http://localhost:3000/dashboard`
- Ensure the account status is "active"

### Indexes not created
- Restart the development server to trigger database initialization
- Or manually run: `node -e "require('./lib/db').initDb()"`

### Slow performance still observed
- Check database file size: `ls -lh bank.db`
- Verify indexes exist: `sqlite3 bank.db ".indexes"`
- Check for database locks: Ensure only one process is accessing the database

## Additional Notes

- The test script creates test transactions automatically if there are fewer than 50 transactions
- Performance may vary based on system resources and database size
- For production-like testing, consider using a database with thousands of transactions
- Monitor database file size - SQLite performance can degrade with very large files (>1GB)

