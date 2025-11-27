import { createWalletClient, createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

function compileContract(contractName: string): { abi: any; bytecode: string } {
  const contractPath = path.join(process.cwd(), 'contracts', `${contractName}.sol`);
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [`${contractName}.sol`]: { content: source },
    },
    settings: {
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
      optimizer: { enabled: true, runs: 200 },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compilation errors:', errors);
      throw new Error('Compilation failed');
    }
  }

  const contract = output.contracts[`${contractName}.sol`][contractName];
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

async function deployContract(
  walletClient: any,
  publicClient: any,
  contractName: string,
  compiled: { abi: any; bytecode: string }
): Promise<string> {
  console.log(`\nDeploying ${contractName}...`);

  const hash = await walletClient.deployContract({
    abi: compiled.abi,
    bytecode: compiled.bytecode as `0x${string}`,
  });

  console.log(`  Transaction hash: ${hash}`);
  console.log(`  Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const contractAddress = receipt.contractAddress;

  console.log(`  ${contractName} deployed at: ${contractAddress}`);
  console.log(`  Gas used: ${receipt.gasUsed}`);
  console.log(`  Block: ${receipt.blockNumber}`);

  return contractAddress!;
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    console.error('ERROR: DEPLOYER_PRIVATE_KEY environment variable not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  console.log('========================================');
  console.log('NEURONET SEPOLIA DEPLOYMENT');
  console.log('========================================');
  console.log(`Network: Sepolia Testnet (Chain ID: 11155111)`);
  console.log(`Deployer: ${account.address}`);
  console.log('');

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} ETH`);

  if (balance === 0n) {
    console.error('\nERROR: Wallet has no Sepolia ETH!');
    process.exit(1);
  }

  console.log('\nCompiling contracts...');

  const contracts = ['NeuroNetRegistry', 'NeuroNetStorage', 'NeuroNetHeartbeat'];
  const deployedAddresses: Record<string, string> = {};

  for (const contractName of contracts) {
    try {
      const compiled = compileContract(contractName);
      console.log(`  ${contractName}: Compiled successfully`);

      const address = await deployContract(walletClient, publicClient, contractName, compiled);
      deployedAddresses[contractName] = address;
    } catch (error) {
      console.error(`  Failed to deploy ${contractName}:`, error);
      throw error;
    }
  }

  console.log('\n========================================');
  console.log('DEPLOYMENT COMPLETE!');
  console.log('========================================');
  console.log('\nDeployed Contract Addresses (Sepolia):');
  for (const [name, address] of Object.entries(deployedAddresses)) {
    console.log(`  ${name}: ${address}`);
    console.log(`    Explorer: https://sepolia.etherscan.io/address/${address}`);
  }

  const deploymentRecord = {
    network: 'sepolia',
    chainId: 11155111,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: deployedAddresses,
  };

  fs.writeFileSync(
    'deployment-sepolia.json',
    JSON.stringify(deploymentRecord, null, 2)
  );

  console.log('\nDeployment record saved to: deployment-sepolia.json');
  console.log('\nAdd these addresses to your hackathon submission!');
}

main().catch(console.error);
