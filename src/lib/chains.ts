/**
 * Multichain configuration for balance queries.
 * Each chain has public RPCs and known token addresses.
 */

import { createPublicClient, http, fallback, type Chain, type PublicClient } from 'viem';
import {
  mainnet,
  base,
  polygon,
  arbitrum,
  optimism,
  baseSepolia,
} from 'viem/chains';

export interface ChainConfig {
  chain: Chain;
  key: string;          // unique short key
  label: string;        // display name
  color: string;        // brand color for UI
  icon: string;         // emoji icon
  rpcs: string[];       // public RPC endpoints
  tokens: {             // known ERC-20s on this chain
    address: `0x${string}`;
    symbol: string;
    name: string;
    decimals: number;
  }[];
  isTestnet?: boolean;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chain: baseSepolia,
    key: 'base-sepolia',
    label: 'Base Sepolia',
    color: '#0052FF',
    icon: '🔵',
    rpcs: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.blockpi.network/v1/rpc/public',
    ],
    tokens: [
      { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0x7439E9Bb6D8a84dd3A23fe621A30F95403F87fB9', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    ],
    isTestnet: true,
  },
  {
    chain: mainnet,
    key: 'ethereum',
    label: 'Ethereum',
    color: '#627EEA',
    icon: '⟠',
    rpcs: [
      'https://eth.llamarpc.com',
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.ankr.com/eth',
      'https://1rpc.io/eth',
    ],
    tokens: [
      { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
  },
  {
    chain: base,
    key: 'base',
    label: 'Base',
    color: '#0052FF',
    icon: '🔵',
    rpcs: [
      'https://mainnet.base.org',
      'https://base-rpc.publicnode.com',
      'https://base.llamarpc.com',
      'https://1rpc.io/base',
    ],
    tokens: [
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
  },
  {
    chain: polygon,
    key: 'polygon',
    label: 'Polygon',
    color: '#8247E5',
    icon: '🟣',
    rpcs: [
      'https://polygon-rpc.com',
      'https://polygon-bor-rpc.publicnode.com',
      'https://rpc.ankr.com/polygon',
      'https://1rpc.io/matic',
    ],
    tokens: [
      { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
  },
  {
    chain: arbitrum,
    key: 'arbitrum',
    label: 'Arbitrum',
    color: '#28A0F0',
    icon: '🔷',
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum-one-rpc.publicnode.com',
      'https://rpc.ankr.com/arbitrum',
      'https://1rpc.io/arb',
    ],
    tokens: [
      { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
  },
  {
    chain: optimism,
    key: 'optimism',
    label: 'Optimism',
    color: '#FF0420',
    icon: '🔴',
    rpcs: [
      'https://mainnet.optimism.io',
      'https://optimism-rpc.publicnode.com',
      'https://rpc.ankr.com/optimism',
      'https://1rpc.io/op',
    ],
    tokens: [
      { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    ],
  },
];

// Create a public client for each chain (lazy-initialized)
const clientCache = new Map<string, PublicClient>();

export function getPublicClient(chainKey: string): PublicClient {
  let client = clientCache.get(chainKey);
  if (client) return client;

  const config = SUPPORTED_CHAINS.find(c => c.key === chainKey);
  if (!config) throw new Error(`Unknown chain: ${chainKey}`);

  client = createPublicClient({
    chain: config.chain,
    transport: fallback(
      config.rpcs.map(url => http(url, { retryCount: 1, timeout: 8_000 })),
    ),
  });

  clientCache.set(chainKey, client);
  return client;
}

/** Get the native currency symbol for a chain */
export function getNativeSymbol(chainKey: string): string {
  const config = SUPPORTED_CHAINS.find(c => c.key === chainKey);
  if (!config) return 'ETH';
  return config.chain.nativeCurrency.symbol;
}
