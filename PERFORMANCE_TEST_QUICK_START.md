# Quick Start: Testing PERF-407 Performance Fixes

## 🚀 Quick Test (2 minutes)

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **In another terminal, run the test:**
   ```bash
   npm run test:performance
   ```

3. **Review the results** - The script will show:
   - Concurrent transaction throughput
   - Query performance metrics
   - Pagination performance
   - Database index verification

## 📋 What Gets Tested

✅ **Concurrent Transactions** - Tests system under load  
✅ **N+1 Query Fix** - Verifies JOIN query performance  
✅ **Pagination** - Tests different page sizes  
✅ **Database Indexes** - Confirms indexes are created and used  

## 🎯 Expected Results

- **Throughput:** Should handle 10+ concurrent transactions/second
- **Query Time:** `getTransactions` should complete in < 100ms for 100 transactions
- **Indexes:** Should see 8+ indexes created automatically
- **Pagination:** Smaller page sizes should be faster

## 🔍 Manual Verification

**Test in browser:**
1. Go to `http://localhost:3000/dashboard`
2. View transactions for an account
3. Should load quickly even with many transactions

**Check indexes:**
```bash
sqlite3 bank.db ".indexes" | grep idx_
```

Should see: `idx_transactions_account_id`, `idx_transactions_created_at`, etc.

## 📚 Full Documentation

See [TESTING_PERFORMANCE.md](./TESTING_PERFORMANCE.md) for detailed testing instructions.

