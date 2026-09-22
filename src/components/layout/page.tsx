import { CaretLeftIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { ViewTransition } from "react";
import { cn } from "@/lib/utils";

const ENTER = { nav: "page-enter", "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };
const EXIT = { nav: "page-exit", "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * Every page renders through this: a header plus the route transition.
 * The ViewTransition lives in the page (not the layout) so it enters/exits.
 */
export function Page({
  title,
  description,
  actions,
  back,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ViewTransition enter={ENTER} exit={EXIT} default="none">
      <div className={cn("grid gap-6", className)}>
        <header className="grid gap-3">
          {back && (
            <Link
              href={back.href}
              transitionTypes={["nav-back"]}
              className="-ml-1 inline-flex w-fit items-center gap-1 rounded-lg px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <CaretLeftIcon className="size-4" />
              {back.label}
            </Link>
          )}
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-balance md:text-[30px]">
                {title}
              </h1>
              {description && <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </header>
        {children}
      </div>
    </ViewTransition>
  );
}
