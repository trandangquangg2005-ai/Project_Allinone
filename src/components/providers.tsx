"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* Respect the OS "reduce motion" setting everywhere. */}
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="top-center" closeButton />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
