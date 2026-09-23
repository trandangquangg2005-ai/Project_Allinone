import { ClockCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";
import { formatDateTime } from "@/lib/datetime";
import type { AuditEntry } from "../queries";

const LABELS: Record<string, string> = {
  startViewAs: "Mở dữ liệu tài khoản",
  stopViewAs: "Thoát khỏi tài khoản",
  saveTransaction: "Lưu giao dịch",
  deleteTransaction: "Xóa giao dịch",
  saveWallet: "Lưu ví",
  archiveWallet: "Ẩn/hiện ví",
  deleteWallet: "Xóa ví",
  saveCategory: "Lưu danh mục",
  archiveCategory: "Ẩn/hiện danh mục",
  saveDebt: "Lưu khoản nợ",
  addDebtPayment: "Ghi trả nợ",
  deleteDebtPayment: "Xóa lần trả nợ",
  deleteDebt: "Xóa khoản nợ",
  setDebtSettled: "Đổi trạng thái nợ",
  saveStudent: "Lưu học sinh",
  archiveStudent: "Ẩn/hiện học sinh",
  checkIn: "Check-in buổi học",
  checkOut: "Check-out buổi học",
  addManualLesson: "Thêm buổi học tay",
  updateLesson: "Sửa buổi học",
  deleteLesson: "Xóa buổi học",
  recordPayment: "Thu học phí",
  deletePayment: "Xóa khoản thu",
  regenerateShareLink: "Đổi link phụ huynh",
  revokeShareLink: "Thu hồi link phụ huynh",
  updateProfile: "Sửa hồ sơ",
  saveBankSettings: "Sửa tài khoản ngân hàng",
  setTuitionAutoIncome: "Đổi tự động ghi thu",
  changePassword: "Đổi mật khẩu",
};

/** Read-only trace of admin activity inside other accounts. */
export function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Chưa có ai mở dữ liệu tài khoản khác.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3">
          <ClockCounterClockwiseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">@{entry.actorName}</span> · {LABELS[entry.action] ?? entry.action} trong{" "}
              <span className="font-medium">@{entry.targetName}</span>
            </p>
            {entry.detail && (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {Object.entries(entry.detail)
                  .map(([key, value]) => `${key}: ${String(value)}`)
                  .join(" · ")}
              </p>
            )}
          </div>
          <time className="shrink-0 text-[12px] text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}
