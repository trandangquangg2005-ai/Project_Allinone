import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { MonthSwitcher } from "@/components/ui-kit/month-switcher";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { currentMonthVN, formatMonthLabel, isValidMonth, shiftMonth } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { CategoryBreakdown } from "@/modules/finance/components/category-breakdown";
import { MonthSummary } from "@/modules/finance/components/month-summary";
import { TrendChart } from "@/modules/finance/components/trend-chart";
import { monthlyTotals, monthSummary, totalsByCategory } from "@/modules/finance/queries";

export const metadata: Metadata = { title: "Báo cáo" };

function change(current: number, previous: number): string | null {
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "bằng tháng trước";
  return pct > 0 ? `tăng ${pct}% so với tháng trước` : `giảm ${-pct}% so với tháng trước`;
}

export default async function ReportsPage({ searchParams }: PageProps<"/finance/reports">) {
  const user = await requireModule("finance");
  const { m } = await searchParams;
  const current = currentMonthVN();
  const month = typeof m === "string" && isValidMonth(m) ? m : current;
  const previousMonth = shiftMonth(month, -1);

  const data = await withTenant(user.id, async (tx) => ({
    trend: await monthlyTotals(tx, user.id, month, 6),
    summary: await monthSummary(tx, user.id, month),
    previous: await monthSummary(tx, user.id, previousMonth),
    expense: await totalsByCategory(tx, user.id, month, "expense"),
    income: await totalsByCategory(tx, user.id, month, "income"),
  }));

  const spendChange = change(data.summary.expense, data.previous.expense);
  const top = data.expense[0];
  const topShare = top && data.summary.expense ? Math.round((top.total / data.summary.expense) * 100) : 0;

  return (
    <Page title="Báo cáo" description={formatMonthLabel(month)} actions={<MonthSwitcher month={month} current={current} />}>
      <MonthSummary income={data.summary.income} expense={data.summary.expense} />

      {(spendChange || top) && (
        <div className="grid gap-1 rounded-2xl bg-accent px-5 py-4 text-[15px]">
          {spendChange && (
            <p>
              Chi tiêu {formatMonthLabel(month).toLowerCase()} là <strong data-money>{formatVND(data.summary.expense)}</strong>, {spendChange}.
            </p>
          )}
          {top && (
            <p className="text-muted-foreground">
              Nhiều nhất là {top.name} ({topShare}% tổng chi).
            </p>
          )}
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-6">
        <h2 className="font-semibold">Thu và chi 6 tháng gần nhất</h2>
        <TrendChart data={data.trend} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid content-start gap-4 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Chi theo danh mục</h2>
          <CategoryBreakdown rows={data.expense} emptyText="Chưa có khoản chi nào trong tháng này." />
        </section>
        <section className="grid content-start gap-4 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">Thu theo nguồn</h2>
          <CategoryBreakdown rows={data.income} emptyText="Chưa có khoản thu nào trong tháng này." />
        </section>
      </div>
      <p className="text-[13px] text-muted-foreground">
        Báo cáo không tính chuyển tiền giữa các ví và tiền cho vay, đi vay, trả nợ.
      </p>
    </Page>
  );
}
