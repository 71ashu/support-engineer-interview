import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { isValidCardNumber } from "@/lib/utils/card-validation";

function generateAccountNumber(): string {
  // Use cryptographically secure random numbers to generate a 10‑digit account number
  let accountNumber = "";
  for (let i = 0; i < 10; i++) {
    // randomInt(0, 10) returns a uniform integer in [0, 9]
    accountNumber += randomInt(0, 10).toString();
  }
  return accountNumber;
}

export const accountRouter = router({
  createAccount: protectedProcedure
    .input(
      z.object({
        accountType: z.enum(["checking", "savings"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already has an account of this type
      const existingAccount = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.accountType, input.accountType)))
        .get();

      if (existingAccount) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have a ${input.accountType} account`,
        });
      }

      let accountNumber;
      let isUnique = false;

      // Generate unique account number
      while (!isUnique) {
        accountNumber = generateAccountNumber();
        const existing = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).get();
        isUnique = !existing;
      }

      await db.insert(accounts).values({
        userId: ctx.user.id,
        accountNumber: accountNumber!,
        accountType: input.accountType,
        balance: 0,
        status: "active",
      });

      // Fetch the created account
      const account = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber!)).get();

      if (!account) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account. Please try again.",
        });
      }

      return account;
    }),

  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

    return userAccounts;
  }),

  fundAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.number().positive(),
        fundingSource: z
          .object({
            type: z.enum(["card", "bank"]),
            accountNumber: z.string(),
            routingNumber: z.string().optional(),
          })
          // Ensure routing number is present and valid for bank transfers
          .refine(
            (source) =>
              source.type !== "bank" ||
              (typeof source.routingNumber === "string" &&
                /^\d{9}$/.test(source.routingNumber)),
            {
              message: "Routing number is required and must be 9 digits for bank transfers",
              path: ["routingNumber"],
            }
          ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const amount = parseFloat(input.amount.toString());

      // Validate card number if funding source is a card
      if (input.fundingSource.type === "card") {
        const cardNumber = input.fundingSource.accountNumber;
        if (!isValidCardNumber(cardNumber)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid card number. Please check the number and try again.",
          });
        }
      }

      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account is not active",
        });
      }

      // Create transaction
      await db.insert(transactions).values({
        accountId: input.accountId,
        type: "deposit",
        amount,
        description: `Funding from ${input.fundingSource.type}`,
        status: "completed",
        processedAt: new Date().toISOString(),
      });

      // Fetch the created transaction
      const transaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId))
        .orderBy(transactions.createdAt)
        .limit(1)
        .get();

      // Update account balance
      await db
        .update(accounts)
        .set({
          balance: account.balance + amount,
        })
        .where(eq(accounts.id, input.accountId));
      
      // Re-fetch the updated account to get the authoritative balance from the database
      const updatedAccount = await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
      
      return {
        transaction,
        newBalance: updatedAccount?.balance ?? account.balance + amount,
      };
    }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId))
        .orderBy(desc(transactions.createdAt));

      const enrichedTransactions = [];
      for (const transaction of accountTransactions) {
        const accountDetails = await db.select().from(accounts).where(eq(accounts.id, transaction.accountId)).get();

        enrichedTransactions.push({
          ...transaction,
          accountType: accountDetails?.accountType,
        });
      }

      return enrichedTransactions;
    }),
});
