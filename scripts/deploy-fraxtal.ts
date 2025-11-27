import { createWalletClient, createPublicClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

const fraxtalTestnet = defineChain({
  id: 2522,
  name: 'Fraxtal Testnet',
  nativeCurrency: { name: 'Frax Ether', symbol: 'frxETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.frax.com'] },
  },
  blockExplorers: {
    default: { name: 'Fraxscan Testnet', url: 'https://holesky.fraxscan.com' },
  },
  testnet: true,
});

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
    console.log('\nTo deploy, set the DEPLOYER_PRIVATE_KEY secret.');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  console.log('========================================');
  console.log('NEURONET FRAXTAL TESTNET DEPLOYMENT');
  console.log('========================================');
  console.log(`Network: Fraxtal Testnet (Chain ID: 2522)`);
  console.log(`Deployer: ${account.address}`);
  console.log('');

  const publicClient = createPublicClient({
    chain: fraxtalTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: fraxtalTestnet,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${Number(balance) / 1e18} frxETH`);

  if (balance === 0n) {
    console.error('\nERROR: Wallet has no testnet frxETH!');
    console.log('Get testnet frxETH from Fraxtal faucet');
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
  console.log('\nDeployed Contract Addresses (Fraxtal Testnet):');
  for (const [name, address] of Object.entries(deployedAddresses)) {
    console.log(`  ${name}: ${address}`);
    console.log(`    Explorer: https://holesky.fraxscan.com/address/${address}`);
  }

  const deploymentRecord = {
    network: 'fraxtal-testnet',
    chainId: 2522,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    contracts: deployedAddresses,
  };

  fs.writeFileSync(
    'deployment-fraxtal-testnet.json',
    JSON.stringify(deploymentRecord, null, 2)
  );

  console.log('\nDeployment record saved to: deployment-fraxtal-testnet.json');
  console.log('\nAdd these to your hackathon submission!');
}

main().catch(console.error);
