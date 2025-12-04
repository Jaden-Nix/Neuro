import * as ccxt from 'ccxt';
import { EventEmitter } from 'events';
import type { 
  SupportedExchange, 
  LivePrice, 
  OHLCVBar, 
  TokenMetadata,
  TokenCategory 
} from '@shared/schema';
import { coinGeckoClient } from './CoinGeckoClient';

const FALLBACK_PRICES: Record<string, number> = {
  'BTC': 92000, 'ETH': 3180, 'SOL': 145, 'XRP': 2.35, 'BNB': 640,
  'ADA': 1.05, 'AVAX': 38, 'DOGE': 0.32, 'TRX': 0.26, 'DOT': 7.5,
  'LINK': 24, 'MATIC': 0.52, 'SHIB': 0.000024, 'LTC': 105, 'UNI': 14,
  'ATOM': 9.5, 'ETC': 28, 'XLM': 0.42, 'NEAR': 5.5, 'APT': 12,
  'ARB': 0.75, 'OP': 1.80, 'AAVE': 193, 'MKR': 1800, 'CRV': 0.55,
  'LDO': 1.0, 'SNX': 1.5, 'COMP': 45, 'INJ': 15, 'FIL': 3.5,
  'SUI': 2.0, 'SEI': 0.25, 'FTM': 0.45, 'IMX': 0.80, 'MANA': 0.30,
  'SAND': 0.35, 'AXS': 4.5, 'GALA': 0.025, 'APE': 0.80, 'PEPE': 0.000012,
  'WIF': 1.5, 'BONK': 0.000020, 'FLOKI': 0.00010, 'RENDER': 4.5,
  'FET': 1.2, 'TAO': 350, 'AGIX': 0.45, 'OCEAN': 0.50, 'ONDO': 0.75,
  'PENDLE': 3.0, 'ENA': 0.50, 'JUP': 0.55, 'RAY': 2.5, 'ORCA': 2.5,
  'GRT': 0.15, 'VET': 0.025, 'ALGO': 0.20, 'FLOW': 0.50, 'HBAR': 0.15,
  'ICP': 7.0, 'EGLD': 25, 'STX': 1.0, 'KAS': 0.08, 'RUNE': 3.5,
  'FTT': 1.5, 'CRO': 0.08, 'OKB': 30, 'LEO': 6.0, 'XMR': 150,
  'ZEC': 30, 'EOS': 0.50, 'KCS': 7.0, 'QNT': 70, 'THETA': 1.2,
  'BSV': 35, 'NEO': 8.0, 'KAVA': 0.35, 'MINA': 0.40, 'ZIL': 0.015,
  'IOTA': 0.20, 'CHZ': 0.05, 'ENJ': 0.12, 'BAT': 0.15, '1INCH': 0.25,
  'BLUR': 0.20, 'PYTH': 0.25, 'WLD': 1.5, 'STRK': 0.30, 'DYDX': 0.90,
  'GMX': 18, 'CAKE': 1.5, 'SUSHI': 0.60, 'RPL': 8.0, 'FXS': 2.0,
  'CVX': 2.0, 'OSMO': 0.35, 'AUDIO': 0.10, 'MASK': 1.8,
  'USDT': 1.0, 'USDC': 1.0, 'DAI': 1.0, 'FRAX': 1.0, 'FDUSD': 1.0,
};

const TOKEN_REGISTRY: Omit<TokenMetadata, 'addedAt' | 'updatedAt'>[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', category: 'layer1', chains: ['bitcoin'], coingeckoId: 'bitcoin', marketCapRank: 1, isActive: true },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', category: 'layer1', chains: ['ethereum'], coingeckoId: 'ethereum', marketCapRank: 2, isActive: true },
  { id: 'sol', symbol: 'SOL', name: 'Solana', category: 'layer1', chains: ['solana'], coingeckoId: 'solana', marketCapRank: 5, isActive: true },
  { id: 'xrp', symbol: 'XRP', name: 'Ripple', category: 'layer1', chains: ['xrp'], coingeckoId: 'ripple', marketCapRank: 3, isActive: true },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', category: 'layer1', chains: ['bsc'], coingeckoId: 'binancecoin', marketCapRank: 4, isActive: true },
  { id: 'ada', symbol: 'ADA', name: 'Cardano', category: 'layer1', chains: ['cardano'], coingeckoId: 'cardano', marketCapRank: 8, isActive: true },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', category: 'layer1', chains: ['avalanche'], coingeckoId: 'avalanche-2', marketCapRank: 12, isActive: true },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', category: 'meme', chains: ['dogecoin'], coingeckoId: 'dogecoin', marketCapRank: 7, isActive: true },
  { id: 'trx', symbol: 'TRX', name: 'TRON', category: 'layer1', chains: ['tron'], coingeckoId: 'tron', marketCapRank: 10, isActive: true },
  { id: 'dot', symbol: 'DOT', name: 'Polkadot', category: 'layer1', chains: ['polkadot'], coingeckoId: 'polkadot', marketCapRank: 14, isActive: true },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', category: 'oracle', chains: ['ethereum'], coingeckoId: 'chainlink', marketCapRank: 13, isActive: true },
  { id: 'matic', symbol: 'MATIC', name: 'Polygon', category: 'layer2', chains: ['polygon'], coingeckoId: 'matic-network', marketCapRank: 15, isActive: true },
  { id: 'shib', symbol: 'SHIB', name: 'Shiba Inu', category: 'meme', chains: ['ethereum'], coingeckoId: 'shiba-inu', marketCapRank: 11, isActive: true },
  { id: 'ltc', symbol: 'LTC', name: 'Litecoin', category: 'layer1', chains: ['litecoin'], coingeckoId: 'litecoin', marketCapRank: 20, isActive: true },
  { id: 'uni', symbol: 'UNI', name: 'Uniswap', category: 'defi', chains: ['ethereum'], coingeckoId: 'uniswap', marketCapRank: 22, isActive: true },
  { id: 'atom', symbol: 'ATOM', name: 'Cosmos', category: 'layer1', chains: ['cosmos'], coingeckoId: 'cosmos', marketCapRank: 25, isActive: true },
  { id: 'etc', symbol: 'ETC', name: 'Ethereum Classic', category: 'layer1', chains: ['ethereum-classic'], coingeckoId: 'ethereum-classic', marketCapRank: 26, isActive: true },
  { id: 'xlm', symbol: 'XLM', name: 'Stellar', category: 'layer1', chains: ['stellar'], coingeckoId: 'stellar', marketCapRank: 28, isActive: true },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', category: 'layer1', chains: ['near'], coingeckoId: 'near', marketCapRank: 19, isActive: true },
  { id: 'apt', symbol: 'APT', name: 'Aptos', category: 'layer1', chains: ['aptos'], coingeckoId: 'aptos', marketCapRank: 27, isActive: true },
  { id: 'arb', symbol: 'ARB', name: 'Arbitrum', category: 'layer2', chains: ['arbitrum'], coingeckoId: 'arbitrum', marketCapRank: 35, isActive: true },
  { id: 'op', symbol: 'OP', name: 'Optimism', category: 'layer2', chains: ['optimism'], coingeckoId: 'optimism', marketCapRank: 40, isActive: true },
  { id: 'aave', symbol: 'AAVE', name: 'Aave', category: 'defi', chains: ['ethereum'], coingeckoId: 'aave', marketCapRank: 30, isActive: true },
  { id: 'mkr', symbol: 'MKR', name: 'Maker', category: 'defi', chains: ['ethereum'], coingeckoId: 'maker', marketCapRank: 45, isActive: true },
  { id: 'crv', symbol: 'CRV', name: 'Curve', category: 'defi', chains: ['ethereum'], coingeckoId: 'curve-dao-token', marketCapRank: 80, isActive: true },
  { id: 'ldo', symbol: 'LDO', name: 'Lido DAO', category: 'defi', chains: ['ethereum'], coingeckoId: 'lido-dao', marketCapRank: 50, isActive: true },
  { id: 'snx', symbol: 'SNX', name: 'Synthetix', category: 'defi', chains: ['ethereum'], coingeckoId: 'havven', marketCapRank: 90, isActive: true },
  { id: 'comp', symbol: 'COMP', name: 'Compound', category: 'defi', chains: ['ethereum'], coingeckoId: 'compound-governance-token', marketCapRank: 95, isActive: true },
  { id: 'inj', symbol: 'INJ', name: 'Injective', category: 'defi', chains: ['injective'], coingeckoId: 'injective-protocol', marketCapRank: 38, isActive: true },
  { id: 'fil', symbol: 'FIL', name: 'Filecoin', category: 'storage', chains: ['filecoin'], coingeckoId: 'filecoin', marketCapRank: 32, isActive: true },
  { id: 'sui', symbol: 'SUI', name: 'Sui', category: 'layer1', chains: ['sui'], coingeckoId: 'sui', marketCapRank: 17, isActive: true },
  { id: 'sei', symbol: 'SEI', name: 'Sei', category: 'layer1', chains: ['sei'], coingeckoId: 'sei-network', marketCapRank: 55, isActive: true },
  { id: 'ftm', symbol: 'FTM', name: 'Fantom', category: 'layer1', chains: ['fantom'], coingeckoId: 'fantom', marketCapRank: 65, isActive: true },
  { id: 'imx', symbol: 'IMX', name: 'Immutable', category: 'gaming', chains: ['ethereum'], coingeckoId: 'immutable-x', marketCapRank: 42, isActive: true },
  { id: 'mana', symbol: 'MANA', name: 'Decentraland', category: 'gaming', chains: ['ethereum'], coingeckoId: 'decentraland', marketCapRank: 75, isActive: true },
  { id: 'sand', symbol: 'SAND', name: 'The Sandbox', category: 'gaming', chains: ['ethereum'], coingeckoId: 'the-sandbox', marketCapRank: 78, isActive: true },
  { id: 'axs', symbol: 'AXS', name: 'Axie Infinity', category: 'gaming', chains: ['ethereum'], coingeckoId: 'axie-infinity', marketCapRank: 85, isActive: true },
  { id: 'gala', symbol: 'GALA', name: 'Gala', category: 'gaming', chains: ['ethereum'], coingeckoId: 'gala', marketCapRank: 70, isActive: true },
  { id: 'ape', symbol: 'APE', name: 'ApeCoin', category: 'gaming', chains: ['ethereum'], coingeckoId: 'apecoin', marketCapRank: 88, isActive: true },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', category: 'meme', chains: ['ethereum'], coingeckoId: 'pepe', marketCapRank: 23, isActive: true },
  { id: 'wif', symbol: 'WIF', name: 'dogwifhat', category: 'meme', chains: ['solana'], coingeckoId: 'dogwifcoin', marketCapRank: 33, isActive: true },
  { id: 'bonk', symbol: 'BONK', name: 'Bonk', category: 'meme', chains: ['solana'], coingeckoId: 'bonk', marketCapRank: 48, isActive: true },
  { id: 'floki', symbol: 'FLOKI', name: 'Floki', category: 'meme', chains: ['ethereum', 'bsc'], coingeckoId: 'floki', marketCapRank: 52, isActive: true },
  { id: 'render', symbol: 'RENDER', name: 'Render Token', category: 'ai', chains: ['solana'], coingeckoId: 'render-token', marketCapRank: 29, isActive: true },
  { id: 'fet', symbol: 'FET', name: 'Fetch.ai', category: 'ai', chains: ['ethereum'], coingeckoId: 'fetch-ai', marketCapRank: 34, isActive: true },
  { id: 'tao', symbol: 'TAO', name: 'Bittensor', category: 'ai', chains: ['bittensor'], coingeckoId: 'bittensor', marketCapRank: 24, isActive: true },
  { id: 'agix', symbol: 'AGIX', name: 'SingularityNET', category: 'ai', chains: ['ethereum'], coingeckoId: 'singularitynet', marketCapRank: 100, isActive: true },
  { id: 'ocean', symbol: 'OCEAN', name: 'Ocean Protocol', category: 'ai', chains: ['ethereum'], coingeckoId: 'ocean-protocol', marketCapRank: 110, isActive: true },
  { id: 'ondo', symbol: 'ONDO', name: 'Ondo Finance', category: 'rwa', chains: ['ethereum'], coingeckoId: 'ondo-finance', marketCapRank: 53, isActive: true },
  { id: 'pendle', symbol: 'PENDLE', name: 'Pendle', category: 'defi', chains: ['ethereum'], coingeckoId: 'pendle', marketCapRank: 60, isActive: true },
  { id: 'ena', symbol: 'ENA', name: 'Ethena', category: 'defi', chains: ['ethereum'], coingeckoId: 'ethena', marketCapRank: 44, isActive: true },
  { id: 'jup', symbol: 'JUP', name: 'Jupiter', category: 'defi', chains: ['solana'], coingeckoId: 'jupiter-exchange-solana', marketCapRank: 46, isActive: true },
  { id: 'ray', symbol: 'RAY', name: 'Raydium', category: 'defi', chains: ['solana'], coingeckoId: 'raydium', marketCapRank: 82, isActive: true },
  { id: 'orca', symbol: 'ORCA', name: 'Orca', category: 'defi', chains: ['solana'], coingeckoId: 'orca', marketCapRank: 200, isActive: true },
  { id: 'grt', symbol: 'GRT', name: 'The Graph', category: 'infrastructure', chains: ['ethereum'], coingeckoId: 'the-graph', marketCapRank: 41, isActive: true },
  { id: 'vet', symbol: 'VET', name: 'VeChain', category: 'infrastructure', chains: ['vechain'], coingeckoId: 'vechain', marketCapRank: 37, isActive: true },
  { id: 'algo', symbol: 'ALGO', name: 'Algorand', category: 'layer1', chains: ['algorand'], coingeckoId: 'algorand', marketCapRank: 58, isActive: true },
  { id: 'flow', symbol: 'FLOW', name: 'Flow', category: 'layer1', chains: ['flow'], coingeckoId: 'flow', marketCapRank: 68, isActive: true },
  { id: 'hbar', symbol: 'HBAR', name: 'Hedera', category: 'layer1', chains: ['hedera'], coingeckoId: 'hedera-hashgraph', marketCapRank: 18, isActive: true },
  { id: 'icp', symbol: 'ICP', name: 'Internet Computer', category: 'layer1', chains: ['icp'], coingeckoId: 'internet-computer', marketCapRank: 21, isActive: true },
  { id: 'egld', symbol: 'EGLD', name: 'MultiversX', category: 'layer1', chains: ['multiversx'], coingeckoId: 'elrond-erd-2', marketCapRank: 47, isActive: true },
  { id: 'stx', symbol: 'STX', name: 'Stacks', category: 'layer2', chains: ['stacks'], coingeckoId: 'blockstack', marketCapRank: 36, isActive: true },
  { id: 'kas', symbol: 'KAS', name: 'Kaspa', category: 'layer1', chains: ['kaspa'], coingeckoId: 'kaspa', marketCapRank: 31, isActive: true },
  { id: 'rune', symbol: 'RUNE', name: 'THORChain', category: 'defi', chains: ['thorchain'], coingeckoId: 'thorchain', marketCapRank: 49, isActive: true },
  { id: 'ftx', symbol: 'FTT', name: 'FTX Token', category: 'exchange', chains: ['ethereum'], coingeckoId: 'ftx-token', marketCapRank: 120, isActive: true },
  { id: 'cro', symbol: 'CRO', name: 'Cronos', category: 'exchange', chains: ['cronos'], coingeckoId: 'crypto-com-chain', marketCapRank: 43, isActive: true },
  { id: 'okb', symbol: 'OKB', name: 'OKB', category: 'exchange', chains: ['okc'], coingeckoId: 'okb', marketCapRank: 16, isActive: true },
  { id: 'leo', symbol: 'LEO', name: 'UNUS SED LEO', category: 'exchange', chains: ['ethereum'], coingeckoId: 'leo-token', marketCapRank: 9, isActive: true },
  { id: 'xmr', symbol: 'XMR', name: 'Monero', category: 'privacy', chains: ['monero'], coingeckoId: 'monero', marketCapRank: 39, isActive: true },
  { id: 'zec', symbol: 'ZEC', name: 'Zcash', category: 'privacy', chains: ['zcash'], coingeckoId: 'zcash', marketCapRank: 130, isActive: true },
  { id: 'eos', symbol: 'EOS', name: 'EOS', category: 'layer1', chains: ['eos'], coingeckoId: 'eos', marketCapRank: 72, isActive: true },
  { id: 'kcs', symbol: 'KCS', name: 'KuCoin Token', category: 'exchange', chains: ['kcc'], coingeckoId: 'kucoin-shares', marketCapRank: 89, isActive: true },
  { id: 'qnt', symbol: 'QNT', name: 'Quant', category: 'infrastructure', chains: ['ethereum'], coingeckoId: 'quant-network', marketCapRank: 56, isActive: true },
  { id: 'theta', symbol: 'THETA', name: 'Theta Network', category: 'infrastructure', chains: ['theta'], coingeckoId: 'theta-token', marketCapRank: 66, isActive: true },
  { id: 'bsv', symbol: 'BSV', name: 'Bitcoin SV', category: 'layer1', chains: ['bsv'], coingeckoId: 'bitcoin-cash-sv', marketCapRank: 54, isActive: true },
  { id: 'neo', symbol: 'NEO', name: 'Neo', category: 'layer1', chains: ['neo'], coingeckoId: 'neo', marketCapRank: 74, isActive: true },
  { id: 'kava', symbol: 'KAVA', name: 'Kava', category: 'defi', chains: ['kava'], coingeckoId: 'kava', marketCapRank: 125, isActive: true },
  { id: 'mina', symbol: 'MINA', name: 'Mina Protocol', category: 'layer1', chains: ['mina'], coingeckoId: 'mina-protocol', marketCapRank: 115, isActive: true },
  { id: 'zil', symbol: 'ZIL', name: 'Zilliqa', category: 'layer1', chains: ['zilliqa'], coingeckoId: 'zilliqa', marketCapRank: 145, isActive: true },
  { id: 'iota', symbol: 'IOTA', name: 'IOTA', category: 'layer1', chains: ['iota'], coingeckoId: 'iota', marketCapRank: 135, isActive: true },
  { id: 'chz', symbol: 'CHZ', name: 'Chiliz', category: 'infrastructure', chains: ['chiliz'], coingeckoId: 'chiliz', marketCapRank: 87, isActive: true },
  { id: 'enj', symbol: 'ENJ', name: 'Enjin Coin', category: 'gaming', chains: ['ethereum'], coingeckoId: 'enjincoin', marketCapRank: 105, isActive: true },
  { id: 'bat', symbol: 'BAT', name: 'Basic Attention Token', category: 'infrastructure', chains: ['ethereum'], coingeckoId: 'basic-attention-token', marketCapRank: 97, isActive: true },
  { id: '1inch', symbol: '1INCH', name: '1inch', category: 'defi', chains: ['ethereum'], coingeckoId: '1inch', marketCapRank: 102, isActive: true },
  { id: 'rndr', symbol: 'RNDR', name: 'Render Token (legacy)', category: 'ai', chains: ['ethereum'], coingeckoId: 'render-token', marketCapRank: 29, isActive: false },
  { id: 'blur', symbol: 'BLUR', name: 'Blur', category: 'defi', chains: ['ethereum'], coingeckoId: 'blur', marketCapRank: 63, isActive: true },
  { id: 'pyth', symbol: 'PYTH', name: 'Pyth Network', category: 'oracle', chains: ['solana'], coingeckoId: 'pyth-network', marketCapRank: 51, isActive: true },
  { id: 'wld', symbol: 'WLD', name: 'Worldcoin', category: 'ai', chains: ['ethereum'], coingeckoId: 'worldcoin-wld', marketCapRank: 59, isActive: true },
  { id: 'strk', symbol: 'STRK', name: 'Starknet', category: 'layer2', chains: ['starknet'], coingeckoId: 'starknet', marketCapRank: 62, isActive: true },
  { id: 'dydx', symbol: 'DYDX', name: 'dYdX', category: 'defi', chains: ['dydx'], coingeckoId: 'dydx-chain', marketCapRank: 67, isActive: true },
  { id: 'gmx', symbol: 'GMX', name: 'GMX', category: 'defi', chains: ['arbitrum'], coingeckoId: 'gmx', marketCapRank: 92, isActive: true },
  { id: 'cake', symbol: 'CAKE', name: 'PancakeSwap', category: 'defi', chains: ['bsc'], coingeckoId: 'pancakeswap-token', marketCapRank: 83, isActive: true },
  { id: 'sushi', symbol: 'SUSHI', name: 'SushiSwap', category: 'defi', chains: ['ethereum'], coingeckoId: 'sushi', marketCapRank: 155, isActive: true },
  { id: 'rpl', symbol: 'RPL', name: 'Rocket Pool', category: 'defi', chains: ['ethereum'], coingeckoId: 'rocket-pool', marketCapRank: 140, isActive: true },
  { id: 'fxs', symbol: 'FXS', name: 'Frax Share', category: 'defi', chains: ['ethereum'], coingeckoId: 'frax-share', marketCapRank: 112, isActive: true },
  { id: 'cvx', symbol: 'CVX', name: 'Convex Finance', category: 'defi', chains: ['ethereum'], coingeckoId: 'convex-finance', marketCapRank: 150, isActive: true },
  { id: 'osmo', symbol: 'OSMO', name: 'Osmosis', category: 'defi', chains: ['cosmos'], coingeckoId: 'osmosis', marketCapRank: 93, isActive: true },
  { id: 'audio', symbol: 'AUDIO', name: 'Audius', category: 'infrastructure', chains: ['solana'], coingeckoId: 'audius', marketCapRank: 165, isActive: true },
  { id: 'mask', symbol: 'MASK', name: 'Mask Network', category: 'infrastructure', chains: ['ethereum'], coingeckoId: 'mask-network', marketCapRank: 175, isActive: true },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', category: 'stablecoin', chains: ['ethereum', 'tron', 'bsc'], coingeckoId: 'tether', marketCapRank: 3, isActive: true },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', category: 'stablecoin', chains: ['ethereum', 'solana'], coingeckoId: 'usd-coin', marketCapRank: 6, isActive: true },
  { id: 'dai', symbol: 'DAI', name: 'Dai', category: 'stablecoin', chains: ['ethereum'], coingeckoId: 'dai', marketCapRank: 25, isActive: true },
  { id: 'frax', symbol: 'FRAX', name: 'Frax', category: 'stablecoin', chains: ['ethereum'], coingeckoId: 'frax', marketCapRank: 160, isActive: true },
  { id: 'fdusd', symbol: 'FDUSD', name: 'First Digital USD', category: 'stablecoin', chains: ['bsc'], coingeckoId: 'first-digital-usd', marketCapRank: 57, isActive: true },
];

const EXCHANGE_CONFIGS: Record<SupportedExchange, { enabled: boolean; rateLimit: number; priority: number }> = {
  binance: { enabled: true, rateLimit: 1200, priority: 1 },
  kucoin: { enabled: true, rateLimit: 300, priority: 2 },
  mexc: { enabled: true, rateLimit: 300, priority: 3 },
  gate: { enabled: true, rateLimit: 300, priority: 4 },
  bitget: { enabled: true, rateLimit: 400, priority: 5 },
  kraken: { enabled: true, rateLimit: 500, priority: 6 },
  bybit: { enabled: true, rateLimit: 400, priority: 7 },
  okx: { enabled: true, rateLimit: 400, priority: 8 },
  coinbase: { enabled: true, rateLimit: 500, priority: 9 },
  huobi: { enabled: true, rateLimit: 400, priority: 10 },
};

const EXCHANGE_PRIORITY: SupportedExchange[] = Object.entries(EXCHANGE_CONFIGS)
  .filter(([_, config]) => config.enabled)
  .sort((a, b) => a[1].priority - b[1].priority)
  .map(([name]) => name as SupportedExchange);

interface PriceCache {
  price: LivePrice;
  timestamp: number;
}

export class CCXTAdapter extends EventEmitter {
  private exchanges: Map<SupportedExchange, ccxt.Exchange> = new Map();
  private priceCache: Map<string, PriceCache> = new Map();
  private tokenRegistry: Map<string, TokenMetadata> = new Map();
  private isStreaming: boolean = false;
  private streamInterval?: NodeJS.Timeout;
  private lastPrices: Map<string, number> = new Map();
  
  private readonly CACHE_TTL = 5000;
  private readonly STREAM_INTERVAL = 2000;
  private readonly MAX_CONCURRENT_REQUESTS = 10;

  constructor() {
    super();
    this.initializeTokenRegistry();
    this.initializeExchanges();
  }

  private initializeTokenRegistry(): void {
    const now = Date.now();
    TOKEN_REGISTRY.forEach(token => {
      if (token.isActive) {
        this.tokenRegistry.set(token.symbol, {
          ...token,
          addedAt: now,
          updatedAt: now,
        });
      }
    });
    console.log(`[CCXT] Initialized ${this.tokenRegistry.size} tokens in registry`);
  }

  private initializeExchanges(): void {
    const exchangeClasses: Record<SupportedExchange, any> = {
      binance: ccxt.binance,
      bybit: ccxt.bybit,
      okx: ccxt.okx,
      coinbase: ccxt.coinbase,
      kraken: ccxt.kraken,
      kucoin: ccxt.kucoin,
      gate: ccxt.gate,
      mexc: ccxt.mexc,
      bitget: ccxt.bitget,
      huobi: ccxt.huobi,
    };

    for (const [name, config] of Object.entries(EXCHANGE_CONFIGS)) {
      if (config.enabled) {
        try {
          const ExchangeClass = exchangeClasses[name as SupportedExchange];
          if (ExchangeClass) {
            const exchange = new ExchangeClass({
              enableRateLimit: true,
              rateLimit: config.rateLimit,
              timeout: 10000,
              options: {
                defaultType: 'spot',
                adjustForTimeDifference: true,
              },
            });
            this.exchanges.set(name as SupportedExchange, exchange);
          }
        } catch (error) {
          console.warn(`[CCXT] Failed to initialize ${name}:`, error);
        }
      }
    }
    console.log(`[CCXT] Initialized ${this.exchanges.size} exchanges: ${EXCHANGE_PRIORITY.join(', ')}`);
    
    this.loadMarketsAsync();
  }
  
  private async loadMarketsAsync(): Promise<void> {
    for (const exchange of EXCHANGE_PRIORITY) {
      const client = this.exchanges.get(exchange);
      if (client) {
        try {
          await client.loadMarkets();
          console.log(`[CCXT] Loaded markets for ${exchange}`);
        } catch (error) {
          console.warn(`[CCXT] Failed to load markets for ${exchange}`);
        }
      }
    }
  }

  getTokenRegistry(): TokenMetadata[] {
    return Array.from(this.tokenRegistry.values());
  }

  getActiveTokens(): string[] {
    return Array.from(this.tokenRegistry.values())
      .filter(t => t.isActive)
      .map(t => t.symbol);
  }

  getTokensByCategory(category: TokenCategory): TokenMetadata[] {
    return Array.from(this.tokenRegistry.values())
      .filter(t => t.category === category && t.isActive);
  }

  async fetchPrice(symbol: string, preferredExchange?: SupportedExchange): Promise<LivePrice | null> {
    const exchanges = preferredExchange ? [preferredExchange, ...EXCHANGE_PRIORITY.filter(e => e !== preferredExchange)] : EXCHANGE_PRIORITY;
    
    for (const exchange of exchanges) {
      const cacheKey = `${symbol}:${exchange}`;
      const cached = this.priceCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.price;
      }

      const exchangeClient = this.exchanges.get(exchange);
      if (!exchangeClient) continue;

      try {
        const ccxtSymbol = `${symbol}/USDT`;
        const ticker = await exchangeClient.fetchTicker(ccxtSymbol);
        
        const lastPrice = this.lastPrices.get(symbol) || ticker.last || 0;
        const currentPrice = ticker.last || 0;
        const change24h = currentPrice - (ticker.open || lastPrice);
        const changePercent24h = ticker.open ? ((currentPrice - ticker.open) / ticker.open) * 100 : 0;
        
        this.lastPrices.set(symbol, currentPrice);

        const price: LivePrice = {
          symbol,
          price: currentPrice,
          change24h,
          changePercent24h,
          high24h: ticker.high || currentPrice,
          low24h: ticker.low || currentPrice,
          volume24h: ticker.baseVolume || 0,
          volumeUsd24h: ticker.quoteVolume || 0,
          bid: ticker.bid,
          ask: ticker.ask,
          spread: ticker.bid && ticker.ask ? ((ticker.ask - ticker.bid) / ticker.ask) * 100 : undefined,
          exchange,
          timestamp: Date.now(),
        };

        this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
        return price;
      } catch (error) {
        continue;
      }
    }
    
    console.warn(`[CCXT] Failed to fetch ${symbol} from any exchange`);
    return null;
  }

  async fetchMultiplePrices(symbols: string[], preferredExchange?: SupportedExchange): Promise<Map<string, LivePrice>> {
    const results = new Map<string, LivePrice>();
    const exchanges = preferredExchange ? [preferredExchange, ...EXCHANGE_PRIORITY.filter(e => e !== preferredExchange)] : EXCHANGE_PRIORITY;
    const symbolSet = new Set(symbols.map(s => s.toUpperCase()));
    
    for (const exchange of exchanges) {
      const exchangeClient = this.exchanges.get(exchange);
      if (!exchangeClient) continue;

      try {
        const remainingSymbols = symbols.filter(s => !results.has(s));
        if (remainingSymbols.length === 0) break;
        
        let tickers: Record<string, any> = {};
        
        if (exchangeClient.has['fetchTickers']) {
          try {
            tickers = await exchangeClient.fetchTickers();
          } catch (e) {
            continue;
          }
        }
        
        for (const [ccxtSymbol, ticker] of Object.entries(tickers)) {
          if (!ccxtSymbol.endsWith('/USDT') && !ccxtSymbol.endsWith('/USD')) continue;
          
          const symbol = ccxtSymbol.replace('/USDT', '').replace('/USD', '').toUpperCase();
          if (!symbolSet.has(symbol) || results.has(symbol)) continue;
          
          const lastPrice = this.lastPrices.get(symbol) || (ticker as any).last || 0;
          const currentPrice = (ticker as any).last || 0;
          
          if (currentPrice <= 0) continue;
          
          this.lastPrices.set(symbol, currentPrice);

          const price: LivePrice = {
            symbol,
            price: currentPrice,
            change24h: currentPrice - ((ticker as any).open || lastPrice),
            changePercent24h: (ticker as any).percentage || 0,
            high24h: (ticker as any).high || currentPrice,
            low24h: (ticker as any).low || currentPrice,
            volume24h: (ticker as any).baseVolume || 0,
            volumeUsd24h: (ticker as any).quoteVolume || 0,
            bid: (ticker as any).bid,
            ask: (ticker as any).ask,
            exchange,
            timestamp: Date.now(),
          };

          results.set(symbol, price);
          this.priceCache.set(`${symbol}:${exchange}`, { price, timestamp: Date.now() });
        }
        
        if (results.size >= symbols.length * 0.7) break;
      } catch (error) {
        continue;
      }
    }
    
    const missingSymbols = symbols.filter(s => !results.has(s));
    if (missingSymbols.length > 0) {
      try {
        const geckoPrices = await coinGeckoClient.getCurrentPrice(missingSymbols);
        for (const [symbol, priceValue] of Object.entries(geckoPrices)) {
          if (priceValue > 0 && !results.has(symbol)) {
            const price: LivePrice = {
              symbol,
              price: priceValue,
              change24h: 0,
              changePercent24h: 0,
              high24h: priceValue,
              low24h: priceValue,
              volume24h: 0,
              volumeUsd24h: 0,
              exchange: 'coinbase' as SupportedExchange,
              timestamp: Date.now(),
            };
            results.set(symbol, price);
            this.lastPrices.set(symbol, priceValue);
          }
        }
      } catch {
      }
    }
    
    for (const symbol of symbols) {
      if (!results.has(symbol)) {
        for (const exchange of EXCHANGE_PRIORITY) {
          const cached = this.priceCache.get(`${symbol}:${exchange}`);
          if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 10) {
            results.set(symbol, cached.price);
            break;
          }
        }
      }
    }
    
    for (const symbol of symbols) {
      if (!results.has(symbol)) {
        const fallbackPrice = FALLBACK_PRICES[symbol];
        if (fallbackPrice) {
          const price: LivePrice = {
            symbol,
            price: fallbackPrice,
            change24h: 0,
            changePercent24h: 0,
            high24h: fallbackPrice,
            low24h: fallbackPrice,
            volume24h: 0,
            volumeUsd24h: 0,
            exchange: 'coinbase' as SupportedExchange,
            timestamp: Date.now(),
          };
          results.set(symbol, price);
        }
      }
    }

    return results;
  }

  async fetchOHLCV(
    symbol: string, 
    timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit: number = 100,
    preferredExchange?: SupportedExchange
  ): Promise<OHLCVBar[]> {
    const exchanges = preferredExchange ? [preferredExchange, ...EXCHANGE_PRIORITY.filter(e => e !== preferredExchange)] : EXCHANGE_PRIORITY;
    
    for (const exchange of exchanges) {
      const exchangeClient = this.exchanges.get(exchange);
      if (!exchangeClient) continue;

      try {
        const ccxtSymbol = `${symbol}/USDT`;
        const ohlcv = await exchangeClient.fetchOHLCV(ccxtSymbol, timeframe, undefined, limit);
        
        return ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
          timestamp: timestamp as number,
          open: open as number,
          high: high as number,
          low: low as number,
          close: close as number,
          volume: volume as number,
        }));
      } catch (error) {
        continue;
      }
    }
    
    console.warn(`[CCXT] Failed to fetch OHLCV for ${symbol} from any exchange`);
    return [];
  }

  async startPriceStreaming(): Promise<void> {
    if (this.isStreaming) return;
    
    this.isStreaming = true;
    console.log('[CCXT] Starting price streaming for', this.tokenRegistry.size, 'tokens using exchanges:', EXCHANGE_PRIORITY.join(', '));

    const fetchBatch = async () => {
      const tokens = this.getActiveTokens();
      const batchSize = 20;
      
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        try {
          const prices = await this.fetchMultiplePrices(batch);
          
          if (prices.size > 0) {
            this.emit('prices', Array.from(prices.values()));
          }
        } catch (error) {
          console.warn('[CCXT] Batch fetch error:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    fetchBatch();
    
    this.streamInterval = setInterval(fetchBatch, this.STREAM_INTERVAL);
  }

  stopPriceStreaming(): void {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = undefined;
    }
    this.isStreaming = false;
    console.log('[CCXT] Stopped price streaming');
  }

  getCachedPrice(symbol: string): LivePrice | null {
    for (const exchange of EXCHANGE_PRIORITY) {
      const cached = this.priceCache.get(`${symbol}:${exchange}`);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL * 2) {
        return cached.price;
      }
    }
    return null;
  }

  getAllCachedPrices(): LivePrice[] {
    const prices: LivePrice[] = [];
    const seenSymbols = new Set<string>();
    const now = Date.now();
    
    for (const exchange of EXCHANGE_PRIORITY) {
      for (const [key, cached] of this.priceCache.entries()) {
        if (now - cached.timestamp < this.CACHE_TTL * 4 && key.endsWith(`:${exchange}`)) {
          if (!seenSymbols.has(cached.price.symbol)) {
            prices.push(cached.price);
            seenSymbols.add(cached.price.symbol);
          }
        }
      }
    }
    
    const activeTokens = this.getActiveTokens();
    for (const symbol of activeTokens) {
      if (!seenSymbols.has(symbol)) {
        const fallbackPrice = FALLBACK_PRICES[symbol];
        if (fallbackPrice) {
          prices.push({
            symbol,
            price: fallbackPrice,
            change24h: 0,
            changePercent24h: 0,
            high24h: fallbackPrice,
            low24h: fallbackPrice,
            volume24h: 0,
            volumeUsd24h: 0,
            exchange: 'kucoin' as SupportedExchange,
            timestamp: now,
          });
          seenSymbols.add(symbol);
        }
      }
    }
    
    return prices;
  }

  getExchangeStatus(): Record<SupportedExchange, boolean> {
    const status: Record<SupportedExchange, boolean> = {} as any;
    for (const [name, exchange] of this.exchanges.entries()) {
      status[name] = exchange !== undefined;
    }
    return status;
  }

  async checkExchangeHealth(exchange: SupportedExchange): Promise<{ healthy: boolean; latencyMs: number }> {
    const exchangeClient = this.exchanges.get(exchange);
    if (!exchangeClient) {
      return { healthy: false, latencyMs: -1 };
    }

    try {
      const start = Date.now();
      await exchangeClient.fetchTicker('BTC/USDT');
      const latencyMs = Date.now() - start;
      return { healthy: true, latencyMs };
    } catch {
      return { healthy: false, latencyMs: -1 };
    }
  }
}

export const ccxtAdapter = new CCXTAdapter();
