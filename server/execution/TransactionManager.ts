import { EventEmitter } from "events";
import { z } from "zod";
import type { Agent, ChainTransaction } from "@shared/schema";

export const TransactionProposalSchema = z.object({
  opportunityType: z.enum(["swap", "stake", "unstake", "deposit", "withdraw", "transfer"]).default("swap"),
  chainId: z.number().int().positive().default(1),
  fromToken: z.string().optional(),
  toToken: z.string().optional(),
  amount: z.string().default("0"),
});

export const ExecutionPlanSchema = z.object({
  slippage: z.number().min(0).max(100).default(0.5),
  deadline: z.number().optional(),
});

export const SubmitTransactionSchema = z.object({
  signedHash: z.string().min(66).max(66).regex(/^0x[a-fA-F0-9]{64}$/),
});

export const ConfirmTransactionSchema = z.object({
  blockNumber: z.number().int().nonnegative(),
  gasUsed: z.string(),
});

export type TransactionProposal = z.infer<typeof TransactionProposalSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export interface TransactionRequest {
  id: string;
  type: "swap" | "rebalance" | "loan" | "stake" | "unstake" | "deposit" | "withdraw" | "transfer";
  chainId: number;
  fromToken?: string;
  toToken?: string;
  amount: string;
  slippageTolerance: number;
  deadline: number;
  proposedBy: string;
  approvedBy: string[];
}

export interface UnsignedTransaction {
  id: string;
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface TransactionStatus {
  id: string;
  status: "pending" | "submitted" | "confirmed" | "failed" | "cancelled";
  hash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  transactionId: string;
  hash?: string;
  error?: string;
  creditAdjustment: number;
}

export class TransactionManager extends EventEmitter {
  private pendingTransactions: Map<string, TransactionRequest> = new Map();
  private transactionStatuses: Map<string, TransactionStatus> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  public validateProposal(data: unknown): TransactionProposal {
    return TransactionProposalSchema.parse(data);
  }

  public validateExecutionPlan(data: unknown): ExecutionPlan {
    return ExecutionPlanSchema.parse(data);
  }

  public createTransactionBundle(
    proposal: TransactionProposal,
    executionPlan: ExecutionPlan,
    agentId: string
  ): TransactionRequest {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const txRequest: TransactionRequest = {
      id: txId,
      type: proposal.opportunityType || "swap",
      chainId: proposal.chainId || 1,
      fromToken: proposal.fromToken,
      toToken: proposal.toToken,
      amount: proposal.amount || "0",
      slippageTolerance: executionPlan.slippage || 0.5,
      deadline: Date.now() + 300000,
      proposedBy: agentId,
      approvedBy: [],
    };

    this.pendingTransactions.set(txId, txRequest);
    this.transactionStatuses.set(txId, {
      id: txId,
      status: "pending",
      timestamp: Date.now(),
    });

    this.emit("transactionCreated", txRequest);
    return txRequest;
  }

  public buildUnsignedTransaction(txRequest: TransactionRequest): UnsignedTransaction {
    const encodedData = this.encodeTransactionData(txRequest);

    return {
      id: txRequest.id,
      to: this.getRouterAddress(txRequest.chainId, txRequest.type),
      data: encodedData,
      value: txRequest.type === "swap" && txRequest.fromToken === "ETH" 
        ? txRequest.amount 
        : "0",
      chainId: txRequest.chainId,
      gasLimit: this.estimateGasLimit(txRequest.type),
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
    };
  }

  private encodeTransactionData(txRequest: TransactionRequest): string {
    const functionSig = {
      swap: "0x38ed1739",
      stake: "0xa694fc3a",
      unstake: "0x2e1a7d4d",
      deposit: "0xd0e30db0",
      withdraw: "0x2e1a7d4d",
      transfer: "0xa9059cbb",
    };

    return functionSig[txRequest.type] || "0x";
  }

  private getRouterAddress(chainId: number, type: string): string {
    const routers: Record<number, Record<string, string>> = {
      1: {
        swap: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        stake: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
        default: "0x0000000000000000000000000000000000000000",
      },
      8453: {
        swap: "0x2626664c2603336E57B271c5C0b26F421741e481",
        default: "0x0000000000000000000000000000000000000000",
      },
    };

    return routers[chainId]?.[type] || routers[chainId]?.default || "0x0000000000000000000000000000000000000000";
  }

  private estimateGasLimit(type: string): string {
    const gasLimits: Record<string, string> = {
      swap: "250000",
      stake: "150000",
      unstake: "150000",
      deposit: "100000",
      withdraw: "100000",
      transfer: "65000",
    };
    return gasLimits[type] || "200000";
  }

  public async submitTransaction(
    txId: string,
    signedHash: string
  ): Promise<TransactionStatus> {
    const txRequest = this.pendingTransactions.get(txId);
    if (!txRequest) {
      throw new Error(`Transaction ${txId} not found`);
    }

    this.transactionStatuses.set(txId, {
      id: txId,
      status: "submitted",
      hash: signedHash,
      timestamp: Date.now(),
    });

    this.emit("transactionSubmitted", { 
      txId, 
      hash: signedHash, 
      txRequest,
      chainTransaction: this.buildChainTransactionRecord(txId, txRequest, signedHash)
    });

    this.startTransactionMonitoring(txId, signedHash, txRequest.chainId);
    
    return this.transactionStatuses.get(txId)!;
  }

  private startTransactionMonitoring(txId: string, hash: string, chainId: number): void {
    const checkInterval = 5000;
    const maxChecks = 60;
    let checkCount = 0;

    const interval = setInterval(() => {
      checkCount++;
      
      this.emit("transactionMonitorCheck", { 
        txId, 
        hash, 
        chainId,
        checkNumber: checkCount,
        maxChecks
      });

      if (checkCount >= maxChecks) {
        this.stopTransactionMonitoring(txId);
        this.emit("transactionMonitorTimeout", { txId, hash });
      }
    }, checkInterval);

    this.monitoringIntervals.set(txId, interval);
  }

  private stopTransactionMonitoring(txId: string): void {
    const interval = this.monitoringIntervals.get(txId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(txId);
    }
  }

  public buildChainTransactionRecord(
    txId: string,
    txRequest: TransactionRequest,
    hash?: string
  ): Partial<ChainTransaction> {
    return {
      id: txId,
      chainId: txRequest.chainId,
      hash: hash || "",
      type: txRequest.type,
      status: "pending",
      fromAddress: "",
      toAddress: this.getRouterAddress(txRequest.chainId, txRequest.type),
      value: txRequest.amount,
      gasUsed: "0",
      timestamp: Date.now(),
      agentId: txRequest.proposedBy,
    };
  }

  public async confirmTransaction(
    txId: string,
    blockNumber: number,
    gasUsed: string
  ): Promise<ExecutionResult> {
    const status = this.transactionStatuses.get(txId);
    const txRequest = this.pendingTransactions.get(txId);
    
    if (!status) {
      return { success: false, transactionId: txId, error: "Not found", creditAdjustment: -10 };
    }

    this.stopTransactionMonitoring(txId);

    this.transactionStatuses.set(txId, {
      ...status,
      status: "confirmed",
      blockNumber,
      gasUsed,
      timestamp: Date.now(),
    });

    const result: ExecutionResult = {
      success: true,
      transactionId: txId,
      hash: status.hash,
      creditAdjustment: 20,
    };

    this.emit("transactionConfirmed", { 
      txId, 
      blockNumber, 
      gasUsed,
      hash: status.hash,
      agentId: txRequest?.proposedBy,
      result,
      chainTransaction: txRequest ? {
        ...this.buildChainTransactionRecord(txId, txRequest, status.hash),
        status: "confirmed",
        blockNumber,
        gasUsed,
      } : undefined,
    });

    return result;
  }

  public async failTransaction(txId: string, error: string): Promise<ExecutionResult> {
    const status = this.transactionStatuses.get(txId);
    const txRequest = this.pendingTransactions.get(txId);
    
    this.stopTransactionMonitoring(txId);
    
    this.transactionStatuses.set(txId, {
      id: txId,
      status: "failed",
      hash: status?.hash,
      error,
      timestamp: Date.now(),
    });

    const result: ExecutionResult = {
      success: false,
      transactionId: txId,
      error,
      creditAdjustment: -15,
    };

    this.emit("transactionFailed", { 
      txId, 
      error,
      hash: status?.hash,
      agentId: txRequest?.proposedBy,
      result,
      chainTransaction: txRequest ? {
        ...this.buildChainTransactionRecord(txId, txRequest, status?.hash),
        status: "failed",
      } : undefined,
    });

    return result;
  }

  public getTransactionStatus(txId: string): TransactionStatus | undefined {
    return this.transactionStatuses.get(txId);
  }

  public getPendingTransactions(): TransactionRequest[] {
    return Array.from(this.pendingTransactions.values()).filter(
      tx => this.transactionStatuses.get(tx.id)?.status === "pending"
    );
  }

  public getAllTransactions(): TransactionStatus[] {
    return Array.from(this.transactionStatuses.values());
  }
}

export const transactionManager = new TransactionManager();
