const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "bank.db");
const db = new Database(dbPath);

const email = process.argv[2];

if (!email) {
  console.log("Usage: node scripts/get-session-token.js <email>");
  process.exit(1);
}

const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (!user) {
  console.log(`User ${email} not found`);
  process.exit(1);
}

const session = db.prepare("SELECT token FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1").get(user.id);
if (!session) {
  console.log(`No session found for ${email}. Please log in first.`);
  process.exit(1);
}

console.log(session.token);
db.close();

