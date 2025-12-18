import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/routers";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(__dirname, "..", "bank.db");
const db = new Database(dbPath);

const TEST_EMAIL = process.env.TEST_EMAIL || "71ashu@gmail.com";
const FUNDING_AMOUNT = Number(process.env.FUNDING_AMOUNT || "10.20");
const ITERATIONS = Number(process.env.ITERATIONS || "1000");

async function main() {
  // Look up user
  const user = db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .get(TEST_EMAIL) as { id: number; email: string } | undefined;

  if (!user) {
    console.error(`No user found with email ${TEST_EMAIL}. Please sign up / create one first.`);
    process.exit(1);
  }

  // Look up an active account for the user
  const account = db
    .prepare("SELECT id, balance, status FROM accounts WHERE user_id = ? AND status = 'active' LIMIT 1")
    .get(user.id) as { id: number; balance: number; status: string } | undefined;

  if (!account) {
    console.error(
      `No active account found for user ${TEST_EMAIL}. Please create an account in the app before running this script.`,
    );
    process.exit(1);
  }

  // Get latest (non‑expired) session token for that user
  const session = db
    .prepare(
      `
      SELECT token, expires_at 
      FROM sessions 
      WHERE user_id = ? 
      ORDER BY expires_at DESC 
      LIMIT 1
    `,
    )
    .get(user.id) as { token: string; expires_at: string } | undefined;

  if (!session) {
    console.error(
      `No session found for user ${TEST_EMAIL}. Please log in via the app so a session cookie is created, then rerun this script.`,
    );
    process.exit(1);
  }

  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "http://localhost:3000/api/trpc",
        headers() {
          // Reuse the session token as the cookie expected by the backend
          return {
            cookie: `session=${session.token}`,
          };
        },
      }),
    ],
  });

  console.log(
    `Running fundAccount ${ITERATIONS} times for user ${user.email}, account ${account.id}, amount ${FUNDING_AMOUNT}...`,
  );

  let lastBalanceFromApi: number | null = null;

  for (let i = 0; i < ITERATIONS; i++) {
    const result = await client.account.fundAccount.mutate({
      accountId: account.id,
      amount: FUNDING_AMOUNT,
      fundingSource: {
        type: "card",
        accountNumber: "4242424242424242",
        routingNumber: "",
      },
    });

    lastBalanceFromApi = result.newBalance;

    console.log(
      `Call #${i + 1}: newBalance from API = ${result.newBalance}`,
    );
  }

  // Read final balance directly from DB for comparison
  const finalAccount = db
    .prepare("SELECT balance FROM accounts WHERE id = ?")
    .get(account.id) as { balance: number } | undefined;

  console.log("\n=== Summary ===");
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Amount per call: ${FUNDING_AMOUNT}`);
  if (lastBalanceFromApi !== null) {
    console.log(`Last newBalance from API: ${lastBalanceFromApi}`);
  }
  console.log(
    `Final stored account balance in DB: ${finalAccount ? finalAccount.balance : "N/A"}`,
  );
}

main()
  .catch((err) => {
    console.error("Error while running funding script:", err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });


