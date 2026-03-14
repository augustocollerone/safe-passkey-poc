import { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import { type SavedSafe } from '../lib/storage';
import { getOwners, getThreshold, getNonce, execTransaction, encodeChangeThreshold } from '../lib/safe';
import { computeSafeTxHash, packSafeSignature } from '../lib/encoding';
import { signWithPasskey } from '../lib/webauthn';
import { base64ToArrayBuffer } from '../lib/storage';
import {
  type ShareableTransaction,
  encodeShareableTransaction,
  packSingleSignerData,
} from '../lib/multisig';

interface Props {
  safe: SavedSafe;
  onBack: () => void;
}

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];
const avatarColor = (addr: string) => COLORS[parseInt(addr.slice(2, 6), 16) % COLORS.length];
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const extractClientDataFields = (clientDataJSON: string, challengeOffset: number): string => {
  const challengeEnd = clientDataJSON.indexOf('"', challengeOffset);
  return clientDataJSON.slice(challengeEnd + 2, clientDataJSON.length - 1);
};

interface SignerEvent {
  method: string;
  description: string;
  timeAgo: string;
  icon: string;
}

const TX_SERVICE = 'https://safe-transaction-base-sepolia.safe.global/api/v1';

export default function SignersView({ safe, onBack }: Props) {
  const [owners, setOwners] = useState<`0x${string}`[]>([]);
  const [threshold, setThreshold] = useState(safe.threshold);
  const [newThreshold, setNewThreshold] = useState(safe.threshold);
  const [showThresholdChange, setShowThresholdChange] = useState(false);
  const [thresholdStatus, setThresholdStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [signerHistory, setSignerHistory] = useState<SignerEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const localOwner = safe.owners.find(o => o.credentialId);
  const localCredentialId = localOwner?.credentialId ? base64ToArrayBuffer(localOwner.credentialId) : null;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [currentOwners, currentThreshold] = await Promise.all([
          getOwners(safe.address),
          getThreshold(safe.address)
        ]);
        setOwners(currentOwners);
        setThreshold(Number(currentThreshold));
        setNewThreshold(Number(currentThreshold));
      } catch {}
    };
    loadData();
  }, [safe.address]);

  // Fetch signer activity history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${TX_SERVICE}/safes/${safe.address}/all-transactions/?limit=50&executed=true`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const signerMethods = ['addOwnerWithThreshold', 'removeOwner', 'swapOwner', 'changeThreshold'];
        const events: SignerEvent[] = [];

        for (const tx of data.results || []) {
          const dd = tx.dataDecoded;
          if (!dd || !signerMethods.includes(dd.method)) continue;

          const ts = tx.executionDate || tx.submissionDate;
          const timeAgo = formatTimeAgo(ts);

          if (dd.method === 'addOwnerWithThreshold') {
            const owner = dd.parameters?.find((p: any) => p.name === 'owner')?.value || '?';
            events.push({ method: dd.method, description: `Device ${shortAddr(owner)} added`, timeAgo, icon: '👤' });
          } else if (dd.method === 'removeOwner') {
            const owner = dd.parameters?.find((p: any) => p.name === 'owner')?.value || '?';
            events.push({ method: dd.method, description: `Device ${shortAddr(owner)} removed`, timeAgo, icon: '🚫' });
          } else if (dd.method === 'swapOwner') {
            const oldOwner = dd.parameters?.find((p: any) => p.name === 'oldOwner')?.value || '?';
            const newOwner = dd.parameters?.find((p: any) => p.name === 'newOwner')?.value || '?';
            events.push({ method: dd.method, description: `Swapped ${shortAddr(oldOwner)} → ${shortAddr(newOwner)}`, timeAgo, icon: '🔄' });
          } else if (dd.method === 'changeThreshold') {
            const t = dd.parameters?.find((p: any) => p.name === '_threshold')?.value || '?';
            events.push({ method: dd.method, description: `Threshold changed to ${t}`, timeAgo, icon: '🔧' });
          }
        }
        setSignerHistory(events);
      } catch {}
      setHistoryLoading(false);
    };
    fetchHistory();
  }, [safe.address]);

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const handleThresholdChange = async () => {
    if (!localCredentialId || !localOwner || newThreshold === threshold) return;
    setThresholdStatus('Signing…');
    setShareUrl('');
    try {
      const changeThresholdData = encodeChangeThreshold(BigInt(newThreshold));
      const nonce = await getNonce(safe.address);
      const safeTxHash = computeSafeTxHash(safe.address, safe.address, 0n, changeThresholdData, nonce);
      const hashBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) hashBytes[i] = parseInt(safeTxHash.slice(2 + i * 2, 4 + i * 2), 16);

      const sig = await signWithPasskey(localCredentialId, hashBytes);
      const clientDataFields = extractClientDataFields(sig.clientDataJSON, sig.challengeOffset);

      if (threshold <= 1) {
        setThresholdStatus('Executing…');
        const packed = packSafeSignature(localOwner.address, sig.authenticatorData, sig.clientDataJSON, sig.challengeOffset, sig.r, sig.s);
        await execTransaction(safe.address, safe.address, 0n, changeThresholdData, packed);
        setThreshold(newThreshold);
        setThresholdStatus('Threshold updated ✅');
        setShowThresholdChange(false);
      } else {
        const sigData = packSingleSignerData(sig.authenticatorData, clientDataFields, sig.r, sig.s);
        const shareable: ShareableTransaction = {
          safe: safe.address, to: safe.address, value: '0', data: changeThresholdData,
          nonce: nonce.toString(), chainId: safe.chainId,
          signatures: [{ signer: localOwner.address, data: sigData }],
          threshold,
        };
        const encoded = encodeShareableTransaction(shareable);
        const url = `${window.location.origin}${window.location.pathname}#/sign?data=${encoded}`;
        setShareUrl(url);
        setThresholdStatus(`Signed (1/${threshold}). Share with co-signers.`);
      }
    } catch (e: any) {
      setThresholdStatus(`Error: ${e.message}`);
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  const getOwnerLabel = (address: string) => {
    const savedOwner = safe.owners.find(o => o.address.toLowerCase() === address.toLowerCase());
    if (savedOwner && savedOwner.credentialId) return 'This Device';
    if (savedOwner && savedOwner.label) return savedOwner.label;
    return `Device ${address.slice(2, 6)}`;
  };

  const ownerCount = owners.length || safe.owners.length;

  return (
    <div className="fade-in stack-lg">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-icon" style={{ width: 44, height: 44, fontSize: 20 }} onClick={onBack}>←</button>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Signers</h2>
        <span className="badge badge-success" style={{ marginLeft: 'auto' }}>{threshold} of {ownerCount} required</span>
      </div>

      {/* Section A — Current Signers */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Current Signers</h3>
        <div className="stack">
          {(owners.length > 0 ? owners : safe.owners.map(o => o.address)).map(addr => {
            const isLocal = localOwner && localOwner.address.toLowerCase() === addr.toLowerCase();
            const label = getOwnerLabel(addr);
            return (
              <div key={addr} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ background: avatarColor(addr) }}>
                  {addr.slice(2, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{label}</p>
                  <p className="text-muted text-xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortAddr(addr)}</p>
                </div>
                {isLocal && <span className="badge badge-success">You</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section B — Add Device */}
      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={() => window.location.hash = `#/invite?safe=${safe.address}`}
      >
        + Add Device
      </button>

      {/* Section C — Threshold Management */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>Signature Threshold</h3>
            <p className="text-muted text-sm">Signatures required to execute transactions</p>
          </div>
          <span className="badge badge-success">{threshold}</span>
        </div>

        {!showThresholdChange ? (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowThresholdChange(true)}
            disabled={ownerCount <= 1}
          >
            Change Threshold
          </button>
        ) : (
          <div className="stack">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="text-secondary text-sm">New threshold:</label>
              <select className="select" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}>
                {Array.from({ length: ownerCount }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="row">
              <button className="btn btn-secondary btn-sm flex-1" onClick={() => {
                setShowThresholdChange(false);
                setNewThreshold(threshold);
                setThresholdStatus('');
                setShareUrl('');
              }}>Cancel</button>
              <button
                className="btn btn-primary btn-sm flex-1"
                onClick={handleThresholdChange}
                disabled={newThreshold === threshold || thresholdStatus === 'Signing…' || thresholdStatus === 'Executing…'}
              >
                {thresholdStatus === 'Signing…' || thresholdStatus === 'Executing…' ?
                  <><div className="spinner" /> {thresholdStatus}</> :
                  'Update Threshold'
                }
              </button>
            </div>
            {thresholdStatus && !thresholdStatus.includes('Signing') && !thresholdStatus.includes('Executing') && (
              <div className="card fade-in">
                <p style={{ fontSize: 14 }}>{thresholdStatus}</p>
                {shareUrl && (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => copy(shareUrl)}>📋 Copy Share Link</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section D — Signer Activity History */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Activity History</h3>
        {historyLoading ? (
          <div className="stack">
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="skeleton-shimmer" style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: '70%', borderRadius: 4, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ height: 12, width: '40%', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : signerHistory.length === 0 ? (
          <p className="text-muted text-sm" style={{ textAlign: 'center', padding: 12 }}>No signer changes yet</p>
        ) : (
          <div className="stack">
            {signerHistory.map((event, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < signerHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {event.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{event.description}</p>
                  <p className="text-muted text-xs">{event.timeAgo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
