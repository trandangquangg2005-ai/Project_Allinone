import { ArrowRightIcon, CameraIcon, HandCoinsIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { AnimatedMoney } from "@/components/ui-kit/animated-number";
import { WALLET_ICONS } from "@/components/ui-kit/category-icons";
import { HexBadge } from "@/components/ui-kit/hex-badge";
import { withTenant } from "@/db";
import { requireUser } from "@/lib/auth/dal";
import { currentMonthVN, formatDate, formatMonthLabel, formatTime, formatWeekday, greeting, todayVN } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { cn } from "@/lib/utils";
import { MonthSummary } from "@/modules/finance/components/month-summary";
import { TransactionRow } from "@/modules/finance/components/transaction-list";
import { AddTransactionButton, AddTransactionFab, TransactionProvider } from "@/modules/finance/components/transaction-provider";
import { debtTotals, listCategories, listWallets, monthSummary, recentTransactions } from "@/modules/finance/queries";
import { LiveTimer } from "@/modules/tutoring/components/live-timer";
import { getActiveLesson, listStudents, monthTeachingSummary } from "@/modules/tutoring/queries";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function DashboardPage() {
  const user = await requireUser();
  const hasFinance = user.modules.includes("finance");
  const hasTutoring = user.modules.includes("tutoring");
  const month = currentMonthVN();
  const today = todayVN();

  const data = await withTenant(user.id, async (tx) => ({
    finance: hasFinance
      ? {
          wallets: await listWallets(tx, user.id, { includeArchived: true }),
          categories: await listCategories(tx, user.id, { includeArchived: true }),
          summary: await monthSummary(tx, user.id, month),
          debts: await debtTotals(tx, user.id),
          recent: await recentTransactions(tx, user.id, 5),
        }
      : null,
    tutoring: hasTutoring
      ? {
          active: await getActiveLesson(tx, user.id),
          summary: await monthTeachingSummary(tx, user.id, month),
          owing: (await listStudents(tx, user.id, month)).filter((s) => s.balance > 0).sort((a, b) => b.balance - a.balance),
        }
      : null,
  }));

  const title = `${greeting()}, ${user.displayName}`;
  const description = `${formatWeekday(today)}, ${formatDate(today)}`;

  if (!data.finance && !data.tutoring) {
    return (
      <Page title={title} description={description}>
        <p className="rounded-2xl border bg-card p-6 text-[15px] text-muted-foreground">
          Tài khoản của bạn chưa được bật chức năng nào. Hãy nhờ quản trị viên cấp quyền Tài chính hoặc Gia sư.
        </p>
      </Page>
    );
  }

  const content = (
    <Page title={title} description={description} actions={data.finance ? <AddTransactionButton className="hidden lg:inline-flex" /> : undefined}>
      {data.tutoring?.active && (
        <Link
          href="/tutoring"
          transitionTypes={["nav"]}
          className="flex items-center gap-4 rounded-2xl border border-primary/25 bg-accent px-5 py-4 transition-colors hover:border-primary/50"
        >
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-3 rounded-full bg-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">Đang dạy {data.tutoring.active.studentName}</span>
            <span className="block text-[13px] text-muted-foreground">Từ {formatTime(data.tutoring.active.checkInAt)}. Nhớ check-out khi xong.</span>
          </span>
          <LiveTimer since={data.tutoring.active.checkInAt} className="text-xl font-bold" />
        </Link>
      )}

      <div className={cn("grid gap-6", data.finance && data.tutoring && "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]")}>
        {data.finance && (
          <div className="grid content-start gap-6">
            <section className="grid gap-5 rounded-3xl border bg-card p-5 sm:p-6">
              <div className="grid gap-1">
                <span className="text-sm text-muted-foreground">Tổng số dư</span>
                <AnimatedMoney
                  value={data.finance.wallets.filter((w) => !w.archived).reduce((s, w) => s + w.balance, 0)}
                  className="text-[38px] leading-none font-bold tracking-tight sm:text-[44px]"
                />
              </div>
              <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
                {data.finance.wallets
                  .filter((w) => !w.archived)
                  .map((wallet) => {
                    const Icon = WALLET_ICONS[wallet.kind];
                    return (
                      <li key={wallet.id} className="flex shrink-0 items-center gap-2 rounded-xl bg-muted/70 py-2 pr-3.5 pl-2">
                        <HexBadge color={wallet.color} size="sm" className="size-7 [&_svg]:size-3.5">
                          <Icon weight="duotone" />
                        </HexBadge>
                        <span className="grid">
                          <span className="text-[12px] text-muted-foreground">{wallet.name}</span>
                          <span data-money className={cn("text-sm font-semibold", wallet.balance < 0 && "text-expense")}>
                            {formatVND(wallet.balance)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <div className="grid gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{formatMonthLabel(month)}</h2>
              <MonthSummary income={data.finance.summary.income} expense={data.finance.summary.expense} />
            </div>

            <Link
              href="/finance/debts"
              transitionTypes={["nav"]}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/30"
            >
              <HexBadge color="amber">
                <HandCoinsIcon weight="duotone" />
              </HexBadge>
              <span className="grid gap-0.5">
                <span className="text-[13px] text-muted-foreground">Cần đòi {data.finance.debts.lentCount > 0 ? `(${data.finance.debts.lentCount} người)` : ""}</span>
                <span data-money className="text-lg font-bold text-debt">{formatVND(data.finance.debts.lent)}</span>
                <span data-money className="text-[13px] text-muted-foreground">Bạn đang nợ {formatVND(data.finance.debts.borrowed)}</span>
              </span>
              <span className="flex items-center gap-2">
                {data.finance.debts.overdueCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-expense-soft px-2.5 py-1 text-xs font-semibold text-expense">
                    <WarningCircleIcon className="size-3.5" /> {data.finance.debts.overdueCount} quá hạn
                  </span>
                )}
                <ArrowRightIcon className="size-4 text-muted-foreground" />
              </span>
            </Link>

            <section className="grid gap-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Giao dịch gần đây</h2>
                <Link href="/finance" transitionTypes={["nav"]} className="text-sm font-medium text-primary">
                  Xem tất cả
                </Link>
              </div>
              {data.finance.recent.length ? (
                <ul className="rounded-2xl border bg-card p-1.5">
                  {data.finance.recent.map((t) => (
                    <li key={t.id}>
                      <TransactionRow t={t} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed px-5 py-6 text-center text-[15px] text-muted-foreground">
                  Chưa có giao dịch nào. Bấm “Thêm giao dịch” để ghi khoản đầu tiên.
                </p>
              )}
            </section>
          </div>
        )}

        {data.tutoring && (
          <div className="grid content-start gap-6">
            <section className="grid gap-4 rounded-3xl border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Dạy gia sư, {formatMonthLabel(month).toLowerCase()}</h2>
                {!data.tutoring.active && (
                  <Button asChild size="sm">
                    <Link href="/tutoring" transitionTypes={["nav"]}>
                      <CameraIcon className="size-4" /> Check-in
                    </Link>
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-0.5">
                  <span className="text-[13px] text-muted-foreground">Buổi đã dạy</span>
                  <span className="tabular text-3xl font-bold">{data.tutoring.summary.lessons}</span>
                </div>
                <div className="grid gap-0.5">
                  <span className="text-[13px] text-muted-foreground">Học phí phát sinh</span>
                  <span data-money className="text-xl font-bold">{formatVND(data.tutoring.summary.fees)}</span>
                </div>
              </div>
            </section>

            <section className="grid gap-2">
              <h2 className="font-semibold">Học phí chưa thu</h2>
              {data.tutoring.owing.length ? (
                <ul className="divide-y rounded-2xl border bg-card">
                  {data.tutoring.owing.slice(0, 5).map((student) => (
                    <li key={student.id}>
                      <Link
                        href={`/tutoring/students/${student.id}`}
                        transitionTypes={["nav-forward"]}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="truncate font-medium">{student.name}</span>
                        <span data-money className="font-semibold text-debt">{formatVND(student.balance)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed px-5 py-6 text-center text-[15px] text-muted-foreground">
                  Phụ huynh nào cũng đã đóng đủ.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
      {data.finance && <AddTransactionFab />}
    </Page>
  );

  return data.finance ? (
    <TransactionProvider wallets={data.finance.wallets} categories={data.finance.categories}>
      {content}
    </TransactionProvider>
  ) : (
    content
  );
}
