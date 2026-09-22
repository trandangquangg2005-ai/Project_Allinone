import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { currentMonthVN, formatMonthLabel, serverTimestamp } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { CheckInPanel } from "@/modules/tutoring/components/check-in-panel";
import { LessonList } from "@/modules/tutoring/components/lesson-list";
import { getActiveLesson, listStudents, listTodayLessons, monthTeachingSummary } from "@/modules/tutoring/queries";

export const metadata: Metadata = { title: "Chấm công" };

export default async function TutoringHomePage() {
  const user = await requireModule("tutoring");
  const month = currentMonthVN();
  const data = await withTenant(user.id, async (tx) => ({
    active: await getActiveLesson(tx, user.id),
    students: await listStudents(tx, user.id, month),
    today: await listTodayLessons(tx, user.id),
    summary: await monthTeachingSummary(tx, user.id, month),
  }));
  const hours = Math.round((data.summary.minutes / 60) * 10) / 10;

  return (
    <Page title="Chấm công" description="Chụp ảnh lúc bắt đầu và kết thúc mỗi buổi dạy.">
      <CheckInPanel activeLesson={data.active} students={data.students} serverNow={serverTimestamp()} />

      <section className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
        {[
          { label: "Buổi đã dạy", value: String(data.summary.lessons) },
          { label: "Số giờ", value: hours.toLocaleString("vi-VN") },
          { label: "Học phí", value: formatVND(data.summary.fees) },
        ].map((item) => (
          <div key={item.label} className="grid gap-1 px-3 py-4 sm:px-5">
            <span className="text-[13px] text-muted-foreground">{item.label}</span>
            <span data-money className="truncate text-[15px] font-semibold sm:text-xl">
              {item.value}
            </span>
          </div>
        ))}
      </section>
      <p className="-mt-3 text-[13px] text-muted-foreground">Số liệu {formatMonthLabel(month).toLowerCase()}.</p>

      {data.today.length > 0 && (
        <LessonList lessons={data.today} />
      )}
    </Page>
  );
}
