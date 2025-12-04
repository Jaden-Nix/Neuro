import * as fs from "fs";
import * as path from "path";
import { createPublicClient, createWalletClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

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
  console.log(`\nDeploying ${artifact.contractName}...`);
  
  const hash = await walletClient.deployContract({
    abi: artifact.abi as any,
    bytecode: artifact.bytecode as Hex,
  } as any);
  
  console.log(`  Transaction hash: ${hash}`);
  console.log(`  Waiting for confirmation...`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    throw new Error("Contract deployment failed - no address returned");
  }
  
  console.log(`  Deployed to: ${receipt.contractAddress}`);
  console.log(`  Gas used: ${receipt.gasUsed}`);
  console.log(`  Block: ${receipt.blockNumber}`);
  
  return receipt.contractAddress;
}

async function main() {
  console.log("\n========================================");
  console.log("  NeuronBadge Deployment to Base Sepolia");
  console.log("========================================\n");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY environment variable is required");
    console.log("\nTo deploy contracts, you need to:");
    console.log("1. Create a wallet for testnet deployment");
    console.log("2. Get testnet ETH from: https://faucet.quicknode.com/base/sepolia");
    console.log("3. Set DEPLOYER_PRIVATE_KEY as a secret in Replit");
    process.exit(1);
  }
  
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  
  console.log(`Network: Base Sepolia (chainId: ${baseSepolia.id})`);
  console.log(`RPC URL: ${rpcUrl}`);
  
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as Hex);
  console.log(`Deployer address: ${account.address}`);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  
  const balance = await publicClient.getBalance({ address: account.address });
  const balanceEth = Number(balance) / 1e18;
  console.log(`Balance: ${balanceEth.toFixed(6)} ETH`);
  
  if (balance === BigInt(0)) {
    console.error("\nERROR: No ETH balance!");
    console.log("Get testnet ETH from: https://faucet.quicknode.com/base/sepolia");
    process.exit(1);
  }
  
  if (balanceEth < 0.001) {
    console.warn("\nWARNING: Low balance. Deployment may fail.");
    console.log("Get more testnet ETH from: https://faucet.quicknode.com/base/sepolia");
  }

  const neuronBadge = await loadArtifact("NeuronBadge");
  const contractAddress = await deployContract(walletClient, publicClient, neuronBadge);

  console.log("\n========================================");
  console.log("  DEPLOYMENT SUCCESSFUL!");
  console.log("========================================");
  console.log(`\nNeuronBadge Contract: ${contractAddress}`);
  console.log(`\nBaseScan: https://sepolia.basescan.org/address/${contractAddress}`);
  
  console.log("\n=== NEXT STEPS ===");
  console.log("Set these environment variables:");
  console.log(`  NEURON_BADGE_ADDRESS=${contractAddress}`);
  console.log(`  BLOCKCHAIN_ENABLED=true`);
  console.log("\nThen restart the application to enable live minting!");
  
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const deploymentInfo = {
    network: "base-sepolia",
    chainId: baseSepolia.id,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: {
      NeuronBadge: contractAddress,
    },
  };
  
  const deploymentPath = path.join(deploymentsDir, "neuron-badge-base-sepolia.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment saved to: ${deploymentPath}`);
}

main().catch((error) => {
  console.error("\nDeployment failed:", error.message || error);
  process.exit(1);
});
