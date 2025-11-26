import { EventEmitter } from "events";
import type { SentinelAlert } from "@shared/schema";

export interface MonitoringConfig {
  walletHealthThreshold: number;
  volatilityThreshold: number;
  pegDeviationThreshold: number;
  liquidityDropThreshold: number;
}

export class SentinelMonitor extends EventEmitter {
  private alerts: SentinelAlert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private config: MonitoringConfig;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    this.config = {
      walletHealthThreshold: 0.2, // 20% drop
      volatilityThreshold: 0.5, // 50% volatility
      pegDeviationThreshold: 0.02, // 2% peg deviation
      liquidityDropThreshold: 0.3, // 30% liquidity drop
      ...config,
    };
  }

  public start(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => this.monitor(), intervalMs);
    this.emit("monitoringStarted");
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.isMonitoring = false;
    this.emit("monitoringStopped");
  }

  private async monitor(): Promise<void> {
    // Wallet Health Check
    await this.checkWalletHealth();

    // Liquidity Check
    await this.checkLiquidityChanges();

    // Peg Deviation Check
    await this.checkPegDeviation();

    // Volatility Check
    await this.checkVolatilitySpikes();

    // Oracle Check
    await this.checkOracleAnomalies();

    // Pool Drain Check
    await this.checkPoolDrains();

    // Liquidation Risk Check
    await this.checkLiquidationRisks();
  }

  private async checkWalletHealth(): Promise<void> {
    // Simulated wallet health check
    const healthScore = Math.random();
    
    if (healthScore < this.config.walletHealthThreshold) {
      this.createAlert({
        alertType: "wallet_health",
        severity: "high",
        message: `Wallet health degraded to ${(healthScore * 100).toFixed(1)}%`,
        data: { healthScore },
        autoExecuted: false,
      });
    }
  }

  private async checkLiquidityChanges(): Promise<void> {
    // Simulated liquidity monitoring
    const liquidityDrop = Math.random() * 0.4;
    
    if (liquidityDrop > this.config.liquidityDropThreshold) {
      this.createAlert({
        alertType: "liquidity_change",
        severity: liquidityDrop > 0.5 ? "critical" : "high",
        message: `Liquidity dropped by ${(liquidityDrop * 100).toFixed(1)}%`,
        data: { liquidityDrop },
        autoExecuted: false,
      });
    }
  }

  private async checkPegDeviation(): Promise<void> {
    // Simulated peg deviation check
    const fraxDeviation = Math.random() * 0.03;
    const krwqDeviation = Math.random() * 0.04;
    
    if (fraxDeviation > this.config.pegDeviationThreshold) {
      this.createAlert({
        alertType: "peg_deviation",
        severity: fraxDeviation > 0.05 ? "critical" : "medium",
        message: `FRAX peg deviation: ${(fraxDeviation * 100).toFixed(2)}%`,
        data: { token: "FRAX", deviation: fraxDeviation },
        autoExecuted: false,
      });
    }
    
    if (krwqDeviation > this.config.pegDeviationThreshold) {
      this.createAlert({
        alertType: "peg_deviation",
        severity: krwqDeviation > 0.05 ? "critical" : "medium",
        message: `KRWQ peg deviation: ${(krwqDeviation * 100).toFixed(2)}%`,
        data: { token: "KRWQ", deviation: krwqDeviation },
        autoExecuted: false,
      });
    }
  }

  private async checkVolatilitySpikes(): Promise<void> {
    const volatility = Math.random();
    
    if (volatility > this.config.volatilityThreshold) {
      this.createAlert({
        alertType: "volatility_spike",
        severity: volatility > 0.7 ? "critical" : "high",
        message: `Volatility spike detected: ${(volatility * 100).toFixed(1)}%`,
        data: { volatility },
        autoExecuted: false,
      });
    }
  }

  private async checkOracleAnomalies(): Promise<void> {
    // Simulated oracle check
    if (Math.random() > 0.98) {
      this.createAlert({
        alertType: "oracle_anomaly",
        severity: "high",
        message: "Oracle price feed discrepancy detected",
        data: { oracle: "Chainlink", discrepancy: 5.2 },
        autoExecuted: false,
      });
    }
  }

  private async checkPoolDrains(): Promise<void> {
    if (Math.random() > 0.95) {
      this.createAlert({
        alertType: "pool_drain",
        severity: "critical",
        message: "Rapid liquidity exit detected in pool",
        data: { pool: "ETH-USDC", exitRate: 45 },
        autoExecuted: true,
      });
    }
  }

  private async checkLiquidationRisks(): Promise<void> {
    const collateralRatio = 1.2 + Math.random() * 0.5;
    
    if (collateralRatio < 1.3) {
      this.createAlert({
        alertType: "liquidation_risk",
        severity: collateralRatio < 1.2 ? "critical" : "high",
        message: `Collateral ratio below safe threshold: ${collateralRatio.toFixed(2)}`,
        data: { collateralRatio },
        autoExecuted: collateralRatio < 1.15,
      });
    }
  }

  private createAlert(alertData: Omit<SentinelAlert, "id" | "timestamp">): void {
    const alert: SentinelAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ...alertData,
      timestamp: Date.now(),
    };

    this.alerts.push(alert);
    this.emit("alert", alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  public getAlerts(filters?: {
    severity?: SentinelAlert["severity"];
    alertType?: SentinelAlert["alertType"];
    active?: boolean;
  }): SentinelAlert[] {
    let results = [...this.alerts];

    if (filters?.severity) {
      results = results.filter((a) => a.severity === filters.severity);
    }

    if (filters?.alertType) {
      results = results.filter((a) => a.alertType === filters.alertType);
    }

    if (filters?.active !== undefined) {
      const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
      results = results.filter((a) => a.timestamp > cutoff);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }
}
