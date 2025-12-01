import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseAbi,
  parseEther,
  formatEther,
  decodeEventLog,
  type Address,
  type Hash,
  type TransactionReceipt,
  getAddress,
  keccak256,
  toHex
} from "viem";
import { sepolia, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const AGENT_NFT_ABI = parseAbi([
  "function mintAgent(string memory templateId, string memory agentType, string memory tokenURI_) public payable returns (uint256)",
  "function setAvailableForRent(uint256 tokenId, bool available, uint256 pricePerDay) external",
  "function getRentalPrice(uint256 tokenId, uint256 durationDays) public view returns (uint256)",
  "function rentAgent(uint256 tokenId, uint256 durationDays) external payable",
  "function endRental(uint256 tokenId) external",
  "function isRentalActive(uint256 tokenId) public view returns (bool)",
  "function availableForRent(uint256 tokenId) public view returns (bool)",
  "function rentalPricePerDay() public view returns (uint256)",
  "function getCurrentOperator(uint256 tokenId) public view returns (address)",
  "function getAgentMetadata(uint256 tokenId) public view returns (tuple(string templateId, string agentType, uint256 mintedAt, address originalMinter, bool isRented, address currentRenter, uint256 rentalExpiry))",
  "function getTokensByOwner(address owner) public view returns (uint256[])",
  "function getTokensByTemplate(string memory templateId) public view returns (uint256[])",
  "function totalMinted() public view returns (uint256)",
  "function mintPrice() public view returns (uint256)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function tokenURI(uint256 tokenId) public view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string templateId, string agentType, uint256 timestamp)",
  "event AgentRented(uint256 indexed tokenId, address indexed renter, uint256 expiry, uint256 timestamp)",
  "event RentalEnded(uint256 indexed tokenId, address indexed previousRenter, uint256 timestamp)",
]);

const AGENT_REGISTRY_ABI = parseAbi([
  "function registerAgent(string memory name, string memory agentType, string memory description, string memory atpLink) external returns (bytes32)",
  "function updateAgentStatus(bytes32 agentId, uint8 newStatus) external",
  "function adjustCredits(bytes32 agentId, int256 amount, string memory reason) external",
  "function getAgent(bytes32 agentId) external view returns (tuple(bytes32 id, uint8 agentType, uint8 status, string name, string description, uint256 version, uint256 creditScore, uint256 successfulActions, uint256 failedActions, uint256 spawnedAt, uint256 lastActiveAt, address owner, bytes32 spawnedFrom, string deprecationReason, string atpLink, bool isTokenized))",
  "function getAllAgentIds() external view returns (bytes32[])",
  "event AgentRegistered(bytes32 indexed agentId, uint8 agentType, string name, address indexed owner, uint256 timestamp)",
]);

interface ChainConfig {
  chain: typeof sepolia | typeof baseSepolia;
  rpcUrl: string;
  agentNFTAddress?: Address;
  agentRegistryAddress?: Address;
}

interface MintResult {
  txHash: Hash;
  tokenId: bigint;
  receipt: TransactionReceipt;
}

interface RentResult {
  txHash: Hash;
  receipt: TransactionReceipt;
}

export class ContractService {
  private configs: Map<number, ChainConfig>;
  private publicClients: Map<number, ReturnType<typeof createPublicClient>>;
  private walletClients: Map<number, ReturnType<typeof createWalletClient>>;
  private deployerAccount: ReturnType<typeof privateKeyToAccount> | null = null;

  constructor() {
    this.configs = new Map();
    this.publicClients = new Map();
    this.walletClients = new Map();

    this.configs.set(sepolia.id, {
      chain: sepolia,
      rpcUrl: process.env.SEPOLIA_RPC_URL || "https://gateway.tenderly.co/public/sepolia",
      agentNFTAddress: process.env.AGENT_NFT_ADDRESS_SEPOLIA as Address | undefined,
      agentRegistryAddress: process.env.AGENT_REGISTRY_ADDRESS_SEPOLIA as Address | undefined,
    });

    this.configs.set(baseSepolia.id, {
      chain: baseSepolia,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      agentNFTAddress: process.env.AGENT_NFT_ADDRESS_BASE_SEPOLIA as Address | undefined,
      agentRegistryAddress: process.env.AGENT_REGISTRY_ADDRESS_BASE_SEPOLIA as Address | undefined,
    });

    for (const [chainId, config] of this.configs) {
      this.publicClients.set(
        chainId,
        createPublicClient({
          chain: config.chain,
          transport: http(config.rpcUrl),
        })
      );
    }

    if (process.env.DEPLOYER_PRIVATE_KEY) {
      try {
        this.deployerAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
        
        for (const [chainId, config] of this.configs) {
          this.walletClients.set(
            chainId,
            createWalletClient({
              account: this.deployerAccount,
              chain: config.chain,
              transport: http(config.rpcUrl),
            })
          );
        }
        console.log("[ContractService] Wallet clients initialized with deployer account");
      } catch (error) {
        console.warn("[ContractService] Failed to initialize wallet clients:", error);
      }
    } else {
      console.warn("[ContractService] No DEPLOYER_PRIVATE_KEY set - write operations will fail");
    }
  }

  private getConfig(chainId: number): ChainConfig {
    const config = this.configs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    return config;
  }

  private getPublicClient(chainId: number) {
    const client = this.publicClients.get(chainId);
    if (!client) {
      throw new Error(`No public client for chain: ${chainId}`);
    }
    return client;
  }

  private getWalletClient(chainId: number) {
    const client = this.walletClients.get(chainId);
    if (!client) {
      throw new Error(`No wallet client for chain: ${chainId}. Ensure DEPLOYER_PRIVATE_KEY is set.`);
    }
    return client;
  }

  async getMintPrice(chainId: number = sepolia.id): Promise<bigint> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const price = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "mintPrice",
    });

    return price as bigint;
  }

  async getTotalMinted(chainId: number = sepolia.id): Promise<bigint> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const total = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "totalMinted",
    });

    return total as bigint;
  }

  async getTokensByOwner(ownerAddress: Address, chainId: number = sepolia.id): Promise<bigint[]> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const tokens = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "getTokensByOwner",
      args: [ownerAddress],
    });

    return tokens as bigint[];
  }

  async getAgentMetadata(tokenId: bigint, chainId: number = sepolia.id) {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const metadata = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "getAgentMetadata",
      args: [tokenId],
    });

    return metadata;
  }

  async isRentalActive(tokenId: bigint, chainId: number = sepolia.id): Promise<boolean> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const active = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "isRentalActive",
      args: [tokenId],
    });

    return active as boolean;
  }

  /**
   * ADMIN ONLY: Mints an agent using the deployer wallet.
   * For user-initiated mints, use frontend wagmi hooks (useAgentNFT.mintAgent)
   * which use the user's connected wallet as msg.sender.
   */
  async mintAgentFromBackend(
    templateId: string,
    agentType: string,
    tokenURI: string,
    chainId: number = sepolia.id
  ): Promise<MintResult> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const walletClient = this.getWalletClient(chainId);
    const publicClient = this.getPublicClient(chainId);
    
    const mintPrice = await this.getMintPrice(chainId);

    const hash = await walletClient.writeContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "mintAgent",
      args: [templateId, agentType, tokenURI],
      value: mintPrice,
      chain: config.chain,
    });

    console.log(`[ContractService] Mint transaction submitted: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[ContractService] Mint transaction confirmed in block ${receipt.blockNumber}`);

    const logs = receipt.logs;
    let tokenId = BigInt(0);
    
    const TRANSFER_EVENT_SIG = keccak256(toHex("Transfer(address,address,uint256)"));
    
    for (const log of logs) {
      try {
        if (log.topics[0] === TRANSFER_EVENT_SIG && log.address.toLowerCase() === config.agentNFTAddress!.toLowerCase()) {
          const decoded = decodeEventLog({
            abi: AGENT_NFT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "Transfer" && decoded.args) {
            tokenId = (decoded.args as { tokenId: bigint }).tokenId;
            break;
          }
        }
      } catch {
        continue;
      }
    }

    console.log(`[ContractService] Minted token ID: ${tokenId}`);

    return {
      txHash: hash,
      tokenId,
      receipt,
    };
  }

  async getRentalPrice(tokenId: bigint, durationDays: number, chainId: number = sepolia.id): Promise<bigint> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const price = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "getRentalPrice",
      args: [tokenId, BigInt(durationDays)],
    });

    return price as bigint;
  }

  async isAvailableForRent(tokenId: bigint, chainId: number = sepolia.id): Promise<boolean> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const client = this.getPublicClient(chainId);
    const available = await client.readContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "availableForRent",
      args: [tokenId],
    });

    return available as boolean;
  }

  /**
   * ADMIN ONLY: Rents an agent using the deployer wallet.
   * For user-initiated rentals, use frontend wagmi hooks (useAgentNFT.rentAgent)
   * which use the user's connected wallet as msg.sender.
   */
  async rentAgentFromBackend(
    tokenId: bigint,
    durationDays: number,
    chainId: number = sepolia.id
  ): Promise<RentResult> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const walletClient = this.getWalletClient(chainId);
    const publicClient = this.getPublicClient(chainId);
    
    const rentalPrice = await this.getRentalPrice(tokenId, durationDays, chainId);

    const hash = await walletClient.writeContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "rentAgent",
      args: [tokenId, BigInt(durationDays)],
      value: rentalPrice,
      chain: config.chain,
    });

    console.log(`[ContractService] Rent transaction submitted: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`[ContractService] Rent transaction confirmed in block ${receipt.blockNumber}`);

    return {
      txHash: hash,
      receipt,
    };
  }

  async endRentalFromBackend(
    tokenId: bigint,
    chainId: number = sepolia.id
  ): Promise<RentResult> {
    const config = this.getConfig(chainId);
    if (!config.agentNFTAddress) {
      throw new Error("AgentNFT contract not deployed on this chain");
    }

    const walletClient = this.getWalletClient(chainId);
    const publicClient = this.getPublicClient(chainId);

    const hash = await walletClient.writeContract({
      address: config.agentNFTAddress,
      abi: AGENT_NFT_ABI,
      functionName: "endRental",
      args: [tokenId],
      chain: config.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return {
      txHash: hash,
      receipt,
    };
  }

  getMintData(templateId: string, agentType: string, tokenURI: string) {
    return {
      functionName: "mintAgent" as const,
      args: [templateId, agentType, tokenURI] as const,
      abi: AGENT_NFT_ABI,
    };
  }

  getRentData(tokenId: bigint, renterAddress: Address, durationDays: number) {
    return {
      functionName: "rentAgent" as const,
      args: [tokenId, renterAddress, BigInt(durationDays)] as const,
      abi: AGENT_NFT_ABI,
    };
  }

  getContractAddresses(chainId: number = sepolia.id) {
    const config = this.getConfig(chainId);
    return {
      agentNFT: config.agentNFTAddress,
      agentRegistry: config.agentRegistryAddress,
    };
  }

  isContractDeployed(chainId: number = sepolia.id): boolean {
    const config = this.configs.get(chainId);
    return !!(config?.agentNFTAddress);
  }

  async getTransactionReceipt(txHash: Hash, chainId: number = sepolia.id) {
    const publicClient = this.getPublicClient(chainId);
    return await publicClient.getTransactionReceipt({ hash: txHash });
  }

  async waitForTransaction(txHash: Hash, chainId: number = sepolia.id) {
    const publicClient = this.getPublicClient(chainId);
    return await publicClient.waitForTransactionReceipt({ hash: txHash });
  }
}

export const contractService = new ContractService();
