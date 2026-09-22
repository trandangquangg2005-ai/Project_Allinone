import { CalendarBlankIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/layout/page";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { MonthSwitcher } from "@/components/ui-kit/month-switcher";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { currentMonthVN, formatMonthLabel, isValidMonth } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { cn } from "@/lib/utils";
import { LessonList } from "@/modules/tutoring/components/lesson-list";
import { listLessons, listStudents, monthTeachingSummary } from "@/modules/tutoring/queries";

export const metadata: Metadata = { title: "Buổi học" };

export default async function LessonsPage({ searchParams }: PageProps<"/tutoring/lessons">) {
  const user = await requireModule("tutoring");
  const { m, s } = await searchParams;
  const current = currentMonthVN();
  const month = typeof m === "string" && isValidMonth(m) ? m : current;

  const data = await withTenant(user.id, async (tx) => {
    const students = await listStudents(tx, user.id, month, { includeArchived: true });
    const studentId = typeof s === "string" && students.some((st) => st.id === s) ? s : undefined;
    return {
      students,
      studentId,
      lessons: await listLessons(tx, user.id, { month, studentId }),
      summary: await monthTeachingSummary(tx, user.id, month),
    };
  });

  const href = (studentId?: string) => {
    const params = new URLSearchParams();
    if (month !== current) params.set("m", month);
    if (studentId) params.set("s", studentId);
    const query = params.toString();
    return query ? `/tutoring/lessons?${query}` : "/tutoring/lessons";
  };

  return (
    <Page
      title="Buổi học"
      description={`${formatMonthLabel(month)}: ${data.summary.lessons} buổi, ${formatVND(data.summary.fees)}`}
      actions={<MonthSwitcher month={month} current={current} />}
    >
      {data.students.length > 1 && (
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: undefined, name: "Tất cả" }, ...data.students].map((st) => {
            const active = st.id === data.studentId;
            return (
              <Link
                key={st.id ?? "all"}
                href={href(st.id)}
                scroll={false}
                className={cn(
                  "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {st.name}
              </Link>
            );
          })}
        </div>
      )}
      {data.lessons.length ? (
        <LessonList lessons={data.lessons} />
      ) : (
        <EmptyState icon={<CalendarBlankIcon weight="duotone" />} title={`Chưa có buổi học nào trong ${formatMonthLabel(month).toLowerCase()}`} />
      )}
    </Page>
  );
}
