import type { Metadata } from "next";
import { Page } from "@/components/layout/page";
import { withTenant } from "@/db";
import { requireModule } from "@/lib/auth/dal";
import { currentMonthVN } from "@/lib/datetime";
import { StudentBoard } from "@/modules/tutoring/components/student-board";
import { listStudents } from "@/modules/tutoring/queries";

export const metadata: Metadata = { title: "Học sinh" };

export default async function StudentsPage() {
  const user = await requireModule("tutoring");
  const students = await withTenant(user.id, (tx) => listStudents(tx, user.id, currentMonthVN(), { includeArchived: true }));
  return (
    <Page title="Học sinh" description="Học phí mỗi buổi, số buổi tháng này và số tiền phụ huynh còn thiếu.">
      <StudentBoard students={students} />
    </Page>
  );
}
