const ICONS: Record<string, string> = {
  ETH: '⚡',
  USDC: '💙',
  USDT: '💚',
  WETH: '🔷',
};

interface Props {
  symbol: string;
  size?: number;
}

export default function TokenIcon({ symbol, size = 36 }: Props) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'var(--card-bg, #1a1a2e)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.5,
    }}>
      {ICONS[symbol] || '🪙'}
    </div>
  );
}
