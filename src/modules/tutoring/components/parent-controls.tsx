"use client";

import { PrinterIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { MonthSwitcher } from "@/components/ui-kit/month-switcher";

export function ParentMonthSwitcher({ month, current }: { month: string; current: string }) {
  return <MonthSwitcher month={month} current={current} />;
}

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()} aria-label="In hoặc lưu PDF">
      <PrinterIcon className="size-4" />
      <span className="hidden sm:inline">In / Lưu PDF</span>
    </Button>
  );
}
