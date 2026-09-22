import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid justify-items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground [&_svg]:size-10">{icon}</div>}
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="max-w-sm text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
