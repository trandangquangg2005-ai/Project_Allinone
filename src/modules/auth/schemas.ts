import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Tên đăng nhập gồm 3–32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.");

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mật khẩu cần ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`)
  .max(128, "Mật khẩu quá dài.");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại."),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Hai lần nhập mật khẩu mới chưa khớp.",
    path: ["confirmPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
    path: ["newPassword"],
  });
