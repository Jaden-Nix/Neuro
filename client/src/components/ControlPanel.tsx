import { Play, Zap, Hand, History, Pause, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="space-y-4" data-testid="control-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-display font-bold">Control Center</h3>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowHelp(true)}
            data-testid="button-help-control"
          >
            <Info className="w-4 h-4" />
          </Button>
          <Badge 
            variant={autonomousMode ? "default" : "secondary"}
            className="text-xs"
            data-testid="badge-autonomous-status"
            title={autonomousMode ? "System is running autonomously" : "System requires manual commands"}
          >
            {autonomousMode ? "AUTONOMOUS" : "MANUAL"}
          </Badge>
        </div>
      </div>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Control Center Guide</DialogTitle>
            <DialogDescription>How to use each control</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Run Simulation</h4>
              <p className="text-muted-foreground">Tests your strategy on multiple market scenarios to predict outcomes and profitability before risking real money.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Auto Mode</h4>
              <p className="text-muted-foreground">Enables the system to automatically execute approved strategies 24/7 without waiting for your approval on each trade.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Manual Override</h4>
              <p className="text-muted-foreground">Pauses all autonomous actions and requires you to manually approve each trade before execution.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">Replay</h4>
              <p className="text-muted-foreground">Step through past events on the timeline to review historical decisions and understand what happened.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <Button
          className="w-full text-sm font-display font-semibold"
          onClick={onRunSimulation}
          disabled={isSimulating}
          data-testid="button-run-simulation"
          title="Run a simulation to test strategy and predict outcomes"
        >
          <Play className="w-4 h-4 mr-2" />
          {isSimulating ? "Simulating..." : "Run Simulation"}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={autonomousMode ? "destructive" : "default"}
            size="sm"
            onClick={onToggleAutonomous}
            data-testid="button-toggle-autonomous"
            title={autonomousMode ? "Stop autonomous mode and return to manual control" : "Enable autonomous mode to run strategies automatically"}
          >
            {autonomousMode ? (
              <>
                <Pause className="w-3 h-3 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 mr-1" />
                Auto
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onManualOverride}
            data-testid="button-manual-override"
            title="Pause all autonomous actions and take manual control"
          >
            <Hand className="w-3 h-3 mr-1" />
            Override
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onReplay}
          data-testid="button-replay"
          title="Replay past events and examine historical decisions"
        >
          <History className="w-3 h-3 mr-2" />
          Replay
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
