import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/routers";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "..", "bank.db");
const db = new Database(dbPath);

const TEST_EMAIL = process.env.TEST_EMAIL || "71ashu@gmail.com";
const BASE_URL = process.env.BASE_URL || "http://localhost:3000/api/trpc";

/**
 * Performance Test Script for PERF-407
 * 
 * This script tests the performance improvements:
 * 1. Concurrent transaction processing
 * 2. getTransactions query performance (N+1 fix)
 * 3. Pagination performance
 * 4. Database index effectiveness
 */

function getTRPCClient(sessionToken: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: BASE_URL,
        headers() {
          return {
            cookie: `session=${sessionToken}`,
          };
        },
      }),
    ],
  });
}

async function setup() {
  console.log("🔧 Setting up test environment...\n");

  // Look up user
  const user = db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .get(TEST_EMAIL) as { id: number; email: string } | undefined;

  if (!user) {
    console.error(`❌ No user found with email ${TEST_EMAIL}. Please sign up first.`);
    process.exit(1);
  }

  // Look up an active account
  const account = db
    .prepare("SELECT id, balance, status FROM accounts WHERE user_id = ? AND status = 'active' LIMIT 1")
    .get(user.id) as { id: number; balance: number; status: string } | undefined;

  if (!account) {
    console.error(`❌ No active account found for user ${TEST_EMAIL}. Please create an account first.`);
    process.exit(1);
  }

  // Get latest session token
  const session = db
    .prepare(
      `SELECT token, expires_at 
       FROM sessions 
       WHERE user_id = ? 
       ORDER BY expires_at DESC 
       LIMIT 1`
    )
    .get(user.id) as { token: string; expires_at: string } | undefined;

  if (!session) {
    console.error(`❌ No session found for user ${TEST_EMAIL}. Please log in first.`);
    process.exit(1);
  }

  const client = getTRPCClient(session.token);

  return { user, account, client };
}

function measureTime<T>(fn: () => Promise<T>) {
  const start = process.hrtime.bigint();
  return {
    execute: async () => {
      const result = await fn();
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      return { result, durationMs };
    },
  };
}

async function testConcurrentTransactions(
  client: ReturnType<typeof getTRPCClient>,
  accountId: number,
  concurrency = 10,
  totalTransactions = 50
) {
  console.log(`\n📊 Test 1: Concurrent Transaction Processing`);
  console.log(`   Creating ${totalTransactions} transactions with concurrency of ${concurrency}...\n`);

  const transactionsPerBatch = Math.ceil(totalTransactions / concurrency);
  const startTime = Date.now();

  const batches = [];
  for (let i = 0; i < concurrency; i++) {
    const batch = [];
    for (let j = 0; j < transactionsPerBatch && (i * transactionsPerBatch + j) < totalTransactions; j++) {
      batch.push(
        client.account.fundAccount.mutate({
          accountId,
          amount: 10.50,
          fundingSource: {
            type: "card",
            accountNumber: "4242424242424242",
          },
        })
      );
    }
    batches.push(Promise.all(batch));
  }

  await Promise.all(batches);
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTimePerTransaction = totalTime / totalTransactions;

  console.log(`   ✅ Completed ${totalTransactions} transactions`);
  console.log(`   ⏱️  Total time: ${totalTime}ms`);
  console.log(`   ⏱️  Average time per transaction: ${avgTimePerTransaction.toFixed(2)}ms`);
  console.log(`   📈 Throughput: ${((totalTransactions / totalTime) * 1000).toFixed(2)} transactions/second\n`);

  return { totalTime, avgTimePerTransaction, throughput: (totalTransactions / totalTime) * 1000 };
}

async function testGetTransactionsPerformance(
  client: ReturnType<typeof getTRPCClient>,
  accountId: number,
  transactionCount: number
) {
  console.log(`\n📊 Test 2: getTransactions Query Performance (N+1 Fix)`);
  console.log(`   Testing with ${transactionCount} transactions in database...\n`);

  // Count actual transactions
  const actualCount = db
    .prepare("SELECT COUNT(*) as count FROM transactions WHERE account_id = ?")
    .get(accountId) as { count: number };

  console.log(`   Database has ${actualCount.count} transactions for this account`);

  const { execute: timedQuery } = measureTime(() =>
    client.account.getTransactions.query({ accountId })
  );

  const { result, durationMs } = await timedQuery();

  console.log(`   ✅ Retrieved ${result.length} transactions`);
  console.log(`   ⏱️  Query time: ${durationMs.toFixed(2)}ms`);
  console.log(`   📈 Time per transaction: ${(durationMs / result.length).toFixed(2)}ms\n`);

  return { durationMs, transactionCount: result.length };
}

async function testPagination(
  client: ReturnType<typeof getTRPCClient>,
  accountId: number
) {
  console.log(`\n📊 Test 3: Pagination Performance`);
  console.log(`   Testing paginated queries...\n`);

  const pageSizes = [10, 25, 50];
  const results = [];

  for (const limit of pageSizes) {
    const { execute: timedQuery } = measureTime(() =>
      client.account.getTransactions.query({ accountId, limit, offset: 0 })
    );

    const { result, durationMs } = await timedQuery();
    results.push({ limit, durationMs, count: result.length });
    console.log(`   ✅ Limit ${limit}: ${durationMs.toFixed(2)}ms (${result.length} transactions)`);
  }

  console.log();
  return results;
}

async function testDatabaseIndexes(accountId: number) {
  console.log(`\n📊 Test 4: Database Index Verification`);
  console.log(`   Checking if indexes exist...\n`);

  const indexes = db
    .prepare(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name LIKE 'idx_%'
      ORDER BY name
    `)
    .all() as Array<{ name: string; sql: string | null }>;

  if (indexes.length === 0) {
    console.log(`   ⚠️  No indexes found! Indexes should be created automatically.`);
  } else {
    console.log(`   ✅ Found ${indexes.length} indexes:`);
    indexes.forEach(idx => {
      console.log(`      - ${idx.name}`);
    });
  }

  // Test query performance with EXPLAIN QUERY PLAN
  console.log(`\n   Testing query plan for getTransactions...`);
  const explainPlan = db
    .prepare(`
      EXPLAIN QUERY PLAN
      SELECT t.*, a.account_type
      FROM transactions t
      INNER JOIN accounts a ON t.account_id = a.id
      WHERE t.account_id = ?
      ORDER BY t.created_at DESC
      LIMIT 50
    `)
    .all(accountId) as Array<{ detail: string }>;

  console.log(`   Query plan:`);
  explainPlan.forEach((step, i) => {
    console.log(`      ${i + 1}. ${step.detail}`);
  });

  console.log();
  return indexes.length;
}

async function createTestTransactions(
  client: ReturnType<typeof getTRPCClient>,
  accountId: number,
  count: number
) {
  console.log(`\n🔧 Creating ${count} test transactions...\n`);
  
  const batchSize = 10;
  let created = 0;

  for (let i = 0; i < count; i += batchSize) {
    const batch = [];
    const batchCount = Math.min(batchSize, count - i);
    
    for (let j = 0; j < batchCount; j++) {
      batch.push(
        client.account.fundAccount.mutate({
          accountId,
          amount: 5.00,
          fundingSource: {
            type: "card",
            accountNumber: "4242424242424242",
          },
        })
      );
    }

    await Promise.all(batch);
    created += batchCount;
    process.stdout.write(`\r   Progress: ${created}/${count} transactions created`);
  }

  console.log(`\n   ✅ Created ${created} transactions\n`);
}

async function main() {
  console.log("🚀 Performance Test Suite for PERF-407");
  console.log("=".repeat(50));
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`API URL: ${BASE_URL}\n`);

  try {
    const { account, client } = await setup();

    // Check current transaction count
    const initialCount = db
      .prepare("SELECT COUNT(*) as count FROM transactions WHERE account_id = ?")
      .get(account.id) as { count: number };

    console.log(`Current transaction count: ${initialCount.count}\n`);

    // Create some test transactions if there are very few
    if (initialCount.count < 50) {
      console.log(`⚠️  Low transaction count (${initialCount.count}). Creating 50 test transactions...\n`);
      await createTestTransactions(client, account.id, 50);
    }

    // Run performance tests
    const results = {
      concurrent: await testConcurrentTransactions(client, account.id, 10, 20),
      getTransactions: await testGetTransactionsPerformance(client, account.id, 100),
      pagination: await testPagination(client, account.id),
      indexes: await testDatabaseIndexes(account.id),
    };

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📋 Test Summary");
    console.log("=".repeat(50));
    console.log(`Concurrent Transactions:`);
    console.log(`  - Throughput: ${results.concurrent.throughput.toFixed(2)} tx/sec`);
    console.log(`  - Avg time per transaction: ${results.concurrent.avgTimePerTransaction.toFixed(2)}ms`);
    console.log(`\ngetTransactions Query:`);
    console.log(`  - Query time: ${results.getTransactions.durationMs.toFixed(2)}ms`);
    console.log(`  - Transactions retrieved: ${results.getTransactions.transactionCount}`);
    console.log(`\nDatabase Indexes:`);
    console.log(`  - Indexes found: ${results.indexes}`);
    console.log("\n✅ Performance tests completed!\n");

  } catch (error) {
    console.error("\n❌ Error during performance testing:", error);
    if (error instanceof Error && error.message) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  } finally {
    db.close();
  }
}

main();

