"use client";

import { CopyIcon, KeyIcon, LockIcon, LockOpenIcon, PencilSimpleIcon, PlusIcon, SpinnerIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui-kit/confirm-dialog";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { initials } from "@/components/layout/user-menu";
import { MODULES, type ModuleKey } from "@/config/modules";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { createUser, resetPassword, setUserStatus, updateUser } from "../actions";
import type { AccountView } from "../queries";

export function AccountBoard({ accounts, currentUserId }: { accounts: AccountView[]; currentUserId: string }) {
  const [editor, setEditor] = useState<{ open: boolean; account: AccountView | null; key: number }>({ open: false, account: null, key: 0 });
  const [credentials, setCredentials] = useState<{ username: string; tempPassword: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "reset" | "lock" | "unlock"; account: AccountView } | null>(null);
  const [pending, startTransition] = useTransition();

  const openEditor = (account: AccountView | null) => setEditor((e) => ({ open: true, account, key: e.key + 1 }));

  function runConfirm() {
    if (!confirm) return;
    const { kind, account } = confirm;
    startTransition(async () => {
      if (kind === "reset") {
        const result = await resetPassword({ id: account.id });
        if (!result.ok) return void toast.error(result.error);
        setCredentials(result.data);
      } else {
        const result = await setUserStatus({ id: account.id, status: kind === "lock" ? "disabled" : "active" });
        if (!result.ok) return void toast.error(result.error);
        toast.success(kind === "lock" ? `Đã khóa @${account.username}` : `Đã mở khóa @${account.username}`);
      }
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <Button onClick={() => openEditor(null)}>
          <PlusIcon weight="bold" className="size-4" /> Tạo tài khoản
        </Button>
      </div>

      <ul className="grid gap-3">
        {accounts.map((account, i) => {
          const self = account.id === currentUserId;
          const locked = account.status === "disabled";
          return (
            <motion.li
              key={account.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn("grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center", locked && "opacity-70")}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("hex flex size-11 shrink-0 items-center justify-center text-sm font-semibold", account.role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {initials(account.displayName)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{account.displayName}</span>
                    <span className="text-sm text-muted-foreground">@{account.username}</span>
                    {account.role === "admin" && <Tag tone="primary">Quản trị</Tag>}
                    {self && <Tag>Bạn</Tag>}
                    {locked && <Tag tone="danger">Đã khóa</Tag>}
                    {account.mustChangePassword && !locked && <Tag tone="warn">Chờ đổi mật khẩu</Tag>}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {account.modules.length ? (
                      account.modules.map((m) => <Tag key={m}>{MODULES.find((x) => x.key === m)?.label}</Tag>)
                    ) : (
                      <span className="text-[13px] text-muted-foreground">Chưa bật chức năng nào</span>
                    )}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {account.lastLoginAt ? `Đăng nhập gần nhất ${formatDateTime(account.lastLoginAt)}` : "Chưa đăng nhập lần nào"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditor(account)}>
                  <PencilSimpleIcon className="size-3.5" /> Sửa
                </Button>
                {!self && (
                  <>
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm({ kind: "reset", account })}>
                      <KeyIcon className="size-3.5" /> Đặt lại mật khẩu
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirm({ kind: locked ? "unlock" : "lock", account })}
                      className={locked ? undefined : "text-destructive hover:bg-destructive/10 hover:text-destructive"}
                    >
                      {locked ? <LockOpenIcon className="size-3.5" /> : <LockIcon className="size-3.5" />}
                      {locked ? "Mở khóa" : "Khóa"}
                    </Button>
                  </>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>

      <AccountEditor
        key={`editor-${editor.key}`}
        open={editor.open}
        onOpenChange={(o) => setEditor((e) => ({ ...e, open: o }))}
        account={editor.account}
        isSelf={editor.account?.id === currentUserId}
        onCreated={setCredentials}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind !== "unlock"}
        title={
          confirm?.kind === "reset"
            ? `Đặt lại mật khẩu cho @${confirm.account.username}?`
            : confirm?.kind === "lock"
              ? `Khóa @${confirm?.account.username}?`
              : `Mở khóa @${confirm?.account.username}?`
        }
        description={
          confirm?.kind === "reset"
            ? "Người này bị đăng xuất khỏi mọi thiết bị và phải đặt mật khẩu mới ở lần đăng nhập tới."
            : confirm?.kind === "lock"
              ? "Người này bị đăng xuất ngay và không đăng nhập được nữa. Link phụ huynh của họ cũng ngừng hoạt động. Dữ liệu vẫn được giữ."
              : "Người này đăng nhập lại được bằng mật khẩu hiện tại."
        }
        confirmLabel={confirm?.kind === "reset" ? "Đặt lại" : confirm?.kind === "lock" ? "Khóa" : "Mở khóa"}
        onConfirm={runConfirm}
      />

      <ResponsiveDialog
        open={credentials !== null}
        onOpenChange={(o) => !o && setCredentials(null)}
        title="Thông tin đăng nhập"
        description="Mật khẩu tạm chỉ hiện một lần. Gửi cho người dùng; họ sẽ phải đổi ở lần đăng nhập đầu."
        footer={
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={async () => {
              if (!credentials) return;
              await navigator.clipboard.writeText(`Tên đăng nhập: ${credentials.username}\nMật khẩu tạm: ${credentials.tempPassword}`);
              toast.success("Đã chép thông tin đăng nhập");
            }}
          >
            <CopyIcon className="size-4" /> Sao chép
          </Button>
        }
      >
        {credentials && (
          <dl className="grid gap-3 rounded-2xl bg-muted/60 p-4">
            <div>
              <dt className="text-[13px] text-muted-foreground">Tên đăng nhập</dt>
              <dd className="font-mono text-lg font-semibold">{credentials.username}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">Mật khẩu tạm</dt>
              <dd className="font-mono text-lg font-semibold tracking-wide select-all">{credentials.tempPassword}</dd>
            </div>
          </dl>
        )}
      </ResponsiveDialog>
    </div>
  );
}

function Tag({ tone = "neutral", children }: { tone?: "neutral" | "primary" | "danger" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "primary" && "bg-accent text-primary",
        tone === "danger" && "bg-expense-soft text-expense",
        tone === "warn" && "bg-debt-soft text-debt",
      )}
    >
      {children}
    </span>
  );
}

function AccountEditor({
  open,
  onOpenChange,
  account,
  isSelf,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountView | null;
  isSelf: boolean;
  onCreated: (credentials: { username: string; tempPassword: string }) => void;
}) {
  const [username, setUsername] = useState(account?.username ?? "");
  const [displayName, setDisplayName] = useState(account?.displayName ?? "");
  const [role, setRole] = useState<"admin" | "user">(account?.role ?? "user");
  const [modules, setModules] = useState<ModuleKey[]>(account?.modules ?? ["finance"]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function toggle(key: ModuleKey, checked: boolean) {
    setModules((current) => (checked ? [...new Set([...current, key])] : current.filter((m) => m !== key)));
  }

  function submit() {
    startTransition(async () => {
      if (account) {
        const result = await updateUser({ id: account.id, displayName, role, modules });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          return void toast.error(result.error);
        }
        toast.success("Đã lưu tài khoản");
        onOpenChange(false);
      } else {
        const result = await createUser({ username, displayName, role, modules });
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          return void toast.error(result.error);
        }
        onOpenChange(false);
        onCreated(result.data);
      }
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? `Sửa @${account.username}` : "Tạo tài khoản"}
      description={account ? "Thay đổi quyền có hiệu lực ngay ở lần tải trang kế tiếp của người đó." : "Mỗi tài khoản có kho dữ liệu riêng, không ai xem được dữ liệu của người khác."}
      footer={
        <Button size="lg" className="w-full sm:w-auto sm:px-8" onClick={submit} disabled={pending}>
          {pending && <SpinnerIcon className="size-5 animate-spin" />}
          {account ? "Lưu" : "Tạo tài khoản"}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        {!account && (
          <Field label="Tên đăng nhập" htmlFor="acc-username" error={errors.username} hint="Chữ thường không dấu, số, dấu chấm hoặc gạch dưới. Ví dụ: lan.nguyen">
            <Input id="acc-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={32} autoFocus />
          </Field>
        )}
        <Field label="Tên hiển thị" htmlFor="acc-name" error={errors.displayName}>
          <Input id="acc-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Chức năng được dùng">
          <div className="grid gap-2">
            {MODULES.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-accent">
                <Checkbox checked={modules.includes(m.key)} onCheckedChange={(v) => toggle(m.key, v === true)} className="mt-0.5" />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-[13px] text-muted-foreground">{m.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        {!isSelf && (
          <Field label="Vai trò" hint="Quản trị viên tạo và khóa được tài khoản khác, nhưng không xem được dữ liệu của họ.">
            <SegmentedControl
              value={role}
              onChange={setRole}
              options={[
                { value: "user", label: "Người dùng" },
                { value: "admin", label: "Quản trị viên" },
              ]}
            />
          </Field>
        )}
      </div>
    </ResponsiveDialog>
  );
}
