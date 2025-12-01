import * as fs from "fs";
import * as path from "path";
import { createPublicClient, createWalletClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, baseSepolia } from "viem/chains";

interface ContractArtifact {
  contractName: string;
  abi: any[];
  bytecode: Hex;
}

async function loadArtifact(contractName: string): Promise<ContractArtifact> {
  const artifactPath = path.join(process.cwd(), "artifacts", `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'tsx scripts/compile.ts' first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

async function deployContract(
  walletClient: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  artifact: ContractArtifact
): Promise<Address> {
  console.log(`Deploying ${artifact.contractName}...`);
  
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as Hex,
  });
  
  console.log(`  Transaction hash: ${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    throw new Error("Contract deployment failed - no address returned");
  }
  
  console.log(`  Deployed to: ${receipt.contractAddress}`);
  console.log(`  Gas used: ${receipt.gasUsed}`);
  
  return receipt.contractAddress;
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY environment variable is required");
    console.log("\nTo deploy contracts, you need to:");
    console.log("1. Create a wallet for testnet deployment");
    console.log("2. Get testnet ETH from a faucet:");
    console.log("   - Sepolia: https://sepoliafaucet.com/ or https://www.alchemy.com/faucets/ethereum-sepolia");
    console.log("   - Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    console.log("3. Set DEPLOYER_PRIVATE_KEY as a secret in Replit");
    process.exit(1);
  }
  
  const network = process.argv[2] || "sepolia";
  
  const chain = network === "baseSepolia" ? baseSepolia : sepolia;
  const rpcUrl = network === "baseSepolia" 
    ? (process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org")
    : (process.env.SEPOLIA_RPC_URL || "https://gateway.tenderly.co/public/sepolia");
  
  console.log(`\nDeploying to ${chain.name} (chainId: ${chain.id})`);
  console.log(`RPC URL: ${rpcUrl}\n`);
  
  // Ensure private key has 0x prefix
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as Hex);
  console.log(`Deployer address: ${account.address}`);
  
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} ETH\n`);
  
  if (balance === BigInt(0)) {
    console.error("ERROR: No ETH balance. Get testnet ETH from a faucet first.");
    process.exit(1);
  }
  
  const agentNFT = await loadArtifact("AgentNFT");
  const agentRegistry = await loadArtifact("AgentRegistry");
  const memoryVault = await loadArtifact("MemoryVault");
  
  const agentNFTAddress = await deployContract(walletClient, publicClient, agentNFT);
  const agentRegistryAddress = await deployContract(walletClient, publicClient, agentRegistry);
  const memoryVaultAddress = await deployContract(walletClient, publicClient, memoryVault);
  
  const deploymentInfo = {
    network: chain.name.toLowerCase().replace(" ", ""),
    chainId: chain.id,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      AgentNFT: agentNFTAddress,
      AgentRegistry: agentRegistryAddress,
      MemoryVault: memoryVaultAddress,
    },
  };
  
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const networkName = network === "baseSepolia" ? "base-sepolia" : "sepolia";
  const deploymentPath = path.join(deploymentsDir, `deployment-${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n=== Deployment Summary ===");
  console.log(`Network: ${chain.name} (${chain.id})`);
  console.log(`AgentNFT: ${agentNFTAddress}`);
  console.log(`AgentRegistry: ${agentRegistryAddress}`);
  console.log(`MemoryVault: ${memoryVaultAddress}`);
  console.log(`\nDeployment saved to: ${deploymentPath}`);
  
  console.log("\n=== Environment Variables to Set ===");
  const envVarPrefix = network === "baseSepolia" ? "BASE_SEPOLIA" : "SEPOLIA";
  console.log(`VITE_AGENT_NFT_ADDRESS_${envVarPrefix}=${agentNFTAddress}`);
  console.log(`VITE_AGENT_REGISTRY_ADDRESS_${envVarPrefix}=${agentRegistryAddress}`);
  console.log(`VITE_MEMORY_VAULT_ADDRESS_${envVarPrefix}=${memoryVaultAddress}`);
  console.log(`AGENT_NFT_ADDRESS_${envVarPrefix}=${agentNFTAddress}`);
  console.log(`AGENT_REGISTRY_ADDRESS_${envVarPrefix}=${agentRegistryAddress}`);
  console.log(`MEMORY_VAULT_ADDRESS_${envVarPrefix}=${memoryVaultAddress}`);
  
  const envContent = `# Auto-generated from deployment on ${new Date().toISOString()}
# Network: ${chain.name} (${chain.id})

# Frontend (Vite) - exposed to client
VITE_AGENT_NFT_ADDRESS_${envVarPrefix}=${agentNFTAddress}
VITE_AGENT_REGISTRY_ADDRESS_${envVarPrefix}=${agentRegistryAddress}
VITE_MEMORY_VAULT_ADDRESS_${envVarPrefix}=${memoryVaultAddress}

# Backend - server-side only
AGENT_NFT_ADDRESS_${envVarPrefix}=${agentNFTAddress}
AGENT_REGISTRY_ADDRESS_${envVarPrefix}=${agentRegistryAddress}
MEMORY_VAULT_ADDRESS_${envVarPrefix}=${memoryVaultAddress}
`;
  
  const envPath = path.join(deploymentsDir, `.env.${networkName}`);
  fs.writeFileSync(envPath, envContent);
  console.log(`\nEnvironment file saved to: ${envPath}`);
  console.log("Copy these to your .env or secrets to enable blockchain integration.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
