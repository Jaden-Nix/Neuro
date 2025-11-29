import { useMemo } from "react";

interface RiskHeatmapProps {
  data?: number[][];
  width?: number;
  height?: number;
}

export function RiskHeatmap({ data, width = 12, height = 8 }: RiskHeatmapProps) {
  const heatmapData = useMemo(() => {
    if (data) return data;
    
    // Generate sample data if none provided
    return Array.from({ length: height }, () =>
      Array.from({ length: width }, () => Math.random())
    );
  }, [data, width, height]);

  const getColor = (value: number) => {
    if (value < 0.2) return "bg-green-500/80";
    if (value < 0.4) return "bg-green-400/80";
    if (value < 0.6) return "bg-yellow-500/80";
    if (value < 0.8) return "bg-orange-500/80";
    return "bg-red-500/80";
  };

  const getRiskLevel = (value: number) => {
    if (value < 0.3) return "Low";
    if (value < 0.6) return "Medium";
    return "High";
  };

  return (
    <div className="space-y-3" data-testid="risk-heatmap">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-display font-semibold">Risk Matrix</h3>
          <p className="text-xs text-muted-foreground mt-1">Market exposure & volatility assessment</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500/80" />
            <span className="text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-yellow-500/80" />
            <span className="text-muted-foreground">Med</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-red-500/80" />
            <span className="text-muted-foreground">High</span>
          </div>
        </div>
      </div>

      <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground space-y-1 mb-3">
        <p><strong>What this shows:</strong> Each cell = risk exposure for a market/asset pair</p>
        <p><strong>Green:</strong> Safe to trade | <strong>Yellow:</strong> Caution | <strong>Red:</strong> High risk - avoid or reduce position</p>
      </div>

      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
        {heatmapData.map((row, rowIndex) =>
          row.map((value, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`aspect-square rounded-sm ${getColor(value)} group relative cursor-pointer hover-elevate`}
              data-testid={`heatmap-cell-${rowIndex}-${colIndex}`}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-card border border-border rounded px-2 py-1 shadow-lg whitespace-nowrap text-xs">
                  <p className="font-semibold">{getRiskLevel(value)} Risk</p>
                  <p className="text-muted-foreground font-mono">{(value * 100).toFixed(1)}%</p>
                  <p className="text-muted-foreground text-[10px]">
                    [{rowIndex},{colIndex}]
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
