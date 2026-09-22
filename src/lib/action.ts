import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type z } from "zod";
import type { ModuleKey } from "@/config/modules";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/dal";
import { friendlyDbError } from "@/lib/db-errors";

import type { ActionResult } from "./action-result";

export type { ActionResult };

/** Throw inside an action to show `message` to the user as-is. */
export class UserError extends Error {}

type Guard = { module?: ModuleKey; admin?: boolean; allowPasswordChange?: boolean };

async function authorize(guard: Guard): Promise<CurrentUser | string> {
  const user = await getCurrentUser();
  if (!user) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (user.mustChangePassword && !guard.allowPasswordChange) return "Hãy đổi mật khẩu trước khi tiếp tục.";
  if (guard.module && !user.modules.includes(guard.module)) return "Tài khoản của bạn không được dùng chức năng này.";
  if (guard.admin && user.role !== "admin") return "Chỉ quản trị viên mới làm được việc này.";
  return user;
}

function toFailure(error: unknown): { ok: false; error: string } {
  unstable_rethrow(error); // let redirect()/notFound() through
  if (error instanceof UserError) return { ok: false, error: error.message };
  if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  const friendly = friendlyDbError(error);
  if (friendly) return { ok: false, error: friendly };
  console.error("[action]", error);
  return { ok: false, error: "Có lỗi xảy ra. Hãy thử lại." };
}

/**
 * Every Server Action goes through here: session + module/admin check,
 * zod validation, then the handler. Server Actions are public endpoints, so
 * the page's own permission check does not protect them.
 */
export function createAction<S extends z.ZodType, R>(
  guard: Guard,
  schema: S,
  handler: (input: z.output<S>, ctx: { user: CurrentUser }) => Promise<R>,
) {
  return async (input: z.input<S>): Promise<ActionResult<R>> => {
    const user = await authorize(guard);
    if (typeof user === "string") return { ok: false, error: user };

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", fieldErrors };
    }

    try {
      return { ok: true, data: await handler(parsed.data, { user }) };
    } catch (error) {
      return toFailure(error);
    }
  };
}

/** Same guard for actions that receive FormData (file uploads). */
export function createFormAction<R>(
  guard: Guard,
  handler: (form: FormData, ctx: { user: CurrentUser }) => Promise<R>,
) {
  return async (form: FormData): Promise<ActionResult<R>> => {
    const user = await authorize(guard);
    if (typeof user === "string") return { ok: false, error: user };
    try {
      return { ok: true, data: await handler(form, { user }) };
    } catch (error) {
      return toFailure(error);
    }
  };
}
