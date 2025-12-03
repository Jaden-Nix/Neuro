import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { queryClient } from "./lib/queryClient";
import { config } from "./lib/wagmi";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingWizard, useOnboarding } from "@/components/OnboardingWizard";

import Dashboard from "@/pages/Dashboard";
import MLInsights from "@/pages/MLInsights";
// import Marketplace from "@/pages/Marketplace";
import Alerts from "@/pages/Alerts";
import Backtesting from "@/pages/Backtesting";
import Wallets from "@/pages/Wallets";
import Parliament from "@/pages/Parliament";
import Evolution from "@/pages/Evolution";
import StressLab from "@/pages/StressLab";
import DreamMode from "@/pages/DreamMode";
import Insights from "@/pages/Insights";
import TradingAdvisor from "@/pages/TradingAdvisor";
import UltronSignals from "@/pages/UltronSignals";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trading" component={TradingAdvisor} />
      <Route path="/signals" component={UltronSignals} />
      <Route path="/ml" component={MLInsights} />
      {/* <Route path="/marketplace" component={Marketplace} /> */}
      <Route path="/alerts" component={Alerts} />
      <Route path="/backtesting" component={Backtesting} />
      <Route path="/wallets" component={Wallets} />
      <Route path="/parliament" component={Parliament} />
      <Route path="/evolution" component={Evolution} />
      <Route path="/stress-lab" component={StressLab} />
      <Route path="/dream-mode" component={DreamMode} />
      <Route path="/insights" component={Insights} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme === "dark" ? darkTheme() : lightTheme()}
          showRecentTransactions={true}
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function AppLayout() {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  const { showOnboarding, hasChecked, completeOnboarding } = useOnboarding();

  return (
    <>
      {hasChecked && showOnboarding && (
        <OnboardingWizard 
          onComplete={completeOnboarding} 
          onSkip={completeOnboarding} 
        />
      )}
      <SidebarProvider style={style}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <div className="p-6">
                <Router />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProviders>
        <AppLayout />
      </AppProviders>
    </ThemeProvider>
  );
}
