import { AnimatedMoney } from "@/components/ui-kit/animated-number";
import { cn } from "@/lib/utils";

/** One strip, three figures: the month's income, spending and what is left. */
export function MonthSummary({ income, expense }: { income: number; expense: number }) {
  const net = income - expense;
  const items = [
    { label: "Tổng thu", value: income, className: income ? "text-income" : "text-muted-foreground", sign: true },
    { label: "Tổng chi", value: -expense, className: expense ? "text-expense" : "text-muted-foreground", sign: false },
    { label: "Chênh lệch", value: net, className: net < 0 ? "text-expense" : net ? "text-foreground" : "text-muted-foreground", sign: true },
  ];
  return (
    <div className="grid grid-cols-3 divide-x rounded-2xl border bg-card">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 px-3 py-4 sm:px-5">
          <span className="text-[13px] text-muted-foreground">{item.label}</span>
          <AnimatedMoney
            value={item.value}
            sign={item.sign}
            className={cn("truncate text-[15px] font-semibold tracking-tight sm:text-xl", item.className)}
          />
        </div>
      ))}
    </div>
  );
}
