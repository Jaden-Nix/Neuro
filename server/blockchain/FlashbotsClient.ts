import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toHex } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

interface MEVProtectionConfig {
  defaultSlippageBps: number;
  maxSlippageBps: number;
  minExecutionWindowMs: number;
  maxExecutionWindowMs: number;
  privateMempool: boolean;
}

const DEFAULT_MEV_CONFIG: MEVProtectionConfig = {
  defaultSlippageBps: 50,
  maxSlippageBps: 500,
  minExecutionWindowMs: 2000,
  maxExecutionWindowMs: 10000,
  privateMempool: true,
};

export interface MEVRiskAnalysis {
  sandwichRisk: number;
  frontrunRisk: number;
  backrunRisk: number;
  overallRiskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  estimatedMEVLoss: number;
  recommendations: string[];
}

export interface PrivateTransactionParams {
  to: string;
  value: bigint;
  data?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gas?: bigint;
}

export interface PrivateTransactionResult {
  txHash: string;
  status: "pending" | "included" | "failed" | "cancelled";
  blockNumber?: number;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

export interface MEVProtectionStrategy {
  usePrivateMempool: boolean;
  slippageBps: number;
  executionWindowMs: number;
  priorityFee: bigint;
  useFlashbots: boolean;
}

export interface TransactionAnalysis {
  txHash: string;
  isSandwichTarget: boolean;
  sandwichDetails?: {
    frontrunTx?: string;
    backrunTx?: string;
    estimatedLoss: number;
  };
  mevExtracted: number;
  protectionSuggestions: string[];
}

export class FlashbotsClient {
  private relayUrl: string;
  private publicClient: ReturnType<typeof createPublicClient>;
  private config: MEVProtectionConfig;
  private authSignerPrivateKey: string | undefined;

  constructor(config: Partial<MEVProtectionConfig> = {}) {
    this.relayUrl = "https://relay.flashbots.net";
    this.config = { ...DEFAULT_MEV_CONFIG, ...config };
    this.authSignerPrivateKey = process.env.FLASHBOTS_AUTH_KEY;

    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com"),
    });

    console.log("[Flashbots] MEV Protection client initialized");
  }

  private async signMessage(message: string): Promise<string> {
    if (!this.authSignerPrivateKey) {
      throw new Error("Flashbots auth key not configured");
    }
    const account = privateKeyToAccount(`0x${this.authSignerPrivateKey.replace('0x', '')}`);
    const messageHash = keccak256(toHex(message));
    return await account.signMessage({ message: { raw: messageHash } });
  }

  async analyzeMEVRisk(
    txValue: bigint,
    txTo: string,
    txData?: string
  ): Promise<MEVRiskAnalysis> {
    const valueEth = parseFloat(formatEther(txValue));
    
    let sandwichRisk = 0;
    let frontrunRisk = 0;
    let backrunRisk = 0;

    if (valueEth > 1) sandwichRisk += 20;
    if (valueEth > 10) sandwichRisk += 30;
    if (valueEth > 100) sandwichRisk += 40;

    const isSwap = txData?.includes("0x38ed1739") || 
                   txData?.includes("0x7ff36ab5") || 
                   txData?.includes("0x18cbafe5") ||
                   txData?.includes("0x8803dbee");
    
    if (isSwap) {
      frontrunRisk += 40;
      sandwichRisk += 30;
    }

    const isLiquidityAction = txData?.includes("0xe8e33700") || 
                              txData?.includes("0xbaa2abde");
    
    if (isLiquidityAction) {
      backrunRisk += 25;
      frontrunRisk += 15;
    }

    try {
      const gasPrice = await this.publicClient.getGasPrice();
      const gasPriceGwei = Number(gasPrice) / 1e9;
      
      if (gasPriceGwei > 50) {
        frontrunRisk += 15;
        sandwichRisk += 10;
      }
    } catch (error) {
      console.warn("[Flashbots] Could not fetch gas price for MEV analysis");
    }

    const overallRiskScore = Math.min(
      100,
      Math.round((sandwichRisk * 0.5 + frontrunRisk * 0.35 + backrunRisk * 0.15))
    );

    let riskLevel: "low" | "medium" | "high" | "critical";
    if (overallRiskScore < 25) riskLevel = "low";
    else if (overallRiskScore < 50) riskLevel = "medium";
    else if (overallRiskScore < 75) riskLevel = "high";
    else riskLevel = "critical";

    const estimatedMEVLoss = valueEth * (overallRiskScore / 100) * 0.03;

    const recommendations: string[] = [];
    
    if (overallRiskScore > 25) {
      recommendations.push("Use private mempool submission via Flashbots");
    }
    if (isSwap && valueEth > 1) {
      recommendations.push("Consider breaking into smaller transactions");
    }
    if (sandwichRisk > 30) {
      recommendations.push("Reduce slippage tolerance to minimize sandwich attack impact");
    }
    if (frontrunRisk > 40) {
      recommendations.push("Use time-delayed execution to avoid frontrunning");
    }
    if (overallRiskScore > 50) {
      recommendations.push("Consider using MEV blocker or Flashbots Protect RPC");
    }

    return {
      sandwichRisk,
      frontrunRisk,
      backrunRisk,
      overallRiskScore,
      riskLevel,
      estimatedMEVLoss,
      recommendations,
    };
  }

  async sendPrivateTransaction(
    params: PrivateTransactionParams,
    signerPrivateKey: string
  ): Promise<PrivateTransactionResult> {
    if (!this.authSignerPrivateKey) {
      throw new Error("Flashbots auth key not configured");
    }

    try {
      const account = privateKeyToAccount(`0x${signerPrivateKey.replace('0x', '')}`);
      
      const nonce = await this.publicClient.getTransactionCount({
        address: account.address,
      });

      const gasEstimate = params.gas || await this.publicClient.estimateGas({
        account,
        to: params.to as `0x${string}`,
        value: params.value,
        data: params.data as `0x${string}`,
      });

      const { maxFeePerGas, maxPriorityFeePerGas } = await this.publicClient.estimateFeesPerGas();

      const tx = {
        to: params.to as `0x${string}`,
        value: params.value,
        data: params.data as `0x${string}`,
        gas: gasEstimate,
        maxFeePerGas: params.maxFeePerGas || maxFeePerGas!,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas || maxPriorityFeePerGas!,
        nonce,
        chainId: mainnet.id,
        type: "eip1559" as const,
      };

      const serializedTx = await account.signTransaction(tx);

      const currentBlock = await this.publicClient.getBlockNumber();
      const maxBlockNumber = `0x${(currentBlock + BigInt(25)).toString(16)}`;

      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_sendPrivateTransaction",
        params: [{
          tx: serializedTx,
          maxBlockNumber,
          preferences: {
            fast: true,
            privacy: {
              hints: ["calldata"],
              builders: ["flashbots"],
            },
          },
        }],
      };

      const bodyString = JSON.stringify(requestBody);
      const signature = await this.signMessage(bodyString);
      const authAccount = privateKeyToAccount(`0x${this.authSignerPrivateKey.replace('0x', '')}`);

      const response = await fetch(this.relayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Flashbots-Signature": `${authAccount.address}:${signature}`,
        },
        body: bodyString,
      });

      if (!response.ok) {
        throw new Error(`Flashbots relay error: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return {
        txHash: result.result,
        status: "pending",
      };
    } catch (error) {
      console.error("[Flashbots] Failed to send private transaction:", error);
      throw error;
    }
  }

  async cancelPrivateTransaction(txHash: string): Promise<boolean> {
    if (!this.authSignerPrivateKey) {
      return false;
    }

    try {
      const requestBody = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_cancelPrivateTransaction",
        params: [{ txHash }],
      };

      const bodyString = JSON.stringify(requestBody);
      const signature = await this.signMessage(bodyString);
      const authAccount = privateKeyToAccount(`0x${this.authSignerPrivateKey.replace('0x', '')}`);

      const response = await fetch(this.relayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Flashbots-Signature": `${authAccount.address}:${signature}`,
        },
        body: bodyString,
      });

      const result = await response.json();
      return result.result === true;
    } catch (error) {
      console.error("[Flashbots] Failed to cancel transaction:", error);
      return false;
    }
  }

  detectSandwichPattern(
    txs: Array<{ from: string; to: string; value: bigint; blockNumber: number; txIndex: number }>
  ): TransactionAnalysis[] {
    const analyses: TransactionAnalysis[] = [];

    for (let i = 1; i < txs.length - 1; i++) {
      const prevTx = txs[i - 1];
      const currentTx = txs[i];
      const nextTx = txs[i + 1];

      if (
        prevTx.blockNumber === currentTx.blockNumber &&
        currentTx.blockNumber === nextTx.blockNumber &&
        prevTx.to === currentTx.to &&
        currentTx.to === nextTx.to &&
        prevTx.from === nextTx.from &&
        prevTx.from !== currentTx.from
      ) {
        const estimatedLoss = parseFloat(formatEther(currentTx.value)) * 0.02;

        analyses.push({
          txHash: `0x${i.toString(16).padStart(64, '0')}`,
          isSandwichTarget: true,
          sandwichDetails: {
            frontrunTx: `0x${(i - 1).toString(16).padStart(64, '0')}`,
            backrunTx: `0x${(i + 1).toString(16).padStart(64, '0')}`,
            estimatedLoss,
          },
          mevExtracted: estimatedLoss,
          protectionSuggestions: [
            "Use Flashbots Protect RPC for future transactions",
            "Lower slippage tolerance",
            "Use private transaction submission",
          ],
        });
      }
    }

    return analyses;
  }

  calculateOptimalProtectionStrategy(
    txValue: bigint,
    mevRisk: MEVRiskAnalysis
  ): MEVProtectionStrategy {
    const valueEth = parseFloat(formatEther(txValue));
    
    let slippageBps = this.config.defaultSlippageBps;
    if (mevRisk.sandwichRisk > 50) {
      slippageBps = Math.max(25, slippageBps - 25);
    }

    let executionWindowMs = 5000;
    if (mevRisk.frontrunRisk > 40) {
      executionWindowMs = this.config.maxExecutionWindowMs;
    } else if (mevRisk.frontrunRisk < 20) {
      executionWindowMs = this.config.minExecutionWindowMs;
    }

    let priorityFee = parseEther("0.001");
    if (mevRisk.overallRiskScore > 60) {
      priorityFee = parseEther("0.005");
    }

    const useFlashbots = mevRisk.overallRiskScore > 25 || valueEth > 5;
    const usePrivateMempool = useFlashbots && this.config.privateMempool;

    return {
      usePrivateMempool,
      slippageBps,
      executionWindowMs,
      priorityFee,
      useFlashbots,
    };
  }

  async estimateMEVExposure(
    walletAddress: string,
    lookbackBlocks: number = 100
  ): Promise<{
    totalMEVLoss: number;
    sandwichAttacks: number;
    frontrunAttacks: number;
    averageLossPerTx: number;
  }> {
    return {
      totalMEVLoss: 0,
      sandwichAttacks: 0,
      frontrunAttacks: 0,
      averageLossPerTx: 0,
    };
  }

  getProtectionStatus(): {
    flashbotsEnabled: boolean;
    privateMempoolEnabled: boolean;
    defaultSlippage: number;
  } {
    return {
      flashbotsEnabled: !!this.authSignerPrivateKey,
      privateMempoolEnabled: this.config.privateMempool && !!this.authSignerPrivateKey,
      defaultSlippage: this.config.defaultSlippageBps / 100,
    };
  }
}

export const flashbotsClient = new FlashbotsClient();
