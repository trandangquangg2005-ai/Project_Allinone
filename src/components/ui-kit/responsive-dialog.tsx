"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

/**
 * A dialog on desktop, a swipe-to-close bottom sheet on phones. Forms put
 * their primary button in `footer` so it stays reachable above the keyboard.
 *
 * Layout: the header and footer keep their height, the body takes what is
 * left and scrolls. `flex` replaces the base grid and `min-h-0` lets the body
 * shrink — without it the body keeps its full content height and a tall form
 * is simply cut off on short screens, with nothing to scroll.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg",
            className,
          )}
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 scroll-pb-8 overflow-x-hidden overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>
          {footer && (
            <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-2xl border-t bg-muted/40 px-6 py-4">
              {footer}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className={cn("max-h-[94dvh]", className)}>
        <DrawerHeader className="shrink-0 px-5 pt-2 pb-3 text-left">
          <DrawerTitle className="text-lg">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="min-h-0 flex-1 scroll-pb-8 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && (
          <DrawerFooter className="shrink-0 border-t px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
