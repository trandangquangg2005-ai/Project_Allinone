"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, withTenant } from "@/db";
import { userSettings, users } from "@/db/schema";
import { createAction, UserError } from "@/lib/action";
import { BANKS } from "@/lib/banks";

export const updateProfile = createAction(
  {},
  z.object({ displayName: z.string().trim().min(1, "Nhập tên hiển thị.").max(60, "Tên tối đa 60 ký tự.") }),
  async ({ displayName }, { user }) => {
    await getDb().update(users).set({ displayName }).where(eq(users.id, user.id));
    revalidatePath("/", "layout");
    return null;
  },
);

const bankSchema = z
  .object({
    bankBin: z.string().nullable(),
    bankAccountNumber: z.string().trim().max(30).nullable(),
    bankAccountName: z.string().trim().max(60).nullable(),
  })
  .refine((v) => !v.bankBin || BANKS.some((b) => b.bin === v.bankBin), { message: "Ngân hàng không hợp lệ.", path: ["bankBin"] })
  .refine((v) => !v.bankAccountNumber || /^[0-9]{4,30}$/.test(v.bankAccountNumber), {
    message: "Số tài khoản chỉ gồm chữ số.",
    path: ["bankAccountNumber"],
  });

export const saveBankSettings = createAction({ module: "tutoring" }, bankSchema, async (input, { user }) => {
  if (!!input.bankBin !== !!input.bankAccountNumber) {
    throw new UserError("Chọn ngân hàng và nhập số tài khoản, hoặc để trống cả hai.");
  }
  await withTenant(user.id, async (tx) => {
    const values = {
      bankBin: input.bankBin || null,
      bankAccountNumber: input.bankAccountNumber || null,
      bankAccountName: input.bankAccountName ? input.bankAccountName.toUpperCase() : null,
    };
    await tx
      .insert(userSettings)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: userSettings.userId, set: values });
  });
  revalidatePath("/settings");
  return null;
});

export const setTuitionAutoIncome = createAction(
  { module: "tutoring" },
  z.object({ enabled: z.boolean() }),
  async ({ enabled }, { user }) => {
    await withTenant(user.id, async (tx) => {
      await tx
        .insert(userSettings)
        .values({ userId: user.id, tuitionAutoIncome: enabled })
        .onConflictDoUpdate({ target: userSettings.userId, set: { tuitionAutoIncome: enabled } });
    });
    revalidatePath("/", "layout");
    return null;
  },
);
