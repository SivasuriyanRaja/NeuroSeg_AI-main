import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ScanLine, FolderOpen, FlaskConical, Settings, LogOut, Hexagon } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Analyze", url: "/analyze", icon: ScanLine },
  { title: "Cases", url: "/cases", icon: FolderOpen },
  { title: "Experiments", url: "/experiments", icon: FlaskConical },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="backdrop-blur-xl">
      <SidebarHeader className="px-3 py-5">
        <div className="flex items-center gap-2.5">
          <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand shadow-glow">
            <Hexagon className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-semibold">
              NeuroSeg <span className="text-brand">AI</span>
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = path.startsWith(item.url);
                return (
                  <SidebarMenuButton key={item.url} asChild isActive={active} tooltip={item.title}
                    className="data-[active=true]:text-primary data-[active=true]:shadow-[inset_2px_0_0_var(--primary)]">
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={() => navigate({ to: "/", replace: true })}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && <p className="px-2 text-[10px] text-muted-foreground">For research & education only</p>}
      </SidebarFooter>
    </Sidebar>
  );
}
