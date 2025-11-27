import { Play, Zap, Hand, History, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ControlPanelProps {
  autonomousMode: boolean;
  onRunSimulation: () => void;
  onToggleAutonomous: () => void;
  onManualOverride: () => void;
  onReplay: () => void;
  isSimulating?: boolean;
}

export function ControlPanel({
  autonomousMode,
  onRunSimulation,
  onToggleAutonomous,
  onManualOverride,
  onReplay,
  isSimulating = false,
}: ControlPanelProps) {
  return (
    <div className="space-y-4" data-testid="control-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-display font-bold">Control Center</h3>
        <Badge 
          variant={autonomousMode ? "default" : "secondary"}
          className="text-xs"
          data-testid="badge-autonomous-status"
        >
          {autonomousMode ? "AUTONOMOUS" : "MANUAL"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Button
          className="h-12 text-sm font-display font-semibold"
          onClick={onRunSimulation}
          disabled={isSimulating}
          data-testid="button-run-simulation"
        >
          <Play className="w-4 h-4 mr-1 flex-shrink-0" />
          <span className="truncate">{isSimulating ? "Simulating..." : "Run Simulation"}</span>
        </Button>

        <Button
          variant={autonomousMode ? "destructive" : "default"}
          className="h-12 text-sm font-display font-semibold"
          onClick={onToggleAutonomous}
          data-testid="button-toggle-autonomous"
        >
          {autonomousMode ? (
            <>
              <Pause className="w-4 h-4 mr-1 flex-shrink-0" />
              <span className="truncate">Stop Auto</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-1 flex-shrink-0" />
              <span className="truncate">Autonomous Mode</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          className="h-12 text-sm font-display font-semibold"
          onClick={onManualOverride}
          data-testid="button-manual-override"
        >
          <Hand className="w-4 h-4 mr-1 flex-shrink-0" />
          <span className="truncate">Manual Override</span>
        </Button>

        <Button
          variant="outline"
          className="h-12 text-sm font-display font-semibold"
          onClick={onReplay}
          data-testid="button-replay"
        >
          <History className="w-4 h-4 mr-1 flex-shrink-0" />
          <span className="truncate">Replay Last Cycle</span>
        </Button>
      </div>

      <div className="mt-6 p-4 rounded-lg bg-card/50 border border-border">
        <h4 className="text-sm font-display font-semibold mb-3">System Status</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mode:</span>
            <span className="font-semibold">{autonomousMode ? "Autonomous" : "Manual"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Simulation:</span>
            <span className="font-semibold">{isSimulating ? "Running" : "Idle"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
