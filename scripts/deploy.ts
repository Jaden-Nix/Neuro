import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying to network: ${network.name} (chainId: ${network.chainId})`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
  
  console.log("\nDeploying AgentNFT...");
  const AgentNFT = await ethers.getContractFactory("AgentNFT");
  const agentNFT = await AgentNFT.deploy();
  await agentNFT.waitForDeployment();
  const agentNFTAddress = await agentNFT.getAddress();
  console.log(`AgentNFT deployed to: ${agentNFTAddress}`);
  
  console.log("\nDeploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddress = await agentRegistry.getAddress();
  console.log(`AgentRegistry deployed to: ${agentRegistryAddress}`);
  
  console.log("\nDeploying MemoryVault...");
  const MemoryVault = await ethers.getContractFactory("MemoryVault");
  const memoryVault = await MemoryVault.deploy();
  await memoryVault.waitForDeployment();
  const memoryVaultAddress = await memoryVault.getAddress();
  console.log(`MemoryVault deployed to: ${memoryVaultAddress}`);
  
  const networkName = network.chainId === BigInt(11155111) ? "sepolia" : 
                      network.chainId === BigInt(84532) ? "baseSepolia" : 
                      network.name;
  
  const deploymentInfo = {
    network: networkName,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      AgentNFT: {
        address: agentNFTAddress,
        abi: "artifacts/contracts/AgentNFT.sol/AgentNFT.json",
      },
      AgentRegistry: {
        address: agentRegistryAddress,
        abi: "artifacts/contracts/AgentRegistry.sol/AgentRegistry.json",
      },
      MemoryVault: {
        address: memoryVaultAddress,
        abi: "artifacts/contracts/MemoryVault.sol/MemoryVault.json",
      },
    },
  };
  
  const deploymentPath = `deployments/deployment-${networkName}.json`;
  
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to ${deploymentPath}`);
  
  console.log("\n=== Deployment Summary ===");
  console.log(`Network: ${networkName} (${network.chainId})`);
  console.log(`AgentNFT: ${agentNFTAddress}`);
  console.log(`AgentRegistry: ${agentRegistryAddress}`);
  console.log(`MemoryVault: ${memoryVaultAddress}`);
  
  console.log("\n=== Environment Variables to Set ===");
  console.log(`VITE_AGENT_NFT_ADDRESS_${networkName.toUpperCase()}=${agentNFTAddress}`);
  console.log(`VITE_AGENT_REGISTRY_ADDRESS_${networkName.toUpperCase()}=${agentRegistryAddress}`);
  console.log(`VITE_MEMORY_VAULT_ADDRESS_${networkName.toUpperCase()}=${memoryVaultAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
