#!/bin/bash
# Deploy to Sepolia using Infura RPC (rate limit friendly)
npx tsx -e "
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as fs from 'fs';

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  console.error('ERROR: DEPLOYER_PRIVATE_KEY not set');
  process.exit(1);
}

const formattedKey = privateKey.startsWith('0x') ? privateKey : \`0x\${privateKey}\`;
const account = privateKeyToAccount(formattedKey);

console.log('Deployer address:', account.address);
console.log('Checking balance...');

const rpcUrl = 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

const balance = await publicClient.getBalance({ address: account.address });
console.log('Balance:', balance.toString(), 'wei', '(' + (Number(balance) / 1e18).toFixed(4), 'ETH)');

if (balance === 0n) {
  console.error('ERROR: No ETH balance. Get testnet ETH from https://sepoliafaucet.com/');
  process.exit(1);
}

console.log('\nDeployment ready. Contracts will deploy when run.');
" 2>&1
