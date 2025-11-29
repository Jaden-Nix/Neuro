import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Search, 
  Shield, 
  Zap, 
  Brain, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AgentCreditScore } from "@shared/schema";

interface PipelineStep {
  id: string;
  name: string;
  agent: string;
  icon: typeof Search;
  color: string;
  status: "pending" | "running" | "complete" | "error";
  result?: any;
}

interface PipelineDemoProps {
  creditScores: AgentCreditScore[];
}

export function PipelineDemo({ creditScores }: PipelineDemoProps) {
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([
    { id: "scout", name: "Scout Agent", agent: "neuronet_scout", icon: Search, color: "text-scout", status: "pending" },
    { id: "risk", name: "Risk Agent", agent: "neuronet_risk", icon: Shield, color: "text-risk", status: "pending" },
    { id: "execution", name: "Execution Agent", agent: "neuronet_execution", icon: Zap, color: "text-execution", status: "pending" },
    { id: "meta", name: "Meta Agent", agent: "neuronet_meta", icon: Brain, color: "text-meta", status: "pending" },
  ]);
  
  const [metaDecision, setMetaDecision] = useState<{ approved: boolean; confidence: number; reasoning: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const pipelineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/adk/workflow", {
        input: {
          marketCondition: "bullish",
          opportunity: "Curve FRAX yield farming at 6.1% APY",
          tvl: 50000000,
          timestamp: Date.now()
        }
      });
      return response.json();
    },
    onSuccess: (data: any[]) => {
      if (data && data.length >= 4) {
        const metaResult = data[3]?.data;
        if (metaResult) {
          setMetaDecision({
            approved: metaResult.approved ?? true,
            confidence: metaResult.confidence ?? 76,
            reasoning: metaResult.reasoning ?? "Risk and execution parameters within acceptable thresholds"
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
    }
  });

  const runPipeline = async () => {
    setIsRunning(true);
    setMetaDecision(null);
    
    setPipelineSteps(steps => steps.map(s => ({ ...s, status: "pending", result: undefined })));

    const stepDelays = [0, 800, 1600, 2400];
    const stepDurations = [700, 700, 700, 700];

    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDelays[i] - (i > 0 ? stepDelays[i-1] : 0)));
      
      setPipelineSteps(steps => 
        steps.map((s, idx) => idx === i ? { ...s, status: "running" } : s)
      );
      
      await new Promise(resolve => setTimeout(resolve, stepDurations[i]));
      
      setPipelineSteps(steps => 
        steps.map((s, idx) => idx === i ? { ...s, status: "complete" } : s)
      );
    }

    pipelineMutation.mutate();
    
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRunning(false);
  };

  const getStepIcon = (step: PipelineStep) => {
    const Icon = step.icon;
    if (step.status === "running") {
      return <Loader2 className={`w-5 h-5 ${step.color} animate-spin`} />;
    }
    if (step.status === "complete") {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
    if (step.status === "error") {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    return <Icon className={`w-5 h-5 ${step.color} opacity-50`} />;
  };

  const completedSteps = pipelineSteps.filter(s => s.status === "complete").length;
  const progress = (completedSteps / pipelineSteps.length) * 100;

  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Live Pipeline Demo</CardTitle>
          </div>
          <Button 
            onClick={runPipeline} 
            disabled={isRunning}
            data-testid="button-run-pipeline"
            size="default"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Pipeline
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Pipeline Progress</span>
            <span>{completedSteps}/4 agents</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Pipeline Steps */}
        <div className="flex items-center justify-between gap-2">
          {pipelineSteps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2">
              <motion.div
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  step.status === "running" 
                    ? "border-primary bg-primary/10" 
                    : step.status === "complete"
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-border bg-card"
                }`}
                animate={step.status === "running" ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.5, repeat: step.status === "running" ? Infinity : 0 }}
              >
                {getStepIcon(step)}
                <span className="text-xs font-medium text-center whitespace-nowrap">
                  {step.name.split(" ")[0]}
                </span>
              </motion.div>
              
              {index < pipelineSteps.length - 1 && (
                <ArrowRight className={`w-4 h-4 ${
                  step.status === "complete" ? "text-green-500" : "text-muted-foreground/30"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Meta Agent Decision Banner */}
        <AnimatePresence>
          {metaDecision && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className={`p-6 rounded-lg border-2 ${
                metaDecision.approved 
                  ? "border-green-500 bg-green-500/10" 
                  : "border-red-500 bg-red-500/10"
              }`}
              data-testid="meta-decision-banner"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Brain className={`w-8 h-8 ${metaDecision.approved ? "text-green-500" : "text-red-500"}`} />
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      Meta Agent Decision:
                      <span className={`text-2xl ${metaDecision.approved ? "text-green-500" : "text-red-500"}`}>
                        {metaDecision.approved ? "APPROVED" : "REJECTED"}
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {metaDecision.reasoning}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={metaDecision.approved ? "default" : "destructive"} className="text-lg px-4 py-1">
                    {metaDecision.confidence}% Confidence
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent Credits Panel */}
        <div className="grid grid-cols-4 gap-3">
          {creditScores.length > 0 ? creditScores.slice(0, 4).map((credit) => (
            <div 
              key={credit.agentId} 
              className="p-3 rounded-lg bg-muted/50 border border-border"
              data-testid={`credit-card-${credit.agentId}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium capitalize">
                  {credit.agentId.replace("neuronet_", "").replace("-core", "")}
                </span>
                <Badge variant="outline" className="text-xs">
                  {credit.agentType}
                </Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono">{credit.totalCredits}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  credit.totalCredits >= 70 ? "bg-green-500" : 
                  credit.totalCredits >= 40 ? "bg-yellow-500" : "bg-red-500"
                }`} />
                <span className="text-xs text-muted-foreground">
                  {credit.successfulActions || 0} wins / {credit.failedActions || 0} fails
                </span>
              </div>
            </div>
          )) : (
            <>
              {["Scout", "Risk", "Execution", "Meta"].map((name) => (
                <div key={name} className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-medium">{name}</span>
                    <Badge variant="outline" className="text-xs">v1</Badge>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono">50</span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-xs text-muted-foreground">0 wins / 0 fails</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Why This Matters */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Why this matters:</span> Traditional governance takes days of voting. 
            This pipeline completes in <span className="font-mono text-primary">~3 seconds</span> with full transparency, 
            accountability, and human override capability.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
