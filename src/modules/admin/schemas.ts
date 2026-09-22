import { z } from "zod";
import { MODULE_KEYS } from "@/config/modules";
import { usernameSchema } from "@/modules/auth/schemas";

const modules = z.array(z.enum(MODULE_KEYS as [string, ...string[]])).max(MODULE_KEYS.length);
const displayName = z.string().trim().min(1, "Nhập tên hiển thị.").max(60, "Tên tối đa 60 ký tự.");

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName,
  role: z.enum(["admin", "user"]),
  modules,
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.uuid(),
  displayName,
  role: z.enum(["admin", "user"]),
  modules,
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const userIdSchema = z.object({ id: z.uuid() });
export const userStatusSchema = z.object({ id: z.uuid(), status: z.enum(["active", "disabled"]) });
