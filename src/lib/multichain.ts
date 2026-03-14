/**
 * Multichain balance aggregator.
 * Queries ETH + ERC-20 balances across all supported chains in parallel.
 */

import { formatUnits } from 'viem';
import { SUPPORTED_CHAINS, getPublicClient, type ChainConfig } from './chains';
import { cacheGet, cacheSet } from './cache';

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export interface ChainBalance {
  chainKey: string;
  chainLabel: string;
  chainColor: string;
  chainIcon: string;
  isTestnet: boolean;
  nativeBalance: bigint;
  nativeSymbol: string;
  nativeDecimals: number;
  nativeUsdValue: number | null;
  tokens: {
    symbol: string;
    name: string;
    decimals: number;
    address: `0x${string}`;
    balance: bigint;
    formattedBalance: string;
    usdValue: number | null;
  }[];
  totalUsdValue: number | null;
  error?: string;
}

export interface MultichainBalances {
  chains: ChainBalance[];
  totalUsdValue: number;
  lastUpdated: number;
}

// CoinGecko ID mapping for native currencies
const NATIVE_COINGECKO_IDS: Record<string, string> = {
  'ETH': 'ethereum',
  'MATIC': 'matic-network',
  'POL': 'matic-network',
};

const TOKEN_COINGECKO_IDS: Record<string, string> = {
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WETH': 'weth',
  'DAI': 'dai',
};

const CACHE_KEY = (addr: string) => `multichain_balances_${addr.toLowerCase()}`;
const PRICES_CACHE_KEY = 'multichain_prices';

/** Fetch USD prices for all relevant tokens */
async function fetchPrices(): Promise<Record<string, number>> {
  // Check cache (30s TTL for prices)
  const cached = cacheGet<Record<string, number>>(PRICES_CACHE_KEY);
  if (cached) return cached;

  try {
    const ids = ['ethereum', 'matic-network', 'usd-coin', 'tether', 'weth', 'dai'];
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`,
      { headers: { Accept: 'application/json' } }
    );
    if (!resp.ok) return {};
    const data = await resp.json();
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && 'usd' in val) {
        prices[id] = (val as { usd: number }).usd;
      }
    }
    cacheSet(PRICES_CACHE_KEY, prices);
    return prices;
  } catch {
    return {};
  }
}

/** Fetch balances for a single chain */
async function fetchChainBalances(
  config: ChainConfig,
  walletAddress: `0x${string}`,
  prices: Record<string, number>,
): Promise<ChainBalance> {
  const client = getPublicClient(config.key);
  const nativeCurrency = config.chain.nativeCurrency;
  const nativeCoingeckoId = NATIVE_COINGECKO_IDS[nativeCurrency.symbol] || 'ethereum';

  try {
    // Fetch native + ERC-20 balances in parallel
    const erc20Contracts = config.tokens
      .filter(t => t.symbol !== 'WETH') // hide WETH
      .map(t => ({
        address: t.address,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf' as const,
        args: [walletAddress],
      }));

    const [nativeBalance, erc20Results] = await Promise.all([
      client.getBalance({ address: walletAddress }),
      erc20Contracts.length > 0
        ? client.multicall({ contracts: erc20Contracts }).catch(() => erc20Contracts.map(() => ({ status: 'failure' as const, result: 0n, error: new Error('multicall failed') })))
        : [],
    ]);

    const nativeFormatted = parseFloat(formatUnits(nativeBalance, nativeCurrency.decimals));
    const nativePrice = prices[nativeCoingeckoId] || null;
    const nativeUsd = nativePrice ? nativeFormatted * nativePrice : null;

    const visibleTokens = config.tokens.filter(t => t.symbol !== 'WETH');
    const tokens = visibleTokens.map((token, i) => {
      const result = erc20Results[i];
      const balance = result && result.status === 'success' ? result.result as bigint : 0n;
      const formatted = formatUnits(balance, token.decimals);
      const coingeckoId = TOKEN_COINGECKO_IDS[token.symbol];
      const price = coingeckoId ? prices[coingeckoId] : null;
      const usdValue = price ? parseFloat(formatted) * price : null;

      return {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        address: token.address,
        balance,
        formattedBalance: formatted,
        usdValue,
      };
    });

    // Total USD for this chain
    let totalUsd: number | null = nativeUsd;
    for (const t of tokens) {
      if (t.usdValue !== null) {
        totalUsd = (totalUsd || 0) + t.usdValue;
      }
    }

    return {
      chainKey: config.key,
      chainLabel: config.label,
      chainColor: config.color,
      chainIcon: config.icon,
      isTestnet: config.isTestnet || false,
      nativeBalance,
      nativeSymbol: nativeCurrency.symbol,
      nativeDecimals: nativeCurrency.decimals,
      nativeUsdValue: nativeUsd,
      tokens,
      totalUsdValue: totalUsd,
    };
  } catch (error) {
    return {
      chainKey: config.key,
      chainLabel: config.label,
      chainColor: config.color,
      chainIcon: config.icon,
      isTestnet: config.isTestnet || false,
      nativeBalance: 0n,
      nativeSymbol: nativeCurrency.symbol,
      nativeDecimals: nativeCurrency.decimals,
      nativeUsdValue: null,
      tokens: [],
      totalUsdValue: null,
      error: (error as Error).message,
    };
  }
}

/** Fetch balances across all supported chains */
export async function getMultichainBalances(
  walletAddress: `0x${string}`,
): Promise<MultichainBalances> {
  // Fetch prices first (shared across all chains)
  const prices = await fetchPrices();

  // Query all chains in parallel
  const results = await Promise.allSettled(
    SUPPORTED_CHAINS.map(config => fetchChainBalances(config, walletAddress, prices)),
  );

  const chains: ChainBalance[] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      chainKey: SUPPORTED_CHAINS[i].key,
      chainLabel: SUPPORTED_CHAINS[i].label,
      chainColor: SUPPORTED_CHAINS[i].color,
      chainIcon: SUPPORTED_CHAINS[i].icon,
      isTestnet: SUPPORTED_CHAINS[i].isTestnet || false,
      nativeBalance: 0n,
      nativeSymbol: SUPPORTED_CHAINS[i].chain.nativeCurrency.symbol,
      nativeDecimals: SUPPORTED_CHAINS[i].chain.nativeCurrency.decimals,
      nativeUsdValue: null,
      tokens: [],
      totalUsdValue: null,
      error: r.reason?.message || 'Unknown error',
    };
  });

  const totalUsdValue = chains.reduce((sum, c) => sum + (c.totalUsdValue || 0), 0);

  const balances: MultichainBalances = {
    chains,
    totalUsdValue,
    lastUpdated: Date.now(),
  };

  // Cache the result (serialize bigints)
  cacheSet(CACHE_KEY(walletAddress), serializeBalances(balances));

  return balances;
}

// Serialization helpers for cache
function serializeBalances(b: MultichainBalances): unknown {
  return {
    ...b,
    chains: b.chains.map(c => ({
      ...c,
      nativeBalance: c.nativeBalance.toString(),
      tokens: c.tokens.map(t => ({ ...t, balance: t.balance.toString() })),
    })),
  };
}
