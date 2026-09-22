import { z } from "zod";
import { isValidDate } from "@/lib/datetime";
import { MAX_AMOUNT } from "@/lib/money";
import { SWATCHES } from "@/lib/palette";

export const idSchema = z.uuid("Không tìm thấy dữ liệu.");
const amount = z
  .number({ error: "Nhập số tiền." })
  .int("Số tiền phải là số nguyên.")
  .positive("Số tiền phải lớn hơn 0.")
  .max(MAX_AMOUNT, "Số tiền quá lớn.");
const signedAmount = z
  .number({ error: "Nhập số tiền." })
  .int()
  .min(-MAX_AMOUNT, "Số tiền quá lớn.")
  .max(MAX_AMOUNT, "Số tiền quá lớn.");
const date = z.string().refine(isValidDate, "Ngày không hợp lệ.");
const note = z.string().trim().max(500, "Ghi chú tối đa 500 ký tự.").default("");
const name = (label: string) =>
  z.string().trim().min(1, `Nhập ${label}.`).max(60, `${label[0].toUpperCase()}${label.slice(1)} tối đa 60 ký tự.`);

export const transactionSchema = z
  .object({
    id: idSchema.optional(),
    kind: z.enum(["income", "expense", "transfer"]),
    amount,
    walletId: idSchema,
    toWalletId: idSchema.nullish(),
    categoryId: idSchema.nullish(),
    occurredOn: date,
    note,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "transfer") {
      if (!v.toWalletId) ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Chọn ví nhận tiền." });
      else if (v.toWalletId === v.walletId)
        ctx.addIssue({ code: "custom", path: ["toWalletId"], message: "Ví nhận phải khác ví chuyển." });
    } else if (!v.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Chọn danh mục." });
    }
  });
export type TransactionInput = z.input<typeof transactionSchema>;

export const walletSchema = z.object({
  id: idSchema.optional(),
  name: name("tên ví"),
  kind: z.enum(["cash", "bank", "ewallet", "other"]),
  openingBalance: signedAmount,
  color: z.enum(SWATCHES),
});
export type WalletInput = z.input<typeof walletSchema>;

export const categorySchema = z.object({
  id: idSchema.optional(),
  kind: z.enum(["income", "expense"]),
  name: name("tên danh mục"),
  icon: z.string().min(1).max(32),
  color: z.enum(SWATCHES),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const archiveSchema = z.object({ id: idSchema, archived: z.boolean() });
export const deleteSchema = z.object({ id: idSchema });

export const debtSchema = z
  .object({
    id: idSchema.optional(),
    direction: z.enum(["lent", "borrowed"]),
    counterparty: name("tên người"),
    phone: z.string().trim().max(20, "Số điện thoại quá dài.").default(""),
    principal: amount,
    occurredOn: date,
    dueOn: date.nullish(),
    note,
    // Only on create: also move money in/out of this wallet.
    walletId: idSchema.nullish(),
  })
  .refine((v) => !v.dueOn || v.dueOn >= v.occurredOn, {
    message: "Hạn trả phải sau ngày phát sinh.",
    path: ["dueOn"],
  });
export type DebtInput = z.input<typeof debtSchema>;

export const debtPaymentSchema = z.object({
  debtId: idSchema,
  amount,
  paidOn: date,
  walletId: idSchema.nullish(),
  note,
});
export type DebtPaymentInput = z.input<typeof debtPaymentSchema>;

export const settleSchema = z.object({ id: idSchema, settled: z.boolean() });
