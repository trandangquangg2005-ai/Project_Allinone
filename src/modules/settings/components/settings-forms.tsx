"use client";

import { DesktopIcon, MoonIcon, SignOutIcon, SpinnerIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { useMounted } from "@/hooks/use-now";
import { BANKS } from "@/lib/banks";
import { cn } from "@/lib/utils";
import { signOutOtherDevices } from "@/modules/auth/actions";
import { saveBankSettings, setTuitionAutoIncome, updateProfile } from "../actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [name, setName] = useState(displayName);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateProfile({ displayName: name });
          if (!result.ok) toast.error(result.error);
          else toast.success("Đã lưu tên hiển thị");
        });
      }}
    >
      <Field label="Tên hiển thị" htmlFor="profile-name">
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <Button type="submit" disabled={pending || name.trim() === displayName}>
        {pending && <SpinnerIcon className="size-4 animate-spin" />}
        Lưu
      </Button>
    </form>
  );
}

export function SignOutOthersButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={pending}>
        <SignOutIcon className="size-4" /> Đăng xuất khỏi các thiết bị khác
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive={false}
        title="Đăng xuất các thiết bị khác?"
        description="Mọi điện thoại, máy tính khác đang đăng nhập tài khoản này sẽ phải đăng nhập lại. Thiết bị này vẫn giữ đăng nhập."
        confirmLabel="Đăng xuất"
        onConfirm={() =>
          startTransition(async () => {
            await signOutOtherDevices();
            toast.success("Đã đăng xuất các thiết bị khác");
          })
        }
      />
    </>
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: "light", label: "Sáng", icon: SunIcon },
    { value: "dark", label: "Tối", icon: MoonIcon },
    { value: "system", label: "Theo máy", icon: DesktopIcon },
  ];
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "grid justify-items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors",
              active ? "border-primary bg-accent" : "bg-card hover:bg-muted",
            )}
          >
            <Icon className="size-5" weight={active ? "fill" : "regular"} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function BankForm({
  bankBin,
  bankAccountNumber,
  bankAccountName,
}: {
  bankBin: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
}) {
  const [bin, setBin] = useState(bankBin ?? "");
  const [number, setNumber] = useState(bankAccountNumber ?? "");
  const [name, setName] = useState(bankAccountName ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid grid-cols-1 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveBankSettings({
            bankBin: bin || null,
            bankAccountNumber: number.replace(/\s/g, "") || null,
            bankAccountName: name || null,
          });
          if (!result.ok) toast.error(result.error);
          else toast.success("Đã lưu tài khoản nhận học phí");
        });
      }}
    >
      <Field label="Ngân hàng">
        <Select value={bin} onValueChange={setBin}>
          <SelectTrigger className="h-11 w-full rounded-xl">
            <SelectValue placeholder="Chọn ngân hàng" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {BANKS.map((bank) => (
              <SelectItem key={bank.bin} value={bank.bin}>
                {bank.short}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Số tài khoản" htmlFor="bank-number">
          <Input id="bank-number" inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={30} />
        </Field>
        <Field label="Tên chủ tài khoản" htmlFor="bank-name">
          <Input id="bank-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="NGUYEN VAN A" maxLength={60} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <SpinnerIcon className="size-4 animate-spin" />}
          Lưu tài khoản
        </Button>
        {(bankBin || bankAccountNumber) && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setBin("");
              setNumber("");
              setName("");
              startTransition(async () => {
                const result = await saveBankSettings({ bankBin: null, bankAccountNumber: null, bankAccountName: null });
                if (!result.ok) toast.error(result.error);
                else toast.success("Đã xóa tài khoản nhận học phí");
              });
            }}
          >
            Xóa
          </Button>
        )}
      </div>
    </form>
  );
}

export function AutoIncomeSwitch({ enabled }: { enabled: boolean }) {
  const [value, setValue] = useState(enabled);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
      <span>
        <span className="block font-medium">Tự ghi học phí vào Tài chính</span>
        <span className="block text-[13px] text-muted-foreground">Mỗi lần thu học phí sẽ tạo một khoản thu trong ví bạn chọn.</span>
      </span>
      <Switch
        checked={value}
        disabled={pending}
        onCheckedChange={(checked) => {
          setValue(checked);
          startTransition(async () => {
            const result = await setTuitionAutoIncome({ enabled: checked });
            if (!result.ok) {
              setValue(!checked);
              toast.error(result.error);
            }
          });
        }}
      />
    </label>
  );
}
