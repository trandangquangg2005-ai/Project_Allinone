import "server-only";
import { aliasedTable, and, asc, desc, eq, gte, ilike, isNull, lt, or, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { categories, debtPayments, debts, transactions, wallets } from "@/db/schema";
import { monthDateRange, shiftMonth, todayVN } from "@/lib/datetime";
import type { CategoryView, DebtPaymentView, DebtView, TransactionView, TxKind, WalletView } from "./types";

// Every query filters by user_id explicitly *and* runs under RLS (withTenant).

// Correlated subqueries spell out the outer table: Drizzle leaves columns
// unqualified in join-free selects, and a bare "id" would bind to the inner table.
const walletBalance = sql<number>`("wallets"."opening_balance" + coalesce((
    select sum(case
      when t.kind = 'income' and t.wallet_id = "wallets"."id" then t.amount
      when t.kind = 'expense' and t.wallet_id = "wallets"."id" then -t.amount
      when t.kind = 'transfer' and t.wallet_id = "wallets"."id" then -t.amount
      when t.kind = 'transfer' and t.to_wallet_id = "wallets"."id" then t.amount
      else 0 end)
    from transactions t
    where t.user_id = "wallets"."user_id" and (t.wallet_id = "wallets"."id" or t.to_wallet_id = "wallets"."id")
  ), 0))::bigint`.mapWith(Number);

export async function listWallets(tx: Tx, userId: string, { includeArchived = false } = {}): Promise<WalletView[]> {
  const rows = await tx
    .select({
      id: wallets.id,
      name: wallets.name,
      kind: wallets.kind,
      color: wallets.color,
      openingBalance: wallets.openingBalance,
      archivedAt: wallets.archivedAt,
      balance: walletBalance,
    })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), includeArchived ? undefined : isNull(wallets.archivedAt)))
    .orderBy(sql`${wallets.archivedAt} is not null`, asc(wallets.sortOrder), asc(wallets.createdAt));
  return rows.map(({ archivedAt, ...w }) => ({ ...w, archived: archivedAt !== null }));
}

export async function listCategories(tx: Tx, userId: string, { includeArchived = false } = {}): Promise<CategoryView[]> {
  const rows = await tx
    .select({
      id: categories.id,
      kind: categories.kind,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      systemKey: categories.systemKey,
      archivedAt: categories.archivedAt,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), includeArchived ? undefined : isNull(categories.archivedAt)))
    .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name));
  return rows.map(({ archivedAt, ...c }) => ({ ...c, archived: archivedAt !== null }));
}

const toWallet = aliasedTable(wallets, "to_wallet");

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listTransactions(
  tx: Tx,
  userId: string,
  filters: { month: string; walletId?: string; categoryId?: string; kind?: TxKind; q?: string; limit?: number },
): Promise<TransactionView[]> {
  const { from, to } = monthDateRange(filters.month);
  const conditions = [eq(transactions.userId, userId), gte(transactions.occurredOn, from), lt(transactions.occurredOn, to)];
  if (filters.walletId) {
    conditions.push(or(eq(transactions.walletId, filters.walletId), eq(transactions.toWalletId, filters.walletId))!);
  }
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.kind) conditions.push(eq(transactions.kind, filters.kind));
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    conditions.push(or(ilike(transactions.note, pattern), ilike(categories.name, pattern))!);
  }

  const query = tx
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      walletId: transactions.walletId,
      walletName: wallets.name,
      toWalletId: transactions.toWalletId,
      toWalletName: toWallet.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      occurredOn: transactions.occurredOn,
      note: transactions.note,
      source: transactions.source,
    })
    .from(transactions)
    .innerJoin(wallets, and(eq(wallets.userId, transactions.userId), eq(wallets.id, transactions.walletId)))
    .leftJoin(toWallet, and(eq(toWallet.userId, transactions.userId), eq(toWallet.id, transactions.toWalletId)))
    .leftJoin(categories, and(eq(categories.userId, transactions.userId), eq(categories.id, transactions.categoryId)))
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt));
  return filters.limit ? query.limit(filters.limit) : query;
}

export async function recentTransactions(tx: Tx, userId: string, limit = 5): Promise<TransactionView[]> {
  return tx
    .select({
      id: transactions.id,
      kind: transactions.kind,
      amount: transactions.amount,
      walletId: transactions.walletId,
      walletName: wallets.name,
      toWalletId: transactions.toWalletId,
      toWalletName: toWallet.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      occurredOn: transactions.occurredOn,
      note: transactions.note,
      source: transactions.source,
    })
    .from(transactions)
    .innerJoin(wallets, and(eq(wallets.userId, transactions.userId), eq(wallets.id, transactions.walletId)))
    .leftJoin(toWallet, and(eq(toWallet.userId, transactions.userId), eq(toWallet.id, transactions.toWalletId)))
    .leftJoin(categories, and(eq(categories.userId, transactions.userId), eq(categories.id, transactions.categoryId)))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit);
}

// Income/expense exclude transfers (money moving between own wallets) and
// debt movements (lending is not spending).
const reportable = sql`${transactions.kind} <> 'transfer' and ${transactions.source} <> 'debt'`;

export async function monthSummary(tx: Tx, userId: string, month: string) {
  const { from, to } = monthDateRange(month);
  const [row] = await tx
    .select({
      income: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)::bigint`.mapWith(Number),
      expense: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)::bigint`.mapWith(Number),
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredOn, from), lt(transactions.occurredOn, to), reportable));
  return row;
}

export async function monthlyTotals(tx: Tx, userId: string, lastMonth: string, count: number) {
  const firstMonth = shiftMonth(lastMonth, -(count - 1));
  const rows = await tx
    .select({
      month: sql<string>`to_char(${transactions.occurredOn}, 'YYYY-MM')`,
      income: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'income'), 0)::bigint`.mapWith(Number),
      expense: sql<number>`coalesce(sum(${transactions.amount}) filter (where ${transactions.kind} = 'expense'), 0)::bigint`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, `${firstMonth}-01`),
        lt(transactions.occurredOn, `${shiftMonth(lastMonth, 1)}-01`),
        reportable,
      ),
    )
    .groupBy(sql`1`);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(firstMonth, i);
    const row = byMonth.get(month);
    return { month, income: row?.income ?? 0, expense: row?.expense ?? 0 };
  });
}

export async function totalsByCategory(tx: Tx, userId: string, month: string, kind: "income" | "expense") {
  const { from, to } = monthDateRange(month);
  return tx
    .select({
      categoryId: categories.id,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      total: sql<number>`sum(${transactions.amount})::bigint`.mapWith(Number),
      count: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(categories, and(eq(categories.userId, transactions.userId), eq(categories.id, transactions.categoryId)))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, kind),
        gte(transactions.occurredOn, from),
        lt(transactions.occurredOn, to),
        reportable,
      ),
    )
    .groupBy(categories.id, categories.name, categories.icon, categories.color)
    .orderBy(desc(sql`sum(${transactions.amount})`));
}

const paidSum = sql<number>`coalesce((
    select sum(p.amount) from debt_payments p where p.user_id = "debts"."user_id" and p.debt_id = "debts"."id"
  ), 0)::bigint`.mapWith(Number);

function toDebtView(row: {
  id: string;
  direction: "lent" | "borrowed";
  counterparty: string;
  phone: string;
  principal: number;
  paid: number;
  occurredOn: string;
  dueOn: string | null;
  note: string;
  settledAt: Date | null;
}): DebtView {
  const remaining = Math.max(row.principal - row.paid, 0);
  const { settledAt, ...rest } = row;
  return { ...rest, remaining, settled: settledAt !== null || remaining === 0 };
}

const debtColumns = {
  id: debts.id,
  direction: debts.direction,
  counterparty: debts.counterparty,
  phone: debts.phone,
  principal: debts.principal,
  paid: paidSum,
  occurredOn: debts.occurredOn,
  dueOn: debts.dueOn,
  note: debts.note,
  settledAt: debts.settledAt,
};

export async function listDebts(tx: Tx, userId: string): Promise<DebtView[]> {
  const rows = await tx
    .select(debtColumns)
    .from(debts)
    .where(eq(debts.userId, userId))
    .orderBy(sql`${debts.settledAt} is not null`, sql`${debts.dueOn} asc nulls last`, desc(debts.occurredOn));
  return rows.map(toDebtView);
}

export async function getDebt(tx: Tx, userId: string, id: string): Promise<DebtView | null> {
  const [row] = await tx.select(debtColumns).from(debts).where(and(eq(debts.userId, userId), eq(debts.id, id))).limit(1);
  return row ? toDebtView(row) : null;
}

export async function listDebtPayments(tx: Tx, userId: string, debtId: string): Promise<DebtPaymentView[]> {
  return tx
    .select({
      id: debtPayments.id,
      amount: debtPayments.amount,
      paidOn: debtPayments.paidOn,
      note: debtPayments.note,
      walletName: wallets.name,
    })
    .from(debtPayments)
    .leftJoin(wallets, and(eq(wallets.userId, debtPayments.userId), eq(wallets.id, debtPayments.walletId)))
    .where(and(eq(debtPayments.userId, userId), eq(debtPayments.debtId, debtId)))
    .orderBy(desc(debtPayments.paidOn), desc(debtPayments.createdAt));
}

/** All repayments of the account's debts, newest first, keyed by debt. */
export async function listAllDebtPayments(tx: Tx, userId: string): Promise<Record<string, DebtPaymentView[]>> {
  const rows = await tx
    .select({
      id: debtPayments.id,
      debtId: debtPayments.debtId,
      amount: debtPayments.amount,
      paidOn: debtPayments.paidOn,
      note: debtPayments.note,
      walletName: wallets.name,
    })
    .from(debtPayments)
    .leftJoin(wallets, and(eq(wallets.userId, debtPayments.userId), eq(wallets.id, debtPayments.walletId)))
    .where(eq(debtPayments.userId, userId))
    .orderBy(desc(debtPayments.paidOn), desc(debtPayments.createdAt));
  const grouped: Record<string, DebtPaymentView[]> = {};
  for (const { debtId, ...payment } of rows) (grouped[debtId] ??= []).push(payment);
  return grouped;
}

export async function debtTotals(tx: Tx, userId: string) {
  const all = await listDebts(tx, userId);
  const open = all.filter((d) => !d.settled);
  return {
    lent: open.filter((d) => d.direction === "lent").reduce((s, d) => s + d.remaining, 0),
    borrowed: open.filter((d) => d.direction === "borrowed").reduce((s, d) => s + d.remaining, 0),
    lentCount: open.filter((d) => d.direction === "lent").length,
    borrowedCount: open.filter((d) => d.direction === "borrowed").length,
    overdueCount: open.filter((d) => d.dueOn !== null && d.dueOn < todayVN()).length,
  };
}

export async function hasWallets(tx: Tx, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(eq(wallets.userId, userId), isNull(wallets.archivedAt)))
    .limit(1);
  return !!row;
}

export async function transactionCountForWallet(tx: Tx, userId: string, walletId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), or(eq(transactions.walletId, walletId), eq(transactions.toWalletId, walletId))),
    );
  return row.n;
}

