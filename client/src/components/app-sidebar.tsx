import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { 
  Zap, 
  Brain, 
  Shield, 
  LayoutDashboard,
  Store,
  Bell,
  FlaskConical,
  Wallet
} from "lucide-react";

const menuItems = [
  {
    title: "Command Center",
    url: "/",
    icon: LayoutDashboard,
    testId: "nav-dashboard",
  },
  {
    title: "AI Insights",
    url: "/ml",
    icon: Brain,
    testId: "nav-ml",
  },
  {
    title: "Governance",
    url: "/governance",
    icon: Shield,
    testId: "nav-governance",
  },
  {
    title: "Marketplace",
    url: "/marketplace",
    icon: Store,
    testId: "nav-marketplace",
  },
  {
    title: "Alerts",
    url: "/alerts",
    icon: Bell,
    testId: "nav-alerts",
  },
  {
    title: "Backtesting",
    url: "/backtesting",
    icon: FlaskConical,
    testId: "nav-backtesting",
  },
  {
    title: "Wallets",
    url: "/wallets",
    icon: Wallet,
    testId: "nav-wallets",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            NeuroNet Governor
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-testid={item.testId}
                    className={location === item.url ? "bg-sidebar-accent" : ""}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
