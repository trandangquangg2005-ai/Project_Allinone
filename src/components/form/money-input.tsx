"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { amountSuggestions, formatCompactVND, formatDigitsInput, formatNumber, parseVND } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Money field: digits get thousand separators as you type ("150.000"),
 * shorthand like "150k" or "2tr5" is understood on blur, and short numbers
 * offer one-tap suggestions (15 → 15.000 / 150.000 / 1.500.000).
 */
export function MoneyInput({
  value,
  onChange,
  id,
  autoFocus,
  size = "md",
  placeholder = "0",
  invalid,
  allowNegative = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
  invalid?: boolean;
  allowNegative?: boolean;
}) {
  const fallbackId = useId();
  const [negative, setNegative] = useState(value !== null && value < 0);
  const [text, setText] = useState(value === null ? "" : formatNumber(Math.abs(value)));
  const suggestions = amountSuggestions(text);

  function commit(next: number | null, sign = negative) {
    onChange(next === null ? null : sign ? -next : next);
  }

  function handleChange(raw: string) {
    if (/^[\d.,\s]*$/.test(raw)) {
      const formatted = formatDigitsInput(raw);
      setText(formatted);
      commit(formatted ? Number(formatted.replace(/\D/g, "")) : null);
    } else {
      // Letters (k, tr, triệu…): keep what was typed, resolve on blur.
      setText(raw);
      commit(parseVND(raw));
    }
  }

  function handleBlur() {
    const parsed = parseVND(text);
    setText(parsed === null ? "" : formatNumber(parsed));
    commit(parsed);
  }

  function pick(amount: number) {
    setText(formatNumber(amount));
    commit(amount);
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <div
        className={cn(
          "flex items-center rounded-xl border border-input bg-card transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          invalid && "border-destructive ring-3 ring-destructive/20",
          size === "lg" ? "h-16 px-4" : "h-11 px-3.5",
        )}
      >
        {allowNegative && (
          <button
            type="button"
            onClick={() => {
              setNegative(!negative);
              const parsed = parseVND(text);
              commit(parsed, !negative);
            }}
            className="mr-2 rounded-md px-1.5 text-lg font-semibold text-muted-foreground hover:text-foreground"
            aria-label={negative ? "Đổi thành số dương" : "Đổi thành số âm"}
          >
            {negative ? "−" : "+"}
          </button>
        )}
        <input
          id={id ?? fallbackId}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          className={cn(
            "tabular w-0 min-w-0 flex-1 bg-transparent font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60",
            size === "lg" ? "text-[30px]" : "text-base",
          )}
        />
        <span className={cn("ml-2 font-medium text-muted-foreground", size === "lg" ? "text-xl" : "text-sm")}>₫</span>
      </div>
      <AnimatePresence initial={false}>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="flex gap-2 overflow-hidden"
          >
            {suggestions.map((amount) => (
              <button
                key={amount}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(amount)}
                className="tabular rounded-full border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent active:scale-[0.97]"
              >
                {formatCompactVND(amount)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
