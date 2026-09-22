import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/brand/logo";
import { bankName } from "@/lib/banks";
import { currentMonthVN, formatDate, formatDuration, formatHours, formatMonthLabel, formatTime, formatWeekday, isValidMonth, toVNDate } from "@/lib/datetime";
import { formatVND } from "@/lib/money";
import { buildVietQRPayload, toTransferNote } from "@/lib/vietqr";
import { ParentMonthSwitcher, PrintButton } from "@/modules/tutoring/components/parent-controls";
import { LessonBadges } from "@/modules/tutoring/components/lesson-list";
import { LightboxProvider, PhotoThumb } from "@/modules/tutoring/components/photo-lightbox";
import { loadParentView } from "@/modules/tutoring/share";
import { lessonDuration } from "@/modules/tutoring/types";

export const metadata: Metadata = {
  title: "Sổ theo dõi buổi học",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ParentPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { m } = await searchParams;
  const current = currentMonthVN();
  const month = typeof m === "string" && isValidMonth(m) ? m : current;

  const view = await loadParentView(token, month);
  if (!view) notFound();
  const { student, lessons, payments, bank, tutorName } = view;

  const completed = lessons.filter((l) => l.status === "completed");
  const minutes = completed.reduce((sum, l) => sum + lessonDuration(l) / 60000, 0);
  const photo = (id: string) => `/p/${token}/photos/${id}`;

  const qr =
    bank && student.balance > 0
      ? await QRCode.toString(
          buildVietQRPayload({
            bankBin: bank.bin,
            accountNumber: bank.accountNumber,
            amount: student.balance,
            note: `HP ${student.name} T${Number(month.slice(5))}`,
          }),
          { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#17212b", light: "#ffffff" } },
        )
      : null;

  return (
    <LightboxProvider>
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Logo size={30} />
          <div className="no-print flex items-center gap-2">
            <ParentMonthSwitcher month={month} current={current} />
            <PrintButton />
          </div>
        </header>

        <section className="grid gap-1">
          <p className="text-[15px] text-muted-foreground">Sổ theo dõi buổi học</p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight md:text-[34px]">{student.name}</h1>
          <p className="text-[15px] text-muted-foreground">
            {[student.subject, student.grade].filter(Boolean).join(", ")}
            {student.subject || student.grade ? ". " : ""}Gia sư: {tutorName}. Học phí {formatVND(student.ratePerSession)}/buổi.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
            <Stat label={`Số buổi ${formatMonthLabel(month).toLowerCase()}`} value={String(completed.length)} />
            <Stat label="Tổng thời gian" value={minutes < 60 ? formatDuration(minutes * 60000) : formatHours(minutes * 60000)} />
            <Stat label="Học phí trong tháng" value={formatVND(student.monthFees)} />
          </div>
          <div className="grid gap-1 rounded-2xl border bg-card px-5 py-4">
            <span className="text-[13px] text-muted-foreground">Tổng học phí đến nay</span>
            <div className="flex items-baseline justify-between gap-2 text-[15px]">
              <span>Phát sinh</span>
              <span data-money className="font-semibold">{formatVND(student.totalFees)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[15px]">
              <span>Đã trả</span>
              <span data-money className="font-semibold text-income">{formatVND(student.totalPaid)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 border-t pt-2">
              <span className="font-semibold">{student.balance < 0 ? "Trả trước" : "Còn lại"}</span>
              <span data-money className={student.balance > 0 ? "text-xl font-bold text-debt" : "text-xl font-bold text-income"}>
                {formatVND(Math.abs(student.balance))}
              </span>
            </div>
          </div>
        </section>

        {qr && bank && (
          <section className="grid items-center gap-5 rounded-2xl border bg-card p-5 sm:grid-cols-[180px_1fr]">
            <div className="mx-auto w-44 rounded-xl border bg-white p-2 sm:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="grid gap-2 text-[15px]">
              <h2 className="text-lg font-semibold">Chuyển khoản học phí còn lại</h2>
              <p className="text-muted-foreground">Mở app ngân hàng, quét mã để điền sẵn số tiền và nội dung.</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Ngân hàng</dt>
                <dd className="font-medium">{bankName(bank.bin) ?? bank.bin}</dd>
                <dt className="text-muted-foreground">Số tài khoản</dt>
                <dd className="tabular font-medium">{bank.accountNumber}</dd>
                {bank.accountName && (
                  <>
                    <dt className="text-muted-foreground">Chủ tài khoản</dt>
                    <dd className="font-medium uppercase">{bank.accountName}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Số tiền</dt>
                <dd data-money className="font-semibold">{formatVND(student.balance)}</dd>
                <dt className="text-muted-foreground">Nội dung</dt>
                <dd className="font-medium">{toTransferNote(`HP ${student.name} T${Number(month.slice(5))}`)}</dd>
              </dl>
            </div>
          </section>
        )}

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Các buổi học {formatMonthLabel(month).toLowerCase()}</h2>
          {lessons.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card/50 px-5 py-10 text-center text-muted-foreground">
              Chưa có buổi học nào trong tháng này.
            </p>
          ) : (
            <>
              {/* Desktop: one table row per lesson. */}
              <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
                <table className="w-full text-left text-[15px]">
                  <thead className="bg-muted/60 text-[13px] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Ngày</th>
                      <th className="px-4 py-3 font-medium">Giờ</th>
                      <th className="px-4 py-3 font-medium">Nội dung</th>
                      <th className="px-4 py-3 font-medium">Ảnh</th>
                      <th className="px-4 py-3 text-right font-medium">Học phí</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lessons.map((lesson) => (
                      <tr key={lesson.id} className="align-top">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="block font-medium">{formatDate(toVNDate(lesson.checkInAt))}</span>
                          <span className="text-[13px] text-muted-foreground">{formatWeekday(toVNDate(lesson.checkInAt))}</span>
                        </td>
                        <td className="tabular px-4 py-3 whitespace-nowrap">
                          {formatTime(lesson.checkInAt)}
                          {lesson.checkOutAt ? `–${formatTime(lesson.checkOutAt)}` : ""}
                          {lesson.checkOutAt && (
                            <span className="block text-[13px] text-muted-foreground">{formatDuration(lessonDuration(lesson))}</span>
                          )}
                        </td>
                        <td className="max-w-md px-4 py-3">
                          <LessonBadges lesson={lesson} />
                          {lesson.lessonNote && <p className="mt-1 text-[14px] text-muted-foreground">{lesson.lessonNote}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Photos lesson={lesson} photo={photo} studentName={student.name} />
                        </td>
                        <td data-money className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${lesson.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}>
                          {formatVND(lesson.fee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone: cards. */}
              <ul className="grid gap-3 md:hidden">
                {lessons.map((lesson) => (
                  <li key={lesson.id} className="grid gap-3 rounded-2xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {formatWeekday(toVNDate(lesson.checkInAt))}, {formatDate(toVNDate(lesson.checkInAt))}
                        </p>
                        <p className="tabular text-sm text-muted-foreground">
                          {formatTime(lesson.checkInAt)}
                          {lesson.checkOutAt ? `–${formatTime(lesson.checkOutAt)}, ${formatDuration(lessonDuration(lesson))}` : ""}
                        </p>
                      </div>
                      <span data-money className={`font-semibold ${lesson.status === "cancelled" ? "text-muted-foreground line-through" : ""}`}>
                        {formatVND(lesson.fee)}
                      </span>
                    </div>
                    <LessonBadges lesson={lesson} />
                    {lesson.lessonNote && <p className="text-[14px] text-muted-foreground">{lesson.lessonNote}</p>}
                    <Photos lesson={lesson} photo={photo} studentName={student.name} size="lg" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Lịch sử thanh toán</h2>
          {payments.length === 0 ? (
            <p className="text-muted-foreground">Chưa có khoản thanh toán nào.</p>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[15px]">
                  <span>
                    {formatDate(p.paidOn)}
                    <span className="text-muted-foreground">, {p.method === "cash" ? "tiền mặt" : "chuyển khoản"}</span>
                  </span>
                  <span data-money className="font-semibold text-income">
                    {formatVND(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="border-t pt-4 text-[13px] text-muted-foreground">
          Giờ vào, giờ ra lấy theo đồng hồ máy chủ lúc gia sư chụp ảnh. Buổi có nhãn “nhập tay” hoặc “đã chỉnh sửa” là do gia sư ghi lại sau.
        </footer>
      </div>
    </LightboxProvider>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-3 py-4 sm:px-5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span data-money className="truncate text-[15px] font-semibold sm:text-xl">
        {value}
      </span>
    </div>
  );
}

function Photos({
  lesson,
  photo,
  studentName,
  size = "md",
}: {
  lesson: { checkInAt: Date; checkOutAt: Date | null; checkInPhotoId: string | null; checkOutPhotoId: string | null };
  photo: (id: string) => string;
  studentName: string;
  size?: "md" | "lg";
}) {
  if (!lesson.checkInPhotoId && !lesson.checkOutPhotoId) return <span className="text-[13px] text-muted-foreground">Không có ảnh</span>;
  const cls = size === "lg" ? "aspect-[4/3] w-full" : "size-14";
  return (
    <div className={size === "lg" ? "grid grid-cols-2 gap-2" : "flex gap-2"}>
      {lesson.checkInPhotoId && (
        <PhotoThumb id={lesson.checkInPhotoId} src={photo(lesson.checkInPhotoId)} caption={`Check-in ${formatTime(lesson.checkInAt)}, ${studentName}`} label={`Vào ${formatTime(lesson.checkInAt)}`} className={cls} />
      )}
      {lesson.checkOutPhotoId && lesson.checkOutAt && (
        <PhotoThumb id={lesson.checkOutPhotoId} src={photo(lesson.checkOutPhotoId)} caption={`Check-out ${formatTime(lesson.checkOutAt)}, ${studentName}`} label={`Ra ${formatTime(lesson.checkOutAt)}`} className={cls} />
      )}
    </div>
  );
}
