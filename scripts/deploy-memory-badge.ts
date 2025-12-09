import * as fs from "fs";
import * as path from "path";
import { createPublicClient, createWalletClient, http, type Hex, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

interface ContractArtifact {
  contractName: string;
  abi: any[];
  bytecode: Hex;
}

async function loadArtifact(contractName: string): Promise<ContractArtifact> {
  const artifactPath = path.join(process.cwd(), "artifacts", `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}. Run 'npx tsx scripts/compile.ts' first.`);
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
  
  return receipt.contractAddress;
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: DEPLOYER_PRIVATE_KEY environment variable is required");
    process.exit(1);
  }
  
  const rpcUrl = process.env.SEPOLIA_RPC_URL || "https://gateway.tenderly.co/public/sepolia";
  
  console.log(`\n=== Deploying MemoryVault & NeuronBadge to Sepolia ===`);
  console.log(`RPC URL: ${rpcUrl}\n`);
  
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const account = privateKeyToAccount(formattedKey as Hex);
  console.log(`Deployer address: ${account.address}`);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} ETH`);
  
  if (balance === BigInt(0)) {
    console.error("\nERROR: No ETH balance. Get testnet ETH from:");
    console.error("  - https://sepoliafaucet.com/");
    console.error("  - https://www.alchemy.com/faucets/ethereum-sepolia");
    process.exit(1);
  }

  console.log("\nLoading contract artifacts...");
  const memoryVault = await loadArtifact("MemoryVault");
  const neuronBadge = await loadArtifact("NeuronBadge");
  
  const memoryVaultAddress = await deployContract(walletClient, publicClient, memoryVault);
  const neuronBadgeAddress = await deployContract(walletClient, publicClient, neuronBadge);
  
  const existingDeployment = JSON.parse(fs.readFileSync("deployment-sepolia.json", "utf8"));
  
  const updatedDeployment = {
    ...existingDeployment,
    deployedAt: new Date().toISOString(),
    contracts: {
      ...existingDeployment.contracts,
      MemoryVault: memoryVaultAddress,
      NeuronBadge: neuronBadgeAddress,
    },
  };
  
  fs.writeFileSync("deployment-sepolia.json", JSON.stringify(updatedDeployment, null, 2));
  
  console.log("\n=== Deployment Complete ===");
  console.log(`MemoryVault: ${memoryVaultAddress}`);
  console.log(`NeuronBadge: ${neuronBadgeAddress}`);
  console.log(`\nUpdated deployment-sepolia.json`);
  
  console.log("\n=== Environment Variables to Set ===");
  console.log(`MEMORY_VAULT_ADDRESS_SEPOLIA=${memoryVaultAddress}`);
  console.log(`NEURON_BADGE_ADDRESS_SEPOLIA=${neuronBadgeAddress}`);
  console.log(`VITE_MEMORY_VAULT_ADDRESS_SEPOLIA=${memoryVaultAddress}`);
  console.log(`VITE_NEURON_BADGE_ADDRESS_SEPOLIA=${neuronBadgeAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
