import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, base, fraxtal } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'NeuroNet Governor',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [mainnet, base, fraxtal],
  ssr: false,
});
