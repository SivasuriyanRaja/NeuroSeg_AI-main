import type { Status } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const styles: Record<Status, string> = {
  Completed: "bg-success/12 text-success border-success/30 shadow-[0_0_12px_-4px_var(--success)]",
  Running: "bg-info/12 text-info border-info/30 shadow-[0_0_12px_-4px_var(--info)]",
  Queued: "bg-warning/12 text-warning border-warning/30",
  Failed: "bg-destructive/12 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", styles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", status === "Running" && "animate-pulse")} />
      {status}
    </span>
  );
}
