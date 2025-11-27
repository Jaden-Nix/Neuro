import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, base, fraxtal } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'NeuroNet Governor',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mainnet, base, fraxtal],
  ssr: false,
});

export const solanaConfig = {
  network: 'mainnet-beta' as const,
  supportedWallets: ['phantom', 'solflare', 'backpack', 'glow'] as const,
  rpcEndpoint: import.meta.env.VITE_HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com',
};

export const KNOWN_SOLANA_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
} as const;
