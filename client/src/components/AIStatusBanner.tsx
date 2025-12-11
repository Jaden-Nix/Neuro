import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Play, Pause, Zap } from "lucide-react";

interface AIStatus {
  isPaused: boolean;
  dailySpent: number;
  dailyLimit: number;
  remaining: number;
  callCount: number;
  reducedMode: boolean;
  budgetExceeded: boolean;
  pausedAt: number | null;
  resumeCount: number;
  message: string;
}

export function AIStatusBanner() {
  const { data: status, isLoading } = useQuery<AIStatus>({
    queryKey: ["/api/ai/status"],
    refetchInterval: 5000,
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/resume");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/pause");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
    },
  });

  if (isLoading || !status) return null;

  const progressPercent = Math.min(100, (status.dailySpent / status.dailyLimit) * 100);

  if (status.isPaused) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 max-w-sm bg-amber-950/95 border border-amber-600 rounded-md p-4 shadow-lg backdrop-blur-sm"
        data-testid="banner-ai-paused"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-amber-200">AI Paused</h4>
            <p className="text-xs text-amber-300/80 mt-1">
              {status.budgetExceeded 
                ? `Daily $${status.dailyLimit.toFixed(2)} budget reached.`
                : "AI features are manually paused."}
            </p>
            <p className="text-xs text-amber-300/60 mt-1">
              Spent: ${status.dailySpent.toFixed(2)} / ${status.dailyLimit.toFixed(2)}
            </p>
            <Button
              size="sm"
              className="mt-3 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              data-testid="button-resume-ai"
            >
              <Play className="h-3 w-3 mr-1" />
              {resumeMutation.isPending ? "Resuming..." : "Resume AI"}
            </Button>
            {status.resumeCount > 0 && (
              <p className="text-xs text-amber-300/50 mt-2">
                Resumed {status.resumeCount} time{status.resumeCount > 1 ? "s" : ""} today
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status.reducedMode) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 max-w-sm bg-yellow-950/90 border border-yellow-600/50 rounded-md p-3 shadow-lg backdrop-blur-sm"
        data-testid="banner-ai-reduced"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          <div className="flex-1">
            <p className="text-xs text-yellow-200">
              AI at {progressPercent.toFixed(0)}% of daily budget
            </p>
            <div className="w-full bg-yellow-900/50 rounded-full h-1.5 mt-1">
              <div 
                className="bg-yellow-400 h-1.5 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-yellow-300 hover:text-yellow-100"
            onClick={() => pauseMutation.mutate()}
            data-testid="button-pause-ai"
          >
            <Pause className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
