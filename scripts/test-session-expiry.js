const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "bank.db");
const db = new Database(dbPath);

const command = process.argv[2];

/**
 * Test script for session expiry buffer fix
 * 
 * This script helps test that sessions are invalidated 5 minutes before
 * their actual expiry time (the buffer fix).
 */

if (command === "set-near-expiry") {
  // Set a session to expire in 4 minutes (should be invalid due to 5min buffer)
  const email = process.argv[3];
  if (!email) {
    console.log("Usage: node scripts/test-session-expiry.js set-near-expiry <email>");
    process.exit(1);
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    console.log(`User ${email} not found`);
    process.exit(1);
  }

  const session = db.prepare("SELECT id, token, expires_at FROM sessions WHERE user_id = ?").get(user.id);
  if (!session) {
    console.log(`No session found for ${email}. Please log in first.`);
    process.exit(1);
  }

  // Set expiry to 4 minutes from now (less than 5min buffer)
  const newExpiry = new Date();
  newExpiry.setMinutes(newExpiry.getMinutes() + 4);
  
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(newExpiry.toISOString(), session.id);
  
  console.log(`\n✓ Session for ${email} set to expire in 4 minutes`);
  console.log(`  Expiry time: ${newExpiry.toISOString()}`);
  console.log(`  Current time: ${new Date().toISOString()}`);
  console.log(`\n⚠️  Expected: Session should be INVALID (4min < 5min buffer)`);
  console.log(`\nTest by making an authenticated API call now.\n`);

} else if (command === "set-1min-expiry") {
  // Set a session to expire in 1 minute (should be invalid due to 5min buffer)
  const email = process.argv[3];
  if (!email) {
    console.log("Usage: node scripts/test-session-expiry.js set-1min-expiry <email>");
    process.exit(1);
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    console.log(`User ${email} not found`);
    process.exit(1);
  }

  const session = db.prepare("SELECT id, token, expires_at FROM sessions WHERE user_id = ?").get(user.id);
  if (!session) {
    console.log(`No session found for ${email}. Please log in first.`);
    process.exit(1);
  }

  // Set expiry to 1 minute from now (less than 5min buffer)
  const newExpiry = new Date();
  newExpiry.setMinutes(newExpiry.getMinutes() + 1);
  
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(newExpiry.toISOString(), session.id);
  
  console.log(`\n✓ Session for ${email} set to expire in 1 minute`);
  console.log(`  Expiry time: ${newExpiry.toISOString()}`);
  console.log(`  Current time: ${new Date().toISOString()}`);
  console.log(`\n⚠️  Expected: Session should be INVALID (1min < 5min buffer)`);
  console.log(`\nTest by making an authenticated API call now.\n`);

} else if (command === "set-valid-session") {
  // Set a session to expire in 10 minutes (should be valid, > 5min buffer)
  const email = process.argv[3];
  if (!email) {
    console.log("Usage: node scripts/test-session-expiry.js set-valid-session <email>");
    process.exit(1);
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    console.log(`User ${email} not found`);
    process.exit(1);
  }

  const session = db.prepare("SELECT id, token, expires_at FROM sessions WHERE user_id = ?").get(user.id);
  if (!session) {
    console.log(`No session found for ${email}. Please log in first.`);
    process.exit(1);
  }

  // Set expiry to 10 minutes from now (more than 5min buffer)
  const newExpiry = new Date();
  newExpiry.setMinutes(newExpiry.getMinutes() + 10);
  
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(newExpiry.toISOString(), session.id);
  
  console.log(`\n✓ Session for ${email} set to expire in 10 minutes`);
  console.log(`  Expiry time: ${newExpiry.toISOString()}`);
  console.log(`  Current time: ${new Date().toISOString()}`);
  console.log(`\n✓ Expected: Session should be VALID (10min > 5min buffer)`);
  console.log(`\nTest by making an authenticated API call now.\n`);

} else if (command === "set-expired") {
  // Set a session to already be expired
  const email = process.argv[3];
  if (!email) {
    console.log("Usage: node scripts/test-session-expiry.js set-expired <email>");
    process.exit(1);
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    console.log(`User ${email} not found`);
    process.exit(1);
  }

  const session = db.prepare("SELECT id, token, expires_at FROM sessions WHERE user_id = ?").get(user.id);
  if (!session) {
    console.log(`No session found for ${email}. Please log in first.`);
    process.exit(1);
  }

  // Set expiry to 1 minute ago
  const newExpiry = new Date();
  newExpiry.setMinutes(newExpiry.getMinutes() - 1);
  
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(newExpiry.toISOString(), session.id);
  
  console.log(`\n✓ Session for ${email} set to expired (1 minute ago)`);
  console.log(`  Expiry time: ${newExpiry.toISOString()}`);
  console.log(`  Current time: ${new Date().toISOString()}`);
  console.log(`\n⚠️  Expected: Session should be INVALID (already expired)`);
  console.log(`\nTest by making an authenticated API call now.\n`);

} else if (command === "check-status") {
  // Check current session status with buffer calculation
  const email = process.argv[3];
  if (!email) {
    console.log("Usage: node scripts/test-session-expiry.js check-status <email>");
    process.exit(1);
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    console.log(`User ${email} not found`);
    process.exit(1);
  }

  const session = db.prepare("SELECT id, token, expires_at FROM sessions WHERE user_id = ?").get(user.id);
  if (!session) {
    console.log(`No session found for ${email}`);
    process.exit(1);
  }

  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const expiresIn = expiresAt.getTime() - now.getTime();
  const isValid = expiresIn > bufferMs;

  console.log(`\n=== Session Status for ${email} ===`);
  console.log(`Token: ${session.token.substring(0, 30)}...`);
  console.log(`Expires at: ${expiresAt.toISOString()}`);
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Time until expiry: ${Math.round(expiresIn / 1000 / 60 * 100) / 100} minutes`);
  console.log(`Buffer (5 minutes): ${bufferMs / 1000 / 60} minutes`);
  console.log(`\nSession Status: ${isValid ? "✓ VALID" : "✗ INVALID"}`);
  console.log(`Reason: ${isValid 
    ? `More than ${bufferMs / 1000 / 60} minutes remaining` 
    : expiresIn <= 0 
      ? "Session has already expired"
      : `Less than ${bufferMs / 1000 / 60} minutes remaining (buffer applies)`}`);
  console.log();

} else {
  console.log(`
Session Expiry Test Utility
============================

This script helps test the session expiry buffer fix (5-minute buffer).

Commands:
  set-1min-expiry <email>    - Set session to expire in 1 minute (should be INVALID)
  set-near-expiry <email>    - Set session to expire in 4 minutes (should be INVALID)
  set-valid-session <email>  - Set session to expire in 10 minutes (should be VALID)
  set-expired <email>        - Set session to already be expired (should be INVALID)
  check-status <email>       - Check current session status with buffer calculation

Examples:
  node scripts/test-session-expiry.js set-1min-expiry test@example.com
  node scripts/test-session-expiry.js set-near-expiry test@example.com
  node scripts/test-session-expiry.js set-valid-session test@example.com
  node scripts/test-session-expiry.js set-expired test@example.com
  node scripts/test-session-expiry.js check-status test@example.com

Testing Steps:
1. Log in to create a session
2. Use one of the set-* commands to modify the session expiry
3. Make an authenticated API call (e.g., visit dashboard page)
4. Verify the expected behavior based on the test case
  `);
}

db.close();

