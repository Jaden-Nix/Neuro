import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`\n========================================`);
  console.log(`  NeuronBadge Deployment`);
  console.log(`========================================`);
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (parseFloat(ethers.formatEther(balance)) < 0.01) {
    console.error("\nError: Insufficient balance. Need at least 0.01 ETH for deployment.");
    console.log("\nGet testnet ETH from:");
    console.log("  - Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    console.log("  - Or bridge from Sepolia: https://bridge.base.org/");
    process.exit(1);
  }
  
  console.log("\nDeploying NeuronBadge contract...");
  const NeuronBadge = await ethers.getContractFactory("NeuronBadge");
  const neuronBadge = await NeuronBadge.deploy();
  await neuronBadge.waitForDeployment();
  const neuronBadgeAddress = await neuronBadge.getAddress();
  console.log(`NeuronBadge deployed to: ${neuronBadgeAddress}`);
  
  const networkName = network.chainId === BigInt(11155111) ? "sepolia" : 
                      network.chainId === BigInt(84532) ? "baseSepolia" : 
                      network.name;
  
  const deploymentInfo = {
    network: networkName,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      NeuronBadge: {
        address: neuronBadgeAddress,
        abi: "artifacts/contracts/NeuronBadge.sol/NeuronBadge.json",
      },
    },
  };
  
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  const deploymentPath = `deployments/neuron-badge-${networkName}.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);
  
  console.log("\n========================================");
  console.log("  Deployment Complete!");
  console.log("========================================");
  console.log(`\nNeuronBadge: ${neuronBadgeAddress}`);
  
  console.log("\n=== Environment Variables to Set ===");
  console.log(`NEURON_BADGE_ADDRESS=${neuronBadgeAddress}`);
  console.log(`BASE_SEPOLIA_RPC_URL=https://sepolia.base.org`);
  console.log(`BLOCKCHAIN_ENABLED=true`);
  
  console.log("\n=== Next Steps ===");
  console.log("1. Copy the NEURON_BADGE_ADDRESS above");
  console.log("2. Set it as an environment variable in Replit Secrets");
  console.log("3. Set BLOCKCHAIN_ENABLED=true to enable live minting");
  console.log("4. Agent evolutions will now mint real soulbound NFTs!");
  
  console.log("\n=== Verify on BaseScan (optional) ===");
  console.log(`npx hardhat verify --network baseSepolia ${neuronBadgeAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
