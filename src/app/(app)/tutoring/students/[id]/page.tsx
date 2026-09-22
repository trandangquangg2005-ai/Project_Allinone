import { CalendarBlankIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/layout/page";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { MonthSwitcher } from "@/components/ui-kit/month-switcher";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { currentMonthVN, formatMonthLabel, isValidMonth } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { listWallets } from "@/modules/finance/queries";
import { LessonList } from "@/modules/tutoring/components/lesson-list";
import { ShareLinkCard } from "@/modules/tutoring/components/share-link-card";
import { BalanceLabel } from "@/modules/tutoring/components/student-board";
import { PaymentList, StudentActions } from "@/modules/tutoring/components/student-actions";
import { getBankSettings, getShareLink, getStudent, listLessons, listPayments } from "@/modules/tutoring/queries";

export const metadata: Metadata = { title: "Học sinh" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudentPage({ params, searchParams }: PageProps<"/tutoring/students/[id]">) {
  const user = await requireModule("tutoring");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { m } = await searchParams;
  const current = currentMonthVN();
  const month = typeof m === "string" && isValidMonth(m) ? m : current;
  const hasFinance = user.modules.includes("finance");

  const data = await withTenant(user.id, async (tx) => {
    const student = await getStudent(tx, user.id, id, month);
    if (!student) return null;
    return {
      student,
      lessons: await listLessons(tx, user.id, { month, studentId: id }),
      payments: await listPayments(tx, user.id, { studentId: id }),
      link: await getShareLink(tx, user.id, id),
      wallets: hasFinance ? await listWallets(tx, user.id) : [],
      settings: await getBankSettings(tx, user.id),
    };
  });
  if (!data) notFound();
  const { student } = data;

  return (
    <Page
      title={student.name}
      description={[student.subject, student.grade, student.parentName && `Phụ huynh: ${student.parentName}`].filter(Boolean).join(", ") || undefined}
      back={{ href: "/tutoring/students", label: "Học sinh" }}
    >
      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="Học phí/buổi" value={formatVND(student.ratePerSession)} />
          <Figure label={`Số buổi ${formatMonthLabel(month).toLowerCase()}`} value={String(student.monthLessons)} />
          <Figure label="Học phí trong tháng" value={formatVND(student.monthFees)} />
          <div className="grid gap-1">
            <span className="text-[13px] text-muted-foreground">Tổng còn lại</span>
            <span data-money className="text-lg font-bold">
              <BalanceLabel balance={student.balance} />
            </span>
          </div>
        </div>
        <StudentActions student={student} wallets={data.wallets} bookToFinance={hasFinance && data.settings.tuitionAutoIncome} />
      </section>

      <ShareLinkCard
        studentId={student.id}
        studentName={student.name}
        token={data.link?.token ?? null}
        lastViewedAt={data.link?.lastViewedAt ?? null}
        archived={student.archived}
      />

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Buổi học</h2>
          <MonthSwitcher month={month} current={current} />
        </div>
        {data.lessons.length ? (
          <LessonList lessons={data.lessons} showStudent={false} />
        ) : (
          <EmptyState icon={<CalendarBlankIcon weight="duotone" />} title={`Chưa có buổi học nào trong ${formatMonthLabel(month).toLowerCase()}`} />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">Học phí đã nhận</h2>
        <PaymentList payments={data.payments} />
      </section>
    </Page>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span data-money className="text-lg font-bold">
        {value}
      </span>
    </div>
  );
}
