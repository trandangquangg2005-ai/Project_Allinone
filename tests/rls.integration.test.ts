/**
 * Runs against the real database as the restricted `aio_app` role and proves
 * that one account can never read, change or reference another account's data.
 * Creates two throwaway accounts and deletes them (cascading) afterwards.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createPool, runAsTenant, setLocal } from "@/db/client";
import { categories, debtPayments, debts, lessons, shareLinks, students, transactions, users, wallets } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { provisionAccount } from "@/modules/accounts/provision";
import { listDebts, listWallets } from "@/modules/finance/queries";
import { listStudents } from "@/modules/tutoring/queries";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.DATABASE_URL;

async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    let current: unknown = error;
    while (current && typeof current === "object") {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
      current = (current as { cause?: unknown }).cause;
    }
    throw error;
  }
}

describe.skipIf(!url)("tenant isolation on Neon (RLS + composite keys)", () => {
  const pool = createPool(url ?? "postgres://skip", 4);
  const db = createDb(pool);
  const suffix = randomUUID().slice(0, 8);
  const ids = { a: "", b: "", aCash: "", aBank: "", aStudent: "", aStudent2: "", bExpenseCategory: "" };

  beforeAll(async () => {
    const created = await db
      .insert(users)
      .values([
        { username: `qa.rls.a.${suffix}`, displayName: "RLS A", passwordHash: "x", modules: ["finance", "tutoring"] },
        { username: `qa.rls.b.${suffix}`, displayName: "RLS B", passwordHash: "x", modules: ["finance"] },
      ])
      .returning({ id: users.id, username: users.username });
    ids.a = created.find((u) => u.username.startsWith("qa.rls.a"))!.id;
    ids.b = created.find((u) => u.username.startsWith("qa.rls.b"))!.id;
    await runAsTenant(db, ids.a, (tx) => provisionAccount(tx, ids.a));
    await runAsTenant(db, ids.b, (tx) => provisionAccount(tx, ids.b));

    await runAsTenant(db, ids.a, async (tx) => {
      const own = await tx.select({ id: wallets.id, kind: wallets.kind }).from(wallets).where(eq(wallets.userId, ids.a));
      ids.aCash = own.find((w) => w.kind === "cash")!.id;
      ids.aBank = own.find((w) => w.kind === "bank")!.id;
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.userId, ids.a), eq(categories.kind, "expense")))
        .limit(1);
      await tx.insert(transactions).values({
        userId: ids.a,
        kind: "expense",
        amount: 45_000,
        walletId: ids.aCash,
        categoryId: category.id,
        occurredOn: "2026-09-22",
      });
      const inserted = await tx
        .insert(students)
        .values([
          { userId: ids.a, name: "Học sinh A1", ratePerSession: 200_000 },
          { userId: ids.a, name: "Học sinh A2", ratePerSession: 150_000 },
        ])
        .returning({ id: students.id, name: students.name });
      ids.aStudent = inserted.find((s) => s.name.endsWith("A1"))!.id;
      ids.aStudent2 = inserted.find((s) => s.name.endsWith("A2"))!.id;
      await tx.insert(lessons).values([
        {
          userId: ids.a,
          studentId: ids.aStudent,
          status: "completed",
          checkInAt: new Date("2026-09-22T11:00:00Z"),
          checkOutAt: new Date("2026-09-22T12:30:00Z"),
          fee: 200_000,
        },
        {
          userId: ids.a,
          studentId: ids.aStudent2,
          status: "completed",
          checkInAt: new Date("2026-09-21T11:00:00Z"),
          checkOutAt: new Date("2026-09-21T12:00:00Z"),
          fee: 150_000,
        },
      ]);
    });

    await runAsTenant(db, ids.b, async (tx) => {
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.userId, ids.b), eq(categories.kind, "expense")))
        .limit(1);
      ids.bExpenseCategory = category.id;
    });
  });

  afterAll(async () => {
    const owned = [ids.a, ids.b].filter(Boolean);
    if (owned.length) await db.delete(users).where(inArray(users.id, owned));
    await pool.end();
  });

  it("hides every row of account A from account B, even without a WHERE", async () => {
    const seen = await runAsTenant(db, ids.b, async (tx) => ({
      wallets: await tx.select({ userId: wallets.userId }).from(wallets),
      transactions: await tx.select({ userId: transactions.userId }).from(transactions),
      students: await tx.select({ userId: students.userId }).from(students),
      lessons: await tx.select({ userId: lessons.userId }).from(lessons),
    }));
    expect(seen.wallets.length).toBeGreaterThan(0); // B's own default wallets
    for (const rows of Object.values(seen)) {
      expect(rows.every((r) => r.userId === ids.b)).toBe(true);
    }
    expect(seen.students).toHaveLength(0);
    expect(seen.lessons).toHaveLength(0);
  });

  it("lets B neither update nor delete A's rows by guessing their ids", async () => {
    await runAsTenant(db, ids.b, async (tx) => {
      const updated = await tx.update(wallets).set({ name: "hacked" }).where(eq(wallets.id, ids.aCash)).returning({ id: wallets.id });
      const deleted = await tx.delete(students).where(eq(students.id, ids.aStudent)).returning({ id: students.id });
      expect(updated).toHaveLength(0);
      expect(deleted).toHaveLength(0);
    });
    const [wallet] = await runAsTenant(db, ids.a, (tx) =>
      tx.select({ name: wallets.name }).from(wallets).where(eq(wallets.id, ids.aCash)),
    );
    expect(wallet.name).not.toBe("hacked");
  });

  it("rejects a row written into another account", async () => {
    const code = await pgCode(runAsTenant(db, ids.b, (tx) => tx.insert(wallets).values({ userId: ids.a, name: `x-${suffix}` })));
    expect(code).toBe("42501"); // row-level security violation
  });

  it("rejects references to another account's wallet (composite foreign key)", async () => {
    const code = await pgCode(
      runAsTenant(db, ids.b, (tx) =>
        tx.insert(transactions).values({
          userId: ids.b,
          kind: "expense",
          amount: 1_000,
          walletId: ids.aCash,
          categoryId: ids.bExpenseCategory,
          occurredOn: "2026-09-22",
        }),
      ),
    );
    expect(code).toBe("23503"); // foreign key violation
  });

  it("shows nothing at all when no tenant is set", async () => {
    const rows = await db.select({ id: wallets.id }).from(wallets);
    expect(rows).toHaveLength(0);
  });

  it("limits a parent link to exactly one student", async () => {
    const hash = sha256(`token-${suffix}`);
    await runAsTenant(db, ids.a, (tx) =>
      tx.insert(shareLinks).values({ userId: ids.a, studentId: ids.aStudent, tokenHash: hash, tokenCipher: "unused" }),
    );

    const seen = await db.transaction(async (tx) => {
      await setLocal(tx, { "app.share_token_hash": hash });
      const links = await tx.select({ userId: shareLinks.userId, studentId: shareLinks.studentId }).from(shareLinks);
      await setLocal(tx, { "app.user_id": links[0].userId, "app.student_id": links[0].studentId });
      return {
        links,
        students: (await tx.select({ id: students.id }).from(students)).map((s) => s.id),
        lessonStudents: [...new Set((await tx.select({ studentId: lessons.studentId }).from(lessons)).map((l) => l.studentId))],
      };
    });

    expect(seen.links).toHaveLength(1);
    expect(seen.students).toEqual([ids.aStudent]);
    expect(seen.lessonStudents).toEqual([ids.aStudent]);

    // A wrong hash sees no link at all.
    const none = await db.transaction(async (tx) => {
      await setLocal(tx, { "app.share_token_hash": sha256("wrong") });
      return tx.select({ id: shareLinks.id }).from(shareLinks);
    });
    expect(none).toHaveLength(0);
  });

  it("computes wallet balances, debt payments and student balances", async () => {
    await runAsTenant(db, ids.a, async (tx) => {
      const [debt] = await tx
        .insert(debts)
        .values({ userId: ids.a, direction: "lent", counterparty: "Minh", principal: 2_000_000, occurredOn: "2026-09-22" })
        .returning({ id: debts.id });
      await tx.insert(transactions).values([
        { userId: ids.a, kind: "expense", amount: 2_000_000, walletId: ids.aCash, occurredOn: "2026-09-22", source: "debt" },
        { userId: ids.a, kind: "income", amount: 500_000, walletId: ids.aBank, occurredOn: "2026-09-22", source: "debt" },
        { userId: ids.a, kind: "transfer", amount: 100_000, walletId: ids.aBank, toWalletId: ids.aCash, occurredOn: "2026-09-22" },
      ]);
      await tx.insert(debtPayments).values({ userId: ids.a, debtId: debt.id, amount: 500_000, paidOn: "2026-09-22" });

      const balances = Object.fromEntries((await listWallets(tx, ids.a)).map((w) => [w.id, w.balance]));
      expect(balances[ids.aCash]).toBe(-45_000 - 2_000_000 + 100_000);
      expect(balances[ids.aBank]).toBe(500_000 - 100_000);

      const lent = (await listDebts(tx, ids.a)).find((d) => d.id === debt.id)!;
      expect(lent.paid).toBe(500_000);
      expect(lent.remaining).toBe(1_500_000);
      expect(lent.settled).toBe(false);

      const roster = await listStudents(tx, ids.a, "2026-09");
      const a1 = roster.find((s) => s.id === ids.aStudent)!;
      expect(a1.monthLessons).toBe(1);
      expect(a1.balance).toBe(200_000);
    });
  });

  it("allows only one lesson in progress per account", async () => {
    const code = await pgCode(
      runAsTenant(db, ids.a, (tx) =>
        tx.insert(lessons).values([
          { userId: ids.a, studentId: ids.aStudent, status: "in_progress", checkInAt: sql`now()`, fee: 1 },
          { userId: ids.a, studentId: ids.aStudent2, status: "in_progress", checkInAt: sql`now()`, fee: 1 },
        ]),
      ),
    );
    expect(code).toBe("23505");
  });
});
