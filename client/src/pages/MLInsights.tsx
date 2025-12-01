import { MLInsightsDashboard } from "@/components/MLInsightsDashboard";

export default function MLInsights() {
  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">AI Insights & Predictions</h1>
        <p className="text-muted-foreground mt-2">Advanced ML pattern recognition for DeFi opportunities</p>
      </div>
      <MLInsightsDashboard />
    </div>
  );
}
