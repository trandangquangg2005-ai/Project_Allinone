type PgError = { code: string; constraint?: string };

function findPgError(error: unknown): PgError | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      };
    }
    current = candidate.cause;
  }
  return null;
}

const UNIQUE: Record<string, string> = {
  users_username_unique: "Tên đăng nhập này đã có người dùng.",
  wallets_user_name_key: "Bạn đã có một ví trùng tên.",
  categories_user_kind_name_key: "Bạn đã có một danh mục trùng tên.",
  lessons_one_active_per_user: "Bạn đang có một buổi dạy chưa check-out. Hãy check-out buổi đó trước.",
  lessons_client_request_key: "Buổi này đã được ghi nhận.",
  lesson_photos_lesson_kind_key: "Buổi này đã có ảnh cho bước này.",
};

const CHECK: Record<string, string> = {
  users_username_format: "Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang (3–32 ký tự).",
  transactions_amount_positive: "Số tiền phải lớn hơn 0.",
  transactions_shape: "Giao dịch chưa đủ thông tin (ví, danh mục hoặc ví nhận).",
  lessons_checkout_after_checkin: "Giờ ra phải sau giờ vào.",
};

/** Maps Postgres errors to a sentence a person can act on, or null. */
export function friendlyDbError(error: unknown): string | null {
  const pg = findPgError(error);
  if (!pg) return null;
  switch (pg.code) {
    case "23505":
      return (pg.constraint && UNIQUE[pg.constraint]) ?? "Dữ liệu này đã tồn tại.";
    case "23503":
      return "Không làm được vì dữ liệu này đang được dùng ở chỗ khác. Hãy ẩn/lưu trữ thay vì xóa.";
    case "23514":
      return (pg.constraint && CHECK[pg.constraint]) ?? "Dữ liệu không hợp lệ.";
    case "42501":
      return "Bạn không có quyền với dữ liệu này.";
    case "22P02":
      return "Không tìm thấy dữ liệu.";
    default:
      return null;
  }
}
