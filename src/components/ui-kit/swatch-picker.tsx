"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { SWATCH_LABELS, SWATCHES, type Swatch } from "@/lib/palette";
import { cn } from "@/lib/utils";

export function SwatchPicker({ value, onChange }: { value: string; onChange: (value: Swatch) => void }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2.5">
      {SWATCHES.map((swatch) => {
        const selected = swatch === value;
        return (
          <button
            key={swatch}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={SWATCH_LABELS[swatch]}
            onClick={() => onChange(swatch)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-[box-shadow,transform] active:scale-90",
              selected && "ring-2 ring-foreground/70",
            )}
            style={{ backgroundColor: `var(--swatch-${swatch})` }}
          >
            {selected && <CheckIcon weight="bold" className="size-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
