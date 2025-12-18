const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "bank.db");
const db = new Database(dbPath);

const email = process.argv[2] || "71ashu@gmail.com";

if (!email) {
  console.error("Usage: node scripts/reset-balances.js <user-email>");
  console.error("Example: node scripts/reset-balances.js test@example.com");
  process.exit(1);
}

try {
  console.log(`\n=== Resetting Transactions and Account Balances for ${email} ===`);

  // Look up the user
  const user = db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  // Get all account IDs for this user
  const accounts = db
    .prepare("SELECT id FROM accounts WHERE user_id = ?")
    .all(user.id);

  if (accounts.length === 0) {
    console.log(`User ${email} has no accounts. Nothing to reset.`);
    process.exit(0);
  }

  const accountIds = accounts.map((a) => a.id);
  const placeholders = accountIds.map(() => "?").join(", ");

  const tx = db.transaction(() => {
    // Delete all transactions for this user's accounts
    const deleteStmt = db.prepare(
      `DELETE FROM transactions WHERE account_id IN (${placeholders})`,
    );
    const deletedTransactions = deleteStmt.run(...accountIds);

    // Reset this user's account balances to 0
    const updateStmt = db.prepare(
      `UPDATE accounts SET balance = 0 WHERE id IN (${placeholders})`,
    );
    const updatedAccounts = updateStmt.run(...accountIds);

    console.log(`Deleted ${deletedTransactions.changes} transactions.`);
    console.log(`Reset balance to 0 for ${updatedAccounts.changes} accounts.`);
  });

  tx();

  console.log("Reset complete!\n");
} catch (err) {
  console.error("Error while resetting balances:", err);
  process.exitCode = 1;
} finally {
  db.close();
}


