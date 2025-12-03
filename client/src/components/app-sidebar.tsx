import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  Zap, 
  Brain, 
  LayoutDashboard,
  Bell,
  FlaskConical,
  Wallet,
  Gavel,
  GitBranch,
  Moon,
  Beaker,
  Activity,
  TrendingUp,
  Signal,
} from "lucide-react";

const menuItems = [
  {
    title: "Command Center",
    url: "/",
    icon: LayoutDashboard,
    testId: "nav-dashboard",
  },
  {
    title: "Trading Advisor",
    url: "/trading",
    icon: TrendingUp,
    testId: "nav-trading",
  },
  {
    title: "Ultron Signals",
    url: "/signals",
    icon: Signal,
    testId: "nav-signals",
  },
  {
    title: "AI Insights",
    url: "/insights",
    icon: Brain,
    testId: "nav-insights",
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
  {
    title: "Parliament",
    url: "/parliament",
    icon: Gavel,
    testId: "nav-parliament",
  },
  {
    title: "Evolution Tree",
    url: "/evolution",
    icon: GitBranch,
    testId: "nav-evolution",
  },
  {
    title: "Stress Lab",
    url: "/stress-lab",
    icon: Beaker,
    testId: "nav-stress-lab",
  },
  {
    title: "Dream Mode",
    url: "/dream-mode",
    icon: Moon,
    testId: "nav-dream-mode",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-4">
        <motion.div 
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">NeuroNet</span>
            <span className="text-xs text-muted-foreground">Governor</span>
          </div>
        </motion.div>
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {menuItems.map((item, index) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                    >
                      <SidebarMenuButton
                        asChild
                        data-testid={item.testId}
                        className={`
                          relative rounded-lg transition-all duration-200
                          ${isActive 
                            ? "bg-primary/10 text-primary dark:bg-primary/15 font-medium" 
                            : "text-muted-foreground hover:text-foreground"
                          }
                        `}
                      >
                        <a href={item.url} className="flex items-center gap-3 px-3 py-2">
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span className="text-sm">{item.title}</span>
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 35 }}
                            />
                          )}
                        </a>
                      </SidebarMenuButton>
                    </motion.div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3 w-3 text-green-500 animate-pulse" />
          <span>System Active</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
