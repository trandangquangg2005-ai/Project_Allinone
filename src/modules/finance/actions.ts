"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withTenant, type Tx } from "@/db";
import { categories, debtPayments, debts, transactions, wallets } from "@/db/schema";
import { createAction, UserError } from "@/lib/action";
import { getDebt, transactionCountForWallet } from "./queries";
import {
  archiveSchema,
  categorySchema,
  debtPaymentSchema,
  debtSchema,
  deleteSchema,
  settleSchema,
  transactionSchema,
  walletSchema,
} from "./schemas";

const guard = { module: "finance" } as const;

function refresh() {
  // Per-user dynamic pages: invalidate everything (dashboard, finance, tutoring).
  revalidatePath("/", "layout");
}

const LOCKED_SOURCE: Record<string, string> = {
  tutoring: "Giao dịch này được tạo khi thu học phí. Hãy sửa hoặc xóa ở mục Gia sư.",
  debt: "Giao dịch này gắn với một khoản nợ. Hãy sửa hoặc xóa ở mục Nợ.",
};

async function assertWallets(tx: Tx, userId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const rows = await tx
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), inArray(wallets.id, unique)));
  if (rows.length !== unique.length) throw new UserError("Không tìm thấy ví.");
}

// ---------------------------------------------------------------- transactions

export const saveTransaction = createAction({ ...guard, name: "saveTransaction" }, transactionSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    await assertWallets(tx, user.id, [input.walletId, ...(input.kind === "transfer" && input.toWalletId ? [input.toWalletId] : [])]);
    if (input.kind !== "transfer") {
      const [category] = await tx
        .select({ kind: categories.kind })
        .from(categories)
        .where(and(eq(categories.userId, user.id), eq(categories.id, input.categoryId!)))
        .limit(1);
      if (!category || category.kind !== input.kind) throw new UserError("Danh mục không khớp loại giao dịch.");
    }

    const values = {
      kind: input.kind,
      amount: input.amount,
      walletId: input.walletId,
      toWalletId: input.kind === "transfer" ? input.toWalletId! : null,
      categoryId: input.kind === "transfer" ? null : input.categoryId!,
      occurredOn: input.occurredOn,
      note: input.note,
    };

    if (input.id) {
      const [existing] = await tx
        .select({ source: transactions.source })
        .from(transactions)
        .where(and(eq(transactions.userId, user.id), eq(transactions.id, input.id)))
        .limit(1);
      if (!existing) throw new UserError("Không tìm thấy giao dịch.");
      if (existing.source !== "manual") throw new UserError(LOCKED_SOURCE[existing.source]);
      await tx
        .update(transactions)
        .set(values)
        .where(and(eq(transactions.userId, user.id), eq(transactions.id, input.id)));
    } else {
      await tx.insert(transactions).values({ ...values, userId: user.id, source: "manual" });
    }
  });
  refresh();
  return null;
});

export const deleteTransaction = createAction({ ...guard, name: "deleteTransaction" }, deleteSchema, async ({ id }, { user }) => {
  await withTenant(user.id, async (tx) => {
    const [existing] = await tx
      .select({ source: transactions.source })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.id, id)))
      .limit(1);
    if (!existing) throw new UserError("Không tìm thấy giao dịch.");
    if (existing.source !== "manual") throw new UserError(LOCKED_SOURCE[existing.source]);
    await tx.delete(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.id, id)));
  });
  refresh();
  return null;
});

// --------------------------------------------------------------------- wallets

export const saveWallet = createAction({ ...guard, name: "saveWallet" }, walletSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const values = { name: input.name, kind: input.kind, openingBalance: input.openingBalance, color: input.color };
    if (input.id) {
      const updated = await tx
        .update(wallets)
        .set(values)
        .where(and(eq(wallets.userId, user.id), eq(wallets.id, input.id)))
        .returning({ id: wallets.id });
      if (!updated.length) throw new UserError("Không tìm thấy ví.");
    } else {
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${wallets.sortOrder}), -1)::int + 1`.mapWith(Number) })
        .from(wallets)
        .where(eq(wallets.userId, user.id));
      await tx.insert(wallets).values({ ...values, userId: user.id, sortOrder: next });
    }
  });
  refresh();
  return null;
});

export const archiveWallet = createAction({ ...guard, name: "archiveWallet" }, archiveSchema, async ({ id, archived }, { user }) => {
  await withTenant(user.id, async (tx) => {
    if (archived) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
        .from(wallets)
        .where(and(eq(wallets.userId, user.id), isNull(wallets.archivedAt)));
      if (n <= 1) throw new UserError("Cần giữ lại ít nhất một ví đang dùng.");
    }
    await tx
      .update(wallets)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(wallets.userId, user.id), eq(wallets.id, id)));
  });
  refresh();
  return null;
});

export const deleteWallet = createAction({ ...guard, name: "deleteWallet" }, deleteSchema, async ({ id }, { user }) => {
  await withTenant(user.id, async (tx) => {
    if ((await transactionCountForWallet(tx, user.id, id)) > 0) {
      throw new UserError("Ví này đã có giao dịch nên không xóa được. Hãy ẩn ví thay vì xóa.");
    }
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
      .from(wallets)
      .where(and(eq(wallets.userId, user.id), isNull(wallets.archivedAt)));
    if (n <= 1) throw new UserError("Cần giữ lại ít nhất một ví đang dùng.");
    await tx.delete(wallets).where(and(eq(wallets.userId, user.id), eq(wallets.id, id)));
  });
  refresh();
  return null;
});

// ------------------------------------------------------------------ categories

export const saveCategory = createAction({ ...guard, name: "saveCategory" }, categorySchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const values = { kind: input.kind, name: input.name, icon: input.icon, color: input.color };
    if (input.id) {
      const [existing] = await tx
        .select({ kind: categories.kind, systemKey: categories.systemKey })
        .from(categories)
        .where(and(eq(categories.userId, user.id), eq(categories.id, input.id)))
        .limit(1);
      if (!existing) throw new UserError("Không tìm thấy danh mục.");
      if (existing.kind !== input.kind) {
        if (existing.systemKey) throw new UserError("Danh mục hệ thống không đổi loại được.");
        const [{ n }] = await tx
          .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
          .from(transactions)
          .where(and(eq(transactions.userId, user.id), eq(transactions.categoryId, input.id)));
        if (n > 0) throw new UserError("Danh mục đã có giao dịch nên không đổi giữa thu và chi được.");
      }
      await tx
        .update(categories)
        .set(values)
        .where(and(eq(categories.userId, user.id), eq(categories.id, input.id)));
    } else {
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${categories.sortOrder}), -1)::int + 1`.mapWith(Number) })
        .from(categories)
        .where(and(eq(categories.userId, user.id), eq(categories.kind, input.kind)));
      await tx.insert(categories).values({ ...values, userId: user.id, sortOrder: next });
    }
  });
  refresh();
  return null;
});

export const archiveCategory = createAction({ ...guard, name: "archiveCategory" }, archiveSchema, async ({ id, archived }, { user }) => {
  await withTenant(user.id, async (tx) => {
    await tx
      .update(categories)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(categories.userId, user.id), eq(categories.id, id)));
  });
  refresh();
  return null;
});

// ----------------------------------------------------------------------- debts

function debtMovement(direction: "lent" | "borrowed", phase: "open" | "repay") {
  // lent: money leaves when lending, comes back on repayment. borrowed: reverse.
  const outgoing = (direction === "lent") === (phase === "open");
  return outgoing ? ("expense" as const) : ("income" as const);
}

export const saveDebt = createAction({ ...guard, name: "saveDebt" }, debtSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const values = {
      direction: input.direction,
      counterparty: input.counterparty,
      phone: input.phone,
      principal: input.principal,
      occurredOn: input.occurredOn,
      dueOn: input.dueOn ?? null,
      note: input.note,
    };

    if (input.id) {
      const current = await getDebt(tx, user.id, input.id);
      if (!current) throw new UserError("Không tìm thấy khoản nợ.");
      if (input.principal < current.paid) {
        throw new UserError("Số tiền gốc không được nhỏ hơn số đã trả.");
      }
      // Only a principal change re-evaluates "settled"; a manual close
      // (e.g. a forgiven debt) survives edits to the name or note.
      const settledAt =
        input.principal === current.principal
          ? undefined
          : input.principal > current.paid
            ? null
            : sql`coalesce(${debts.settledAt}, now())`;
      const [updated] = await tx
        .update(debts)
        .set({
          ...values,
          direction: current.direction, // direction is fixed once created
          ...(settledAt === undefined ? {} : { settledAt }),
        })
        .where(and(eq(debts.userId, user.id), eq(debts.id, input.id)))
        .returning({ transactionId: debts.transactionId });
      if (updated?.transactionId) {
        await tx
          .update(transactions)
          .set({ amount: input.principal, occurredOn: input.occurredOn })
          .where(and(eq(transactions.userId, user.id), eq(transactions.id, updated.transactionId)));
      }
      return;
    }

    const [debt] = await tx
      .insert(debts)
      .values({ ...values, userId: user.id })
      .returning({ id: debts.id });

    if (input.walletId) {
      await assertWallets(tx, user.id, [input.walletId]);
      const [movement] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          kind: debtMovement(input.direction, "open"),
          amount: input.principal,
          walletId: input.walletId,
          occurredOn: input.occurredOn,
          note: input.direction === "lent" ? `Cho ${input.counterparty} vay` : `Vay ${input.counterparty}`,
          source: "debt",
        })
        .returning({ id: transactions.id });
      await tx
        .update(debts)
        .set({ walletId: input.walletId, transactionId: movement.id })
        .where(and(eq(debts.userId, user.id), eq(debts.id, debt.id)));
    }
  });
  refresh();
  return null;
});

export const addDebtPayment = createAction({ ...guard, name: "addDebtPayment" }, debtPaymentSchema, async (input, { user }) => {
  await withTenant(user.id, async (tx) => {
    const debt = await getDebt(tx, user.id, input.debtId);
    if (!debt) throw new UserError("Không tìm thấy khoản nợ.");
    if (input.amount > debt.remaining) {
      throw new UserError("Số tiền trả lớn hơn số còn lại của khoản nợ.");
    }

    let transactionId: string | null = null;
    if (input.walletId) {
      await assertWallets(tx, user.id, [input.walletId]);
      const [movement] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          kind: debtMovement(debt.direction, "repay"),
          amount: input.amount,
          walletId: input.walletId,
          occurredOn: input.paidOn,
          note: debt.direction === "lent" ? `${debt.counterparty} trả nợ` : `Trả nợ ${debt.counterparty}`,
          source: "debt",
        })
        .returning({ id: transactions.id });
      transactionId = movement.id;
    }

    await tx.insert(debtPayments).values({
      userId: user.id,
      debtId: input.debtId,
      amount: input.amount,
      paidOn: input.paidOn,
      note: input.note,
      walletId: input.walletId ?? null,
      transactionId,
    });

    if (input.amount === debt.remaining) {
      await tx
        .update(debts)
        .set({ settledAt: new Date() })
        .where(and(eq(debts.userId, user.id), eq(debts.id, input.debtId)));
    }
  });
  refresh();
  return null;
});

export const deleteDebtPayment = createAction({ ...guard, name: "deleteDebtPayment" }, deleteSchema, async ({ id }, { user }) => {
  await withTenant(user.id, async (tx) => {
    const [payment] = await tx
      .delete(debtPayments)
      .where(and(eq(debtPayments.userId, user.id), eq(debtPayments.id, id)))
      .returning({ debtId: debtPayments.debtId, transactionId: debtPayments.transactionId });
    if (!payment) throw new UserError("Không tìm thấy lần trả này.");
    if (payment.transactionId) {
      await tx
        .delete(transactions)
        .where(and(eq(transactions.userId, user.id), eq(transactions.id, payment.transactionId)));
    }
    // Paying back less than the principal re-opens the debt.
    const debt = await getDebt(tx, user.id, payment.debtId);
    if (debt && debt.remaining > 0) {
      await tx
        .update(debts)
        .set({ settledAt: null })
        .where(and(eq(debts.userId, user.id), eq(debts.id, payment.debtId)));
    }
  });
  refresh();
  return null;
});

export const deleteDebt = createAction({ ...guard, name: "deleteDebt" }, deleteSchema, async ({ id }, { user }) => {
  await withTenant(user.id, async (tx) => {
    const [debt] = await tx
      .select({ transactionId: debts.transactionId })
      .from(debts)
      .where(and(eq(debts.userId, user.id), eq(debts.id, id)))
      .limit(1);
    if (!debt) throw new UserError("Không tìm thấy khoản nợ.");
    const payments = await tx
      .select({ transactionId: debtPayments.transactionId })
      .from(debtPayments)
      .where(and(eq(debtPayments.userId, user.id), eq(debtPayments.debtId, id)));
    const linked = [debt.transactionId, ...payments.map((p) => p.transactionId)].filter((v): v is string => !!v);

    // Payments cascade with the debt; the wallet movements go after them.
    await tx.delete(debts).where(and(eq(debts.userId, user.id), eq(debts.id, id)));
    if (linked.length) {
      await tx.delete(transactions).where(and(eq(transactions.userId, user.id), inArray(transactions.id, linked)));
    }
  });
  refresh();
  return null;
});

export const setDebtSettled = createAction({ ...guard, name: "setDebtSettled" }, settleSchema, async ({ id, settled }, { user }) => {
  await withTenant(user.id, async (tx) => {
    const debt = await getDebt(tx, user.id, id);
    if (!debt) throw new UserError("Không tìm thấy khoản nợ.");
    if (!settled && debt.remaining === 0) {
      throw new UserError("Khoản này đã trả đủ. Xóa bớt một lần trả nếu muốn mở lại.");
    }
    await tx
      .update(debts)
      .set({ settledAt: settled ? new Date() : null })
      .where(and(eq(debts.userId, user.id), eq(debts.id, id)));
  });
  refresh();
  return null;
});
