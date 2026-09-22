"use client";

import { ArchiveIcon, ArrowCounterClockwiseIcon, PlusIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_ICON_KEYS, CATEGORY_ICONS, CategoryGlyph } from "@/components/ui-kit/category-icons";
import { HexBadge } from "@/components/ui-kit/hex-badge";
import { ResponsiveDialog } from "@/components/ui-kit/responsive-dialog";
import { SegmentedControl } from "@/components/ui-kit/segmented-control";
import { SwatchPicker } from "@/components/ui-kit/swatch-picker";
import { swatchStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { archiveCategory, saveCategory } from "../actions";
import type { CategoryKind, CategoryView } from "../types";

export function CategoryBoard({ categories }: { categories: CategoryView[] }) {
  const [sheet, setSheet] = useState<{ open: boolean; category: CategoryView | null; kind: CategoryKind; key: number }>({
    open: false,
    category: null,
    kind: "expense",
    key: 0,
  });
  const openSheet = (category: CategoryView | null, kind: CategoryKind) =>
    setSheet((s) => ({ open: true, category, kind, key: s.key + 1 }));

  const archived = categories.filter((c) => c.archived);

  return (
    <div className="grid gap-6">
      {(["expense", "income"] as const).map((kind) => (
        <section key={kind} className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{kind === "expense" ? "Khoản chi" : "Khoản thu"}</h2>
            <Button variant="outline" size="sm" onClick={() => openSheet(null, kind)}>
              <PlusIcon weight="bold" className="size-3.5" /> Thêm
            </Button>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {categories
              .filter((c) => c.kind === kind && !c.archived)
              .map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => openSheet(category, kind)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <HexBadge color={category.color} size="sm">
                      <CategoryGlyph icon={category.icon} />
                    </HexBadge>
                    <span className="min-w-0 truncate text-sm font-medium">{category.name}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <details className="rounded-2xl border bg-card/60 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground">
            Danh mục đã ẩn ({archived.length})
          </summary>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {archived.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => openSheet(category, category.kind)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left opacity-70 hover:bg-muted"
                >
                  <HexBadge color={category.color} size="sm">
                    <CategoryGlyph icon={category.icon} />
                  </HexBadge>
                  <span className="truncate text-sm">{category.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <CategorySheet
        key={`sheet-${sheet.key}`}
        open={sheet.open}
        onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))}
        category={sheet.category}
        defaultKind={sheet.kind}
      />
    </div>
  );
}

function CategorySheet({
  open,
  onOpenChange,
  category,
  defaultKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryView | null;
  defaultKind: CategoryKind;
}) {
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? defaultKind);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? "blue");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string; fieldErrors?: Record<string, string> }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(success);
      onOpenChange(false);
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Sửa danh mục" : "Thêm danh mục"}
      footer={
        <div className="flex w-full items-center gap-2 sm:justify-end">
          {category && !category.systemKey && (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => archiveCategory({ id: category.id, archived: !category.archived }),
                  category.archived ? "Đã hiện lại danh mục" : "Đã ẩn danh mục",
                )
              }
            >
              {category.archived ? <ArrowCounterClockwiseIcon className="size-4" /> : <ArchiveIcon className="size-4" />}
              {category.archived ? "Hiện lại" : "Ẩn"}
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 sm:flex-none sm:px-8"
            disabled={pending}
            onClick={() =>
              run(
                () => saveCategory({ id: category?.id, kind, name, icon, color: color as "blue" }),
                category ? "Đã lưu danh mục" : "Đã thêm danh mục",
              )
            }
          >
            {pending && <SpinnerIcon className="size-5 animate-spin" />}
            {category ? "Lưu" : "Thêm danh mục"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5">
        <div className="flex items-center gap-3">
          <HexBadge color={color} size="lg">
            <CategoryGlyph icon={icon} />
          </HexBadge>
          <Field label="Tên danh mục" htmlFor="cat-name" error={errors.name} className="flex-1">
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus={!category} />
          </Field>
        </div>
        {!category?.systemKey && (
          <Field label="Loại">
            <SegmentedControl
              value={kind}
              onChange={setKind}
              options={[
                { value: "expense", label: "Khoản chi" },
                { value: "income", label: "Khoản thu" },
              ]}
            />
          </Field>
        )}
        <Field label="Màu">
          <SwatchPicker value={color} onChange={setColor} />
        </Field>
        <Field label="Biểu tượng">
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {CATEGORY_ICON_KEYS.map((key) => {
              const Glyph = CATEGORY_ICONS[key];
              const selected = key === icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-pressed={selected}
                  aria-label={key}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-xl transition-[background-color,transform] active:scale-90",
                    selected ? "" : "text-muted-foreground hover:bg-muted",
                  )}
                  style={selected ? swatchStyle(color) : undefined}
                >
                  <Glyph weight="duotone" className="size-5" />
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </ResponsiveDialog>
  );
}
