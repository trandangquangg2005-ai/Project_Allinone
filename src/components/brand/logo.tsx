import { cn } from "@/lib/utils";

/** The AIO mark (SVG from /public/brand) with an optional wordmark. */
export function Logo({
  className,
  size = 28,
  withWordmark = true,
  simple = false,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
  simple?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static vector, no optimisation needed */}
      <img
        src={simple ? "/brand/aio-mark-simple.svg" : "/brand/aio-mark.svg"}
        width={size}
        height={size}
        alt={withWordmark ? "" : "AIO"}
        className="shrink-0 select-none"
        draggable={false}
      />
      {withWordmark && <span className="text-lg font-bold tracking-tight">AIO</span>}
    </span>
  );
}
