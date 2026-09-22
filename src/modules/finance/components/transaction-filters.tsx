"use client";

import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WalletView } from "../types";

const KINDS = [
  { value: "", label: "Tất cả" },
  { value: "expense", label: "Chi" },
  { value: "income", label: "Thu" },
  { value: "transfer", label: "Chuyển ví" },
];

/** Filters live in the URL so a filtered view can be refreshed or shared. */
export function TransactionFilters({ wallets }: { wallets: WalletView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update("q", value.trim()), 300);
  }

  const walletId = params.get("w") ?? "";
  const kind = params.get("k") ?? "";

  return (
    <div className={cn("grid gap-3 transition-opacity", pending && "opacity-70")}>
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Tìm theo ghi chú hoặc danh mục"
          className="pl-10"
          aria-label="Tìm giao dịch"
        />
        {q && (
          <button
            type="button"
            onClick={() => onSearch("")}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Xóa tìm kiếm"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {KINDS.map((option) => (
          <Chip key={option.value} active={kind === option.value} onClick={() => update("k", option.value)}>
            {option.label}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden />
        <Chip active={!walletId} onClick={() => update("w", "")}>
          Mọi ví
        </Chip>
        {wallets.map((wallet) => (
          <Chip key={wallet.id} active={walletId === wallet.id} onClick={() => update("w", wallet.id)}>
            {wallet.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
