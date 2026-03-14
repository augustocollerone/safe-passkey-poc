import { useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { getMultichainBalances, type MultichainBalances as MCBalances, type ChainBalance } from '../lib/multichain';
import { formatUSDValue } from '../lib/tokens';
import TokenIcon from './TokenIcon';

interface Props {
  safeAddress: `0x${string}`;
}

export default function MultichainBalances({ safeAddress }: Props) {
  const [data, setData] = useState<MCBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        setLoading(true);
        const result = await getMultichainBalances(safeAddress);
        if (!cancelled) setData(result);
      } catch (e) {
        console.error('Multichain fetch error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 45_000); // refresh every 45s
    return () => { cancelled = true; clearInterval(interval); };
  }, [safeAddress]);

  const toggleChain = (key: string) => {
    setExpandedChains(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading && !data) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="spinner spinner-dark" style={{ width: 20, height: 20 }} />
          <span style={{ marginLeft: 8, fontSize: 14 }}>Loading multichain balances...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Sort: chains with balance first, then by USD value desc
  const sorted = [...data.chains].sort((a, b) => {
    const aVal = a.totalUsdValue || 0;
    const bVal = b.totalUsdValue || 0;
    const aHas = a.nativeBalance > 0n || a.tokens.some(t => t.balance > 0n);
    const bHas = b.nativeBalance > 0n || b.tokens.some(t => t.balance > 0n);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return bVal - aVal;
  });

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 16px 12px',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Balances by Network</h3>
        {loading && (
          <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} />
        )}
      </div>

      {/* Chain rows */}
      <div>
        {sorted.map(chain => (
          <ChainRow
            key={chain.chainKey}
            chain={chain}
            expanded={expandedChains.has(chain.chainKey)}
            onToggle={() => toggleChain(chain.chainKey)}
          />
        ))}
      </div>
    </div>
  );
}

function ChainRow({ chain, expanded, onToggle }: {
  chain: ChainBalance;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasBalance = chain.nativeBalance > 0n || chain.tokens.some(t => t.balance > 0n);
  const nativeFormatted = parseFloat(formatUnits(chain.nativeBalance, chain.nativeDecimals));
  const tokensWithBalance = chain.tokens.filter(t => t.balance > 0n);

  return (
    <div style={{
      borderTop: '1px solid var(--border, rgba(0,0,0,0.06))',
    }}>
      {/* Chain header row */}
      <div
        onClick={hasBalance ? onToggle : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          cursor: hasBalance ? 'pointer' : 'default',
          opacity: hasBalance ? 1 : 0.4,
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Chain color dot */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: chain.chainColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff', fontWeight: 700,
            boxShadow: hasBalance ? `0 2px 8px ${chain.chainColor}33` : 'none',
          }}>
            {chain.chainLabel.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
              {chain.chainLabel}
              {chain.isTestnet && (
                <span style={{
                  fontSize: 10, fontWeight: 500, color: 'var(--text-secondary, #888)',
                  marginLeft: 6, padding: '1px 5px', borderRadius: 4,
                  background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
                }}>TEST</span>
              )}
            </div>
            {hasBalance && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)', marginTop: 1 }}>
                {nativeFormatted > 0 ? `${nativeFormatted.toFixed(4)} ${chain.nativeSymbol}` : ''}
                {nativeFormatted > 0 && tokensWithBalance.length > 0 ? ' + ' : ''}
                {tokensWithBalance.length > 0 ? `${tokensWithBalance.length} token${tokensWithBalance.length > 1 ? 's' : ''}` : ''}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {chain.error && (
            <span style={{ fontSize: 11, color: '#EF4444' }}>⚠</span>
          )}
          {chain.totalUsdValue !== null && chain.totalUsdValue > 0 ? (
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {formatUSDValue(chain.totalUsdValue)}
            </span>
          ) : !hasBalance ? (
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>—</span>
          ) : null}
          {hasBalance && (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{
                opacity: 0.4,
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </div>

      {/* Expanded token details */}
      {expanded && hasBalance && (
        <div style={{
          padding: '0 16px 14px 58px', // aligned with text after the dot
        }}>
          {/* Native balance */}
          {nativeFormatted > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: tokensWithBalance.length > 0 ? '1px solid var(--border, rgba(0,0,0,0.04))' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TokenIcon symbol={chain.nativeSymbol} size={24} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{chain.nativeSymbol}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{nativeFormatted.toFixed(4)}</div>
                {chain.nativeUsdValue !== null && chain.nativeUsdValue > 0.01 && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>
                    {formatUSDValue(chain.nativeUsdValue)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ERC-20 tokens */}
          {tokensWithBalance.map((token, i) => (
            <div key={token.address} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < tokensWithBalance.length - 1 ? '1px solid var(--border, rgba(0,0,0,0.04))' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TokenIcon symbol={token.symbol} size={24} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{token.symbol}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {parseFloat(token.formattedBalance).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </div>
                {token.usdValue !== null && token.usdValue > 0.01 && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>
                    {formatUSDValue(token.usdValue)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
