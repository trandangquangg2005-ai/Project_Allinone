import { swatchStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Icon on the logo's hexagon, tinted with a swatch. */
export function HexBadge({
  color,
  size = "md",
  className,
  children,
}: {
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={swatchStyle(color)}
      className={cn(
        "hex inline-flex shrink-0 items-center justify-center",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-12 [&_svg]:size-6",
        className,
      )}
    >
      {children}
    </span>
  );
}
