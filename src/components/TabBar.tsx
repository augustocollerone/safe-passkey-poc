interface Props {
  activeTab: 'wallet' | 'signers' | 'settings';
}

export default function TabBar({ activeTab }: Props) {
  const tabs = [
    { id: 'wallet' as const, label: 'Wallet', icon: '💰', hash: '#/' },
    { id: 'signers' as const, label: 'Signers', icon: '👥', hash: '#/signers' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙️', hash: '#/settings' },
  ];

  return (
    <nav className="tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-bar-item${activeTab === tab.id ? ' tab-bar-item-active' : ''}`}
          onClick={() => { window.location.hash = tab.hash; }}
        >
          <span className="tab-bar-icon">{tab.icon}</span>
          <span className="tab-bar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
