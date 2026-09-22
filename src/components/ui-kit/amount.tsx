import { formatVND } from "@/lib/money";
import { cn } from "@/lib/utils";

export type AmountTone = "income" | "expense" | "transfer" | "neutral" | "debt";

const TONE: Record<AmountTone, string> = {
  income: "text-income",
  expense: "text-expense",
  transfer: "text-muted-foreground",
  neutral: "text-foreground",
  debt: "text-debt",
};

/** Money with a sign that matches its direction: +income, −expense. */
export function Amount({
  value,
  tone = "neutral",
  className,
}: {
  value: number;
  tone?: AmountTone;
  className?: string;
}) {
  const signed = tone === "expense" ? -Math.abs(value) : tone === "income" ? Math.abs(value) : value;
  return (
    <span data-money className={cn("font-semibold whitespace-nowrap", TONE[tone], className)}>
      {formatVND(signed, { sign: tone === "income" })}
    </span>
  );
}
