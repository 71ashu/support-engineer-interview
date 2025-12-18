import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateEmail } from "@/lib/utils/email-validation";

// Custom email validation schema
const emailSchema = z
  .string()
  .min(1, "Email is required")
  .refine(
    (email) => {
      const validation = validateEmail(email);
      return validation.isValid;
    },
    (email) => {
      const validation = validateEmail(email);
      return {
        message: validation.error || "Invalid email address",
      };
    }
  )
  .transform((email) => {
    // Normalize to lowercase after validation
    const validation = validateEmail(email);
    return validation.normalizedEmail || email.toLowerCase();
  });

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().regex(/^\+?\d{10,15}$/),
        dateOfBirth: z.string(),
        ssn: z.string().regex(/^\d{9}$/),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().length(2).toUpperCase(),
        zipCode: z.string().regex(/^\d{5}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingUser = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      await db.insert(users).values({
        ...input,
        password: hashedPassword,
      });

      // Fetch the created user
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Invalidate any existing sessions for this user before creating a new one
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      // Create session
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      // Set cookie
      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      return { user: { ...user, password: undefined }, token };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.select().from(users).where(eq(users.email, input.email)).get();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Invalidate any existing sessions for this user before creating a new one
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      return { user: { ...user, password: undefined }, token };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Always attempt to invalidate the session based on the cookie,
    // regardless of whether ctx.user is currently populated.
    let token: string | undefined;

    if ("cookies" in ctx.req) {
      // Fetch / App Router-style request (Headers-based)
      const cookieHeader = ctx.req.headers.get?.("cookie") || (ctx.req.headers as any).cookie || "";
      const cookiesObj = Object.fromEntries(
        cookieHeader
          .split("; ")
          .filter(Boolean)
          .map((c: string) => {
            const [key, ...val] = c.split("=");
            return [key, val.join("=")];
          })
      );
      token = cookiesObj.session;
    }

    let hadActiveSession = false;

    if (token) {
      try {
        // Decode the token so we can revoke ALL sessions for this user,
        // not just the single session row that matches this token.
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "temporary-secret-for-interview") as {
          userId: number;
        };

        hadActiveSession = true;

        // Revoke all sessions for this user to ensure no stale tokens remain valid.
        await db.delete(sessions).where(eq(sessions.userId, decoded.userId));
      } catch {
        // If the token is invalid or can't be decoded, fall back to best-effort revocation by token value.
        hadActiveSession = true;
        await db.delete(sessions).where(eq(sessions.token, token));
      }
    }

    // Clear the cookie on the client either way
    if ("setHeader" in ctx.res) {
      ctx.res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    } else {
      (ctx.res as Headers).set("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }

    return {
      // The operation completed successfully (cookie cleared, session invalidated if present)
      success: true,
      // For debugging or callers that care about whether there *was* an active session
      hadActiveSession,
      message: hadActiveSession ? "Logged out successfully" : "You were already logged out",
    };
  }),
});
