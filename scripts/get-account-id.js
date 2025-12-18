const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "bank.db");
const db = new Database(dbPath);

const email = process.argv[2];

if (!email) {
  console.log("Usage: node scripts/get-account-id.js <email>");
  process.exit(1);
}

const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (!user) {
  console.log(`User ${email} not found`);
  process.exit(1);
}

const account = db.prepare("SELECT id, account_number, account_type, status FROM accounts WHERE user_id = ? AND status = 'active' LIMIT 1").get(user.id);
if (!account) {
  console.log(`No active account found for ${email}. Please create an account first.`);
  process.exit(1);
}

console.log(account.id);
db.close();

