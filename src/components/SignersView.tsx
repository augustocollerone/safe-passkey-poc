import { useState, useEffect } from 'react';
import { getOwners, getThreshold } from '../lib/safe';
import { type SavedSafe, base64ToArrayBuffer } from '../lib/storage';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
const avatarColor = (addr: string) => COLORS[parseInt(addr.slice(2, 6), 16) % COLORS.length];
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface Props {
  safe: SavedSafe;
}

export default function SignersView({ safe }: Props) {
  const [owners, setOwners] = useState<`0x${string}`[]>([]);
  const [threshold, setThreshold] = useState(safe.threshold);

  const localOwner = safe.owners.find(o => o.credentialId);

  useEffect(() => {
    const refresh = async () => {
      try {
        const [o, t] = await Promise.all([
          getOwners(safe.address),
          getThreshold(safe.address),
        ]);
        setOwners(o);
        setThreshold(Number(t));
      } catch (e) {
        console.error('Failed to fetch signers:', e);
      }
    };
    refresh();
  }, [safe.address]);

  const ownerList = owners.length > 0 ? owners : safe.owners.map(o => o.address);

  return (
    <div className="fade-in stack-lg">
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>👥 Signers</h2>

      {/* Threshold Info */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Signing Threshold</p>
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>
              {threshold} of {ownerList.length} signers required to approve transactions
            </p>
          </div>
          <div style={{
            background: 'var(--gradient)',
            color: '#fff',
            borderRadius: 'var(--radius-full)',
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
          }}>
            {threshold}/{ownerList.length}
          </div>
        </div>
      </div>

      {/* Device List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Devices</h3>
          <span className="badge badge-success">{ownerList.length} {ownerList.length === 1 ? 'device' : 'devices'}</span>
        </div>
        <div className="stack">
          {ownerList.map(addr => {
            const addrStr = typeof addr === 'string' ? addr : String(addr);
            const isLocal = localOwner && localOwner.address.toLowerCase() === addrStr.toLowerCase();
            return (
              <div key={addrStr} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ background: avatarColor(addrStr) }}>
                  {addrStr.slice(2, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{isLocal ? 'This Device' : `Device ${addrStr.slice(2, 6)}`}</p>
                  <p className="text-muted text-xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortAddr(addrStr)}</p>
                </div>
                {isLocal && <span className="badge badge-success">You</span>}
              </div>
            );
          })}
        </div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => window.location.hash = `#/invite?safe=${safe.address}`}>
          + Add Device
        </button>
      </div>
    </div>
  );
}
