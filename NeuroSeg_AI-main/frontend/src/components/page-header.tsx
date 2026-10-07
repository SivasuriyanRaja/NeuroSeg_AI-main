import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function PageHeader({ title, crumbs, actions }: { title: string; crumbs: string[]; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">
            {["Workspace", ...crumbs].join("  /  ")}
          </p>
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
