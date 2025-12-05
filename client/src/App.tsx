import { useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { AnimatePresence, motion } from "framer-motion";

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
import TradeHistory from "@/pages/TradeHistory";
import NotFound from "@/pages/not-found";

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

const pageTransition = {
  duration: 0.15,
  ease: "easeInOut"
};

function Router() {
  const [location] = useLocation();
  
  const getPageComponent = () => {
    switch (location) {
      case "/": return <Dashboard />;
      case "/trading": return <TradingAdvisor />;
      case "/signals": return <UltronSignals />;
      case "/ml": return <MLInsights />;
      case "/alerts": return <Alerts />;
      case "/backtesting": return <Backtesting />;
      case "/wallets": return <Wallets />;
      case "/parliament": return <Parliament />;
      case "/evolution": return <Evolution />;
      case "/stress-lab": return <StressLab />;
      case "/dream-mode": return <DreamMode />;
      case "/insights": return <Insights />;
      case "/history": return <TradeHistory />;
      default: return <NotFound />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
        className="h-full w-full bg-background"
      >
        {getPageComponent()}
      </motion.div>
    </AnimatePresence>
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
