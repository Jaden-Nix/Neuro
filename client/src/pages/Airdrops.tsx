import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Gift, 
  Bell, 
  Sparkles, 
  Rocket, 
  Shield, 
  Clock, 
  Target,
  Zap,
  TrendingUp,
  Users,
  Coins,
  CheckCircle2
} from "lucide-react";

const upcomingFeatures = [
  {
    icon: Target,
    title: "Eligibility Checker",
    description: "AI-powered scanning to check wallet eligibility across upcoming airdrops"
  },
  {
    icon: Shield,
    title: "Sybil Detection Avoidance",
    description: "Smart strategies to ensure legitimate participation and avoid disqualification"
  },
  {
    icon: TrendingUp,
    title: "Opportunity Ranking",
    description: "Scout Agent ranks airdrops by expected value and effort required"
  },
  {
    icon: Zap,
    title: "Auto-Farming Tasks",
    description: "Automated completion of on-chain interactions to maximize eligibility"
  },
  {
    icon: Users,
    title: "Community Alerts",
    description: "Early notifications from our agent network monitoring new opportunities"
  },
  {
    icon: Coins,
    title: "Portfolio Tracking",
    description: "Track claimed and unclaimed airdrops across all connected wallets"
  }
];

export default function Airdrops() {
  return (
    <div className="flex flex-col h-full space-y-6" data-testid="page-airdrops">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            Airdrop Opportunities
          </h1>
          <p className="text-sm text-muted-foreground">
            AI-powered airdrop discovery and eligibility tracking
          </p>
        </div>
        <Badge variant="secondary" className="animate-pulse text-sm px-3 py-1">
          <Sparkles className="w-3 h-3 mr-1" />
          Coming Soon
        </Badge>
      </div>

      <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift className="w-12 h-12 text-primary animate-bounce" style={{ animationDuration: "2s" }} />
            </div>
            <div className="absolute -top-1 -right-1">
              <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
            </div>
            <div className="absolute -bottom-2 -left-2">
              <Rocket className="w-5 h-5 text-primary/60 animate-pulse" style={{ animationDelay: "0.5s" }} />
            </div>
          </div>

          <div className="space-y-2 max-w-lg">
            <h2 className="text-2xl font-bold">Airdrop Intelligence Coming Soon</h2>
            <p className="text-muted-foreground">
              Our Scout and Meta agents are being trained to discover, analyze, and track 
              airdrop opportunities across the DeFi ecosystem. Get notified when we launch.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Button variant="default" disabled className="gap-2" data-testid="button-notify-airdrops">
              <Bell className="w-4 h-4" />
              Notify Me
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expected Q1 2026</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          Features in Development
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingFeatures.map((feature, index) => (
            <Card key={index} className="bg-muted/30" data-testid={`card-feature-${index}`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-medium">{feature.title}</h4>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Why NeuroNet for Airdrops?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Our multi-agent system brings unique advantages to airdrop hunting:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span><strong>Scout Agent</strong> monitors on-chain activity and protocol announcements 24/7</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span><strong>Risk Agent</strong> evaluates legitimacy and scam probability of each opportunity</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span><strong>Execution Agent</strong> optimizes gas timing and transaction ordering</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
              <span><strong>Meta Agent</strong> synthesizes intelligence for prioritized recommendations</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
