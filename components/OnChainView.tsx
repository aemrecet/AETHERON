import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Wallet, ArrowUpRight, ArrowDownRight, ExternalLink, Copy, Check, Layers, Image, RefreshCw, Bell, BellRing, X, ChevronDown, ListFilter as Filter } from 'lucide-react';

type SubTab = 'wallet' | 'gas' | 'whales' | 'whale-alerts';

interface AlertRule {
  id: string;
  type: 'coin' | 'wallet';
  value: string;
  label: string;
  chain: string;
  minValue: number;
  enabled: boolean;
  createdAt: number;
}

interface WhaleTransaction {
  blockchain: string;
  chain: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  from: string;
  fromFull: string;
  fromType: string;
  fromLabel: string | null;
  to: string;
  toFull: string;
  toType: string;
  toLabel: string | null;
  hash: string;
  hashShort: string;
  timestamp: number;
  type: string;
  source: string;
}

interface CoinItem {
  symbol: string;
  name: string;
  chain: string;
}

interface WalletData {
  address: string;
  ethBalance: number;
  ethPrice: number;
  tokens: { name: string; symbol: string; contractAddress: string; balance: number; decimals: number }[];
  transactions: { hash: string; from: string; to: string; value: number; timeStamp: string; gasUsed: string; gasPrice: string; isError: string; methodId: string }[];
}

interface GasData {
  ethereum: { low: number; average: number; fast: number; baseFee: number } | null;
  bsc: { low: number; average: number; fast: number } | null;
  polygon: { low: number; average: number; fast: number } | null;
  lastUpdated: number;
}

interface TopWallet {
  label: string;
  address: string;
  ethBalance: number;
  category: string;
}

const cardClass = "card";

const formatNum = (n: any, prefix = '$') => {
  const v = typeof n === 'number' ? n : parseFloat(n) || 0;
  if (Math.abs(v) >= 1e12) return `${prefix}${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${prefix}${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return `${prefix}${v.toFixed(2)}`;
  if (v >= 0.001) return `${prefix}${v.toFixed(4)}`;
  return `${prefix}${v.toFixed(6)}`;
};

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const timeAgo = (ts: string | number) => {
  const diff = Date.now() - (typeof ts === 'string' ? parseInt(ts) * 1000 : ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-[#8b91a0] hover:text-[#4a4f5c] transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-[#0d9f6e]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const GasCard: React.FC<{ chain: string; icon: string; color: string; data: { low: number; average: number; fast: number; baseFee?: number } | null }> = ({ chain, icon, color, data }) => (
  <div className={`${cardClass} p-2`}>
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{icon}</span>
      <span className="text-[13px] font-bold text-[#0a0a23]">{chain}</span>
    </div>
    {data ? (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Slow</span>
          <span className="text-[13px] font-bold text-[#0d9f6e] tabular-nums font-mono">{data.low} Gwei</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Standard</span>
          <span className="text-[13px] font-bold text-[#f59e0b] tabular-nums font-mono">{data.average} Gwei</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Fast</span>
          <span className="text-[13px] font-bold text-[#dc2626] tabular-nums font-mono">{data.fast} Gwei</span>
        </div>
        {data.baseFee !== undefined && data.baseFee > 0 && (
          <div className="pt-1.5 border-t border-[#e2e5ea]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Base Fee</span>
              <span className="text-[12px] text-[#4a4f5c] tabular-nums font-mono">{data.baseFee} Gwei</span>
            </div>
          </div>
        )}
      </div>
    ) : (
      <p className="text-[12px] text-[#8b91a0]">Unavailable</p>
    )}
  </div>
);

const categoryColors: Record<string, string> = {
  exchange: '#f59e0b',
  defi: '#059669',
  whale: '#3b82f6',
  fund: '#059669',
  notable: '#ef4444',
};

const isSolanaAddress = (addr: string) => {
  if (addr.startsWith('0x')) return false;
  if (addr.length >= 32 && addr.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)) return true;
  return false;
};

export const OnChainView: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('whale-alerts');
  const [searchQuery, setSearchQuery] = useState('');
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [solWalletData, setSolWalletData] = useState<any>(null);
  const [nfts, setNfts] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [walletTab, setWalletTab] = useState<'tokens' | 'txns' | 'nfts'>('tokens');

  const [gasData, setGasData] = useState<GasData | null>(null);
  const [gasLoading, setGasLoading] = useState(false);

  const [topWallets, setTopWallets] = useState<TopWallet[]>([]);
  const [whalesLoading, setWhalesLoading] = useState(false);
  const [walletChainTab, setWalletChainTab] = useState<'ethereum' | 'solana'>('ethereum');

  const [whaleAlerts, setWhaleAlerts] = useState<WhaleTransaction[]>([]);
  const [whaleAlertsLoading, setWhaleAlertsLoading] = useState(false);
  const [whaleChainFilter, setWhaleChainFilter] = useState<'all' | 'ethereum' | 'solana'>('all');
  const [whaleCoinFilter, setWhaleCoinFilter] = useState('');
  const [whaleMinValue, setWhaleMinValue] = useState(50000);
  const [coinList, setCoinList] = useState<CoinItem[]>([]);
  const [coinSearchOpen, setCoinSearchOpen] = useState(false);
  const [coinSearchQuery, setCoinSearchQuery] = useState('');
  const [alertRules, setAlertRules] = useState<AlertRule[]>(() => {
    try { return JSON.parse(localStorage.getItem('aethron_whale_alerts') || '[]'); } catch { return []; }
  });
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [newAlertNotifs, setNewAlertNotifs] = useState(0);
  const seenTxIds = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const coinSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('aethron_whale_alerts', JSON.stringify(alertRules));
  }, [alertRules]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (coinSearchRef.current && !coinSearchRef.current.contains(e.target as Node)) {
        setCoinSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchWhaleAlerts = useCallback(async (chain?: string, coin?: string, minVal?: number) => {
    setWhaleAlertsLoading(true);
    try {
      const c = chain || whaleChainFilter;
      const co = coin !== undefined ? coin : whaleCoinFilter;
      const mv = minVal !== undefined ? minVal : whaleMinValue;
      const params = new URLSearchParams({ chain: c, minValue: mv.toString() });
      if (co) params.set('coin', co);
      const r = await fetch(`/api/onchain/whale-alerts?${params}`);
      const d = await r.json();
      setWhaleAlerts(d.transactions || []);
    } catch { }
    setWhaleAlertsLoading(false);
  }, [whaleChainFilter, whaleCoinFilter, whaleMinValue]);

  const fetchCoinList = useCallback(async () => {
    try {
      const r = await fetch('/api/onchain/coin-list');
      const d = await r.json();
      setCoinList(Array.isArray(d) ? d : []);
    } catch { }
  }, []);

  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    return perm;
  };

  const sendNotification = (title: string, body: string) => {
    if (notifPermission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', badge: '/favicon.ico' });
    }
  };

  const addAlertRule = (type: 'coin' | 'wallet', value: string, label: string, chain: string = 'all') => {
    const exists = alertRules.find(r => r.type === type && r.value === value);
    if (exists) return;
    const newRule: AlertRule = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      type, value, label, chain,
      minValue: whaleMinValue,
      enabled: true,
      createdAt: Date.now(),
    };
    setAlertRules(prev => [...prev, newRule]);
  };

  const removeAlertRule = (id: string) => {
    setAlertRules(prev => prev.filter(r => r.id !== id));
  };

  const toggleAlertRule = (id: string) => {
    setAlertRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  useEffect(() => {
    if (!alertsEnabled || alertRules.filter(r => r.enabled).length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const pollAlerts = async () => {
      const enabledRules = alertRules.filter(r => r.enabled);
      for (const rule of enabledRules) {
        try {
          const params = new URLSearchParams({ chain: rule.chain, minValue: rule.minValue.toString() });
          if (rule.type === 'coin') params.set('coin', rule.value);
          const r = await fetch(`/api/onchain/whale-alerts?${params}`);
          const d = await r.json();
          const txs = d.transactions || [];
          for (const tx of txs) {
            const txId = tx.hash || `${tx.timestamp}_${tx.symbol}_${tx.amountUsd}`;
            if (seenTxIds.current.has(txId)) continue;
            seenTxIds.current.add(txId);

            let matches = false;
            if (rule.type === 'coin' && tx.symbol === rule.value) matches = true;
            if (rule.type === 'wallet') {
              const addr = rule.value.toLowerCase();
              if (tx.fromFull?.toLowerCase().includes(addr) || tx.toFull?.toLowerCase().includes(addr) ||
                  tx.from?.toLowerCase().includes(addr) || tx.to?.toLowerCase().includes(addr)) {
                matches = true;
              }
            }

            if (matches && tx.amountUsd >= rule.minValue) {
              setNewAlertNotifs(prev => prev + 1);
              sendNotification(
                `Whale Alert: ${tx.symbol}`,
                `${formatNum(tx.amountUsd)} moved on ${tx.blockchain}. ${tx.fromLabel || tx.from} → ${tx.toLabel || tx.to}`
              );
            }
          }
        } catch { }
      }
    };

    pollAlerts();
    pollIntervalRef.current = setInterval(pollAlerts, 45000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [alertsEnabled, alertRules]);

  const fetchGas = useCallback(async () => {
    setGasLoading(true);
    try {
      const r = await fetch('/api/onchain/gas');
      const d = await r.json();
      setGasData(d);
    } catch { }
    setGasLoading(false);
  }, []);

  const fetchTopWallets = useCallback(async () => {
    setWhalesLoading(true);
    try {
      const r = await fetch('/api/onchain/top-wallets');
      const d = await r.json();
      if (Array.isArray(d)) setTopWallets(d);
    } catch { }
    setWhalesLoading(false);
  }, []);

  useEffect(() => {
    if (subTab === 'gas' && !gasData) fetchGas();
    if (subTab === 'whales' && topWallets.length === 0) fetchTopWallets();
    if (subTab === 'whale-alerts' && whaleAlerts.length === 0) {
      fetchWhaleAlerts();
      if (coinList.length === 0) fetchCoinList();
    }
  }, [subTab]);

  const lookupWallet = async () => {
    const addr = searchQuery.trim();
    if (!addr) return;

    const isSol = isSolanaAddress(addr);
    const isEth = addr.startsWith('0x') && addr.length === 42;

    if (!isSol && !isEth) {
      setWalletError('Enter a valid Ethereum (0x...) or Solana address');
      return;
    }

    setWalletLoading(true);
    setWalletError('');
    setWalletData(null);
    setSolWalletData(null);
    setNfts([]);

    if (isSol) {
      try {
        const resp = await fetch(`/api/onchain/solana-wallet/${addr}`);
        const data = await resp.json();
        if (data.error) {
          setWalletError(data.error);
        } else {
          setSolWalletData(data);
        }
      } catch {
        setWalletError('Failed to fetch Solana wallet data');
      }
    } else {
      try {
        const [walletRes, nftRes] = await Promise.all([
          fetch(`/api/onchain/wallet/${addr}`),
          fetch(`/api/onchain/nfts/${addr}`)
        ]);
        const wData = await walletRes.json();
        const nData = await nftRes.json();
        if (wData.error) {
          setWalletError(wData.error);
        } else {
          setWalletData(wData);
        }
        if (nData.nfts) setNfts(nData.nfts);
      } catch {
        setWalletError('Failed to fetch wallet data');
      }
    }
    setWalletLoading(false);
  };

  const renderWalletSearch = () => (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b91a0]" />
          <input
            type="text"
            placeholder="Enter Ethereum (0x...) or Solana address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupWallet()}
            className="w-full bg-[#fff] border border-[#e2e5ea] rounded-[4px] pl-8 pr-3 py-2 text-[12px] text-[#0a0a23] focus:outline-none focus:border-[#2762bc] focus:ring-1 focus:ring-[#2762bc] transition-colors placeholder-[#555]"
          />
        </div>
        <button
          onClick={lookupWallet}
          disabled={walletLoading}
          className="px-4 py-2 bg-[#2762bc] hover:bg-[#3578d8] text-[#0a0a23] text-[12px] font-semibold rounded-[4px] transition-colors disabled:opacity-50"
        >
          {walletLoading ? 'Loading...' : 'Lookup'}
        </button>
      </div>

      {walletError && (
        <div className={`${cardClass} p-3`}>
          <p className="text-[#dc2626] text-[12px]">{walletError}</p>
        </div>
      )}

      {walletLoading && (
        <div className="flex items-center justify-center py-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-[#e2e5ea] border-t-[#5a9aee] rounded-full animate-spin"></div>
            <p className="text-[#8b91a0] text-[11px]">Scanning blockchain...</p>
          </div>
        </div>
      )}

      {walletData && !walletLoading && (
        <div className="space-y-3">
          <div className={`${cardClass} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[4px] bg-[#f4f5f7] flex items-center justify-center border border-[#e2e5ea]">
                  <Wallet className="w-4 h-4 text-[#1a6bdb]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-[#0a0a23]">{shortAddr(walletData.address)}</span>
                    <CopyButton text={walletData.address} />
                  </div>
                  <p className="text-[10px] text-[#8b91a0] font-mono">{walletData.address}</p>
                </div>
              </div>
              <a
                href={`https://etherscan.io/address/${walletData.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1a6bdb] hover:text-[#4a4f5c] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-0.5">ETH Balance</p>
                <p className="text-[16px] font-bold text-[#1a6bdb] tabular-nums font-mono">{walletData.ethBalance.toFixed(4)}</p>
                <p className="text-[10px] text-[#4a4f5c] font-mono tabular-nums">{formatNum(walletData.ethBalance * (walletData.ethPrice || 0))}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-0.5">Tokens</p>
                <p className="text-[16px] font-bold text-[#0a0a23] tabular-nums font-mono">{walletData.tokens?.length || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-0.5">Transactions</p>
                <p className="text-[16px] font-bold text-[#0a0a23] tabular-nums font-mono">{walletData.transactions?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-0 border-b border-[#e2e5ea]">
            {(['tokens', 'txns', 'nfts'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setWalletTab(tab)}
                className={`tab-btn flex items-center gap-1.5 ${walletTab === tab ? 'tab-btn-active' : ''}`}
              >
                {tab === 'tokens' && <Layers className="w-3 h-3" />}
                {tab === 'txns' && <ArrowUpRight className="w-3 h-3" />}
                {tab === 'nfts' && <Image className="w-3 h-3" />}
                {tab === 'tokens' ? `Tokens (${walletData.tokens?.length || 0})` : tab === 'txns' ? `Transactions (${walletData.transactions?.length || 0})` : `NFTs (${nfts.length})`}
              </button>
            ))}
          </div>

          {walletTab === 'tokens' && (
            <div className={`${cardClass} overflow-hidden`}>
              <table className="w-full">
                <thead>
                  <tr className="table-header border-b border-[#e2e5ea]">
                    <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Token</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Balance</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 hidden sm:table-cell font-medium">Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {(walletData.tokens || []).slice(0, 50).map((token, i) => (
                    <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                      <td className="px-2 py-1.5">
                        <div>
                          <span className="text-[12px] font-semibold text-[#0a0a23]">{token.symbol || '???'}</span>
                          <span className="text-[10px] text-[#8b91a0] ml-2 hidden sm:inline">{token.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] tabular-nums font-mono">
                        {token.balance >= 1000 ? formatNum(token.balance, '') : token.balance.toFixed(4)}
                      </td>
                      <td className="px-2 py-1.5 text-right hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-[#8b91a0] font-mono">{shortAddr(token.contractAddress)}</span>
                          <CopyButton text={token.contractAddress} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(walletData.tokens || []).length === 0 && (
                    <tr><td colSpan={3} className="px-2 py-6 text-center text-[#8b91a0] text-[12px]">No tokens found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {walletTab === 'txns' && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header border-b border-[#e2e5ea]">
                      <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Hash</th>
                      <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 hidden sm:table-cell font-medium">From/To</th>
                      <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Value</th>
                      <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(walletData.transactions || []).map((tx, i) => {
                      const isOutgoing = tx.from?.toLowerCase() === walletData.address.toLowerCase();
                      return (
                        <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center ${isOutgoing ? 'bg-[rgba(255,59,59,0.1)]' : 'bg-[rgba(0,192,118,0.1)]'}`}>
                                {isOutgoing ? <ArrowUpRight className="w-3 h-3 text-[#dc2626]" /> : <ArrowDownRight className="w-3 h-3 text-[#0d9f6e]" />}
                              </div>
                              <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-[#1a6bdb] hover:text-[#4a4f5c] transition-colors">
                                {shortAddr(tx.hash)}
                              </a>
                              {tx.isError === '1' && <span className="text-[8px] bg-[rgba(255,59,59,0.1)] text-[#dc2626] px-1.5 py-0.5 rounded-full font-bold">FAIL</span>}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 hidden sm:table-cell">
                            <div className="text-[10px] text-[#4a4f5c] font-mono">
                              {isOutgoing ? `To: ${shortAddr(tx.to)}` : `From: ${shortAddr(tx.from)}`}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <span className={`text-[12px] font-bold tabular-nums font-mono ${isOutgoing ? 'text-[#dc2626]' : 'text-[#0d9f6e]'}`}>
                              {isOutgoing ? '-' : '+'}{typeof tx.value === 'number' ? tx.value.toFixed(4) : parseFloat(String(tx.value || '0')).toFixed(4)} ETH
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-[#8b91a0] font-mono tabular-nums">{timeAgo(tx.timeStamp)}</td>
                        </tr>
                      );
                    })}
                    {(walletData.transactions || []).length === 0 && (
                      <tr><td colSpan={4} className="px-2 py-6 text-center text-[#8b91a0] text-[12px]">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {walletTab === 'nfts' && (
            <div className={`${cardClass} overflow-hidden`}>
              {nfts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3">
                  {nfts.slice(0, 40).map((nft, i) => (
                    <div key={i} className="bg-[#f4f5f7] border border-[#e2e5ea] rounded-[4px] p-2">
                      <div className="w-full aspect-square rounded-[4px] bg-[#fff] flex items-center justify-center mb-1.5 border border-[#e2e5ea]">
                        <Image className="w-6 h-6 text-[#c8cdd5]" />
                      </div>
                      <p className="text-[10px] font-semibold text-[#0a0a23] truncate">{nft.tokenName || 'Unknown'}</p>
                      <p className="text-[9px] text-[#8b91a0] font-mono">#{nft.tokenId?.slice(0, 8)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-6 text-center text-[#8b91a0] text-[12px]">No NFTs found</div>
              )}
            </div>
          )}
        </div>
      )}

      {solWalletData && !walletLoading && (
        <div className="space-y-3">
          <div className={`${cardClass} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[4px] bg-[#f4f5f7] flex items-center justify-center border border-[#e2e5ea]">
                  <span className="text-[10px] font-bold font-mono text-[#4a4f5c]">SOL</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-mono text-[#0a0a23]">{shortAddr(solWalletData.address)}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f4f5f7] text-[#4a4f5c] font-bold border border-[#e2e5ea]">SOLANA</span>
                    <CopyButton text={solWalletData.address} />
                  </div>
                  <p className="text-[10px] text-[#8b91a0] font-mono">{solWalletData.address}</p>
                </div>
              </div>
              <a
                href={`https://solscan.io/account/${solWalletData.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4a4f5c] hover:text-[#4a4f5c] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-0.5">SOL Balance</p>
                <p className="text-[16px] font-bold text-[#4a4f5c] tabular-nums font-mono">{solWalletData.solBalance?.toFixed(4)}</p>
                <p className="text-[10px] text-[#4a4f5c] font-mono tabular-nums">{formatNum(solWalletData.solBalance * (solWalletData.solPrice || 0))}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-0.5">SPL Tokens</p>
                <p className="text-[16px] font-bold text-[#0a0a23] tabular-nums font-mono">{solWalletData.tokens?.length || 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-0.5">Transactions</p>
                <p className="text-[16px] font-bold text-[#0a0a23] tabular-nums font-mono">{solWalletData.transactions?.length || 0}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-0 border-b border-[#e2e5ea]">
            {(['tokens', 'txns'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setWalletTab(tab)}
                className={`tab-btn flex items-center gap-1.5 ${walletTab === tab ? 'tab-btn-active' : ''}`}
              >
                {tab === 'tokens' && <Layers className="w-3 h-3" />}
                {tab === 'txns' && <ArrowUpRight className="w-3 h-3" />}
                {tab === 'tokens' ? `Tokens (${solWalletData.tokens?.length || 0})` : `Transactions (${solWalletData.transactions?.length || 0})`}
              </button>
            ))}
          </div>

          {walletTab === 'tokens' && (
            <div className={`${cardClass} overflow-hidden`}>
              <table className="w-full">
                <thead>
                  <tr className="table-header border-b border-[#e2e5ea]">
                    <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Token Mint</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Balance</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 hidden sm:table-cell font-medium">Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {(solWalletData.tokens || []).map((token: any, i: number) => (
                    <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-mono text-[#0a0a23]">{shortAddr(token.mint)}</span>
                          <CopyButton text={token.mint} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] tabular-nums font-mono">
                        {token.balance >= 1000 ? formatNum(token.balance, '') : token.balance.toFixed(4)}
                      </td>
                      <td className="px-2 py-1.5 text-right hidden sm:table-cell">
                        <a href={`https://solscan.io/token/${token.mint}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#4a4f5c] hover:text-[#4a4f5c] transition-colors">
                          Solscan
                        </a>
                      </td>
                    </tr>
                  ))}
                  {(solWalletData.tokens || []).length === 0 && (
                    <tr><td colSpan={3} className="px-2 py-6 text-center text-[#8b91a0] text-[12px]">No SPL tokens found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {walletTab === 'txns' && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header border-b border-[#e2e5ea]">
                      <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Signature</th>
                      <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 hidden sm:table-cell font-medium">Slot</th>
                      <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Status</th>
                      <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(solWalletData.transactions || []).map((tx: any, i: number) => (
                      <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                        <td className="px-2 py-1.5">
                          <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-[#4a4f5c] hover:text-[#4a4f5c] transition-colors">
                            {shortAddr(tx.signature)}
                          </a>
                        </td>
                        <td className="px-2 py-1.5 text-right hidden sm:table-cell">
                          <span className="text-[11px] text-[#4a4f5c] tabular-nums font-mono">{tx.slot?.toLocaleString()}</span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {tx.err ? (
                            <span className="text-[9px] bg-[rgba(255,59,59,0.1)] text-[#dc2626] px-2 py-0.5 rounded-full font-bold">FAIL</span>
                          ) : (
                            <span className="text-[9px] bg-[rgba(0,192,118,0.1)] text-[#0d9f6e] px-2 py-0.5 rounded-full font-bold">OK</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[10px] text-[#8b91a0] font-mono tabular-nums">{tx.blockTime ? timeAgo(String(tx.blockTime)) : '-'}</td>
                      </tr>
                    ))}
                    {(solWalletData.transactions || []).length === 0 && (
                      <tr><td colSpan={4} className="px-2 py-6 text-center text-[#8b91a0] text-[12px]">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderGasTracker = () => {
    const ethAvgGas = gasData?.ethereum?.average || 0;
    const ethPrice = 3200;

    const txTypes = [
      { label: 'Simple Transfer', gasUnits: 21000 },
      { label: 'ERC-20 Transfer', gasUnits: 65000 },
      { label: 'Uniswap Swap', gasUnits: 150000 },
      { label: 'NFT Mint', gasUnits: 250000 },
    ];

    const estimateCostUsd = (gasUnits: number, gasPriceGwei: number) => {
      const costEth = (gasUnits * gasPriceGwei) / 1e9;
      return costEth * ethPrice;
    };

    const solanaStaticData = { low: 0.000005, average: 0.000005, fast: 0.000005 };
    const avalancheStaticData = { low: 25, average: 25, fast: 27 };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-[#0a0a23]">Multi-Chain Gas Tracker</h3>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Live gas prices across networks</p>
          </div>
          <button onClick={fetchGas} disabled={gasLoading} className="p-2 rounded-[4px] bg-[#f4f5f7] hover:bg-[#f4f5f7] transition-colors border border-[#e2e5ea]">
            <RefreshCw className={`w-4 h-4 text-[#4a4f5c] ${gasLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {gasLoading && !gasData ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#e2e5ea] border-t-[#5a9aee] rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <GasCard chain="Ethereum" icon="ETH" color="#3b82f6" data={gasData?.ethereum || null} />
              <GasCard chain="BNB Chain" icon="BNB" color="#f59e0b" data={gasData?.bsc || null} />
              <GasCard chain="Polygon" icon="MATIC" color="#a855f7" data={gasData?.polygon || null} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={`${cardClass} p-2`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ background: '#a855f720', color: '#a855f7' }}>SOL</span>
                  <span className="text-[13px] font-bold text-[#0a0a23]">Solana</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f4f5f7] text-[#4a4f5c] border border-[#e2e5ea]">AVG</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">TX Fee</span>
                    <span className="text-[13px] font-bold text-[#0d9f6e] tabular-nums font-mono">~0.000005 SOL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Priority Fee</span>
                    <span className="text-[13px] font-bold text-[#4a4f5c] tabular-nums font-mono">~0.00001 SOL</span>
                  </div>
                  <div className="pt-1.5 border-t border-[#e2e5ea]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Est. Cost</span>
                      <span className="text-[12px] text-[#4a4f5c] tabular-nums font-mono">~$0.002</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${cardClass} p-2`}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-bold font-mono text-[#0a0a23]">AVAX</span>
                  <span className="text-[13px] font-bold text-[#0a0a23]">Avalanche</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f4f5f7] text-[#4a4f5c] border border-[#e2e5ea]">AVG</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Gas Price</span>
                    <span className="text-[13px] font-bold text-[#dc2626] tabular-nums font-mono">25 nAVAX</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Simple TX</span>
                    <span className="text-[13px] font-bold text-[#f59e0b] tabular-nums font-mono">~0.000525 AVAX</span>
                  </div>
                  <div className="pt-1.5 border-t border-[#e2e5ea]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Est. Cost</span>
                      <span className="text-[12px] text-[#4a4f5c] tabular-nums font-mono">~$0.02</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {gasData?.lastUpdated && (
          <p className="text-[10px] text-[#8b91a0] text-right font-mono tabular-nums">
            Updated {timeAgo(gasData.lastUpdated)}
          </p>
        )}

        {ethAvgGas > 0 && (
          <div className={`${cardClass} p-3`}>
            <h4 className="text-[12px] font-bold text-[#0a0a23] mb-2">Estimated Transaction Costs (Ethereum)</h4>
            <p className="text-[10px] text-[#8b91a0] mb-2">Based on current standard gas price of <span className="font-mono tabular-nums">{ethAvgGas} Gwei</span> · ETH ≈ <span className="font-mono tabular-nums">${ethPrice.toLocaleString()}</span></p>
            <div className="space-y-2">
              {txTypes.map(tx => {
                const costUsd = estimateCostUsd(tx.gasUnits, ethAvgGas);
                const costGwei = tx.gasUnits * ethAvgGas;
                return (
                  <div key={tx.label} className="flex items-center justify-between py-1.5 border-b border-[#eef0f4] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#4a4f5c]">{tx.label}</span>
                      <span className="text-[9px] text-[#8b91a0] font-mono tabular-nums">{tx.gasUnits.toLocaleString()} gas</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#8b91a0] tabular-nums font-mono">{(costGwei / 1e9).toFixed(6)} ETH</span>
                      <span className="text-[12px] font-bold text-[#1a6bdb] tabular-nums font-mono">${costUsd.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`${cardClass} p-3`}>
          <h4 className="text-[12px] font-bold text-[#0a0a23] mb-2">Gas Price Guide</h4>
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[rgba(0,192,118,0.1)]"></div>
              <span className="text-[11px] text-[#4a4f5c]"><span className="text-[#0a0a23] font-semibold">Slow</span> - Typically confirms in 5-10 min, best for non-urgent transfers</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[rgba(245,166,35,0.1)]"></div>
              <span className="text-[11px] text-[#4a4f5c]"><span className="text-[#0a0a23] font-semibold">Standard</span> - Confirms in 1-3 min, recommended for most transactions</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[rgba(255,59,59,0.1)]"></div>
              <span className="text-[11px] text-[#4a4f5c]"><span className="text-[#0a0a23] font-semibold">Fast</span> - Next block confirmation, use for time-sensitive trades</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#e2e5ea] space-y-1.5">
            <p className="text-[10px] text-[#4a4f5c]">Gas = computational work required. More complex operations (swaps, mints) use more gas units.</p>
            <p className="text-[10px] text-[#4a4f5c]">EIP-1559: Base fee is burned, priority fee (tip) goes to validators. Total fee = (Base Fee + Priority Fee) x Gas Units.</p>
            <p className="text-[10px] text-[#4a4f5c]">L2 chains (Polygon, Arbitrum) and alt-L1s (Solana, Avalanche) offer significantly lower fees than Ethereum mainnet.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderWhaleAlerts = () => {
    const filteredCoins = coinList.filter(c =>
      c.symbol.toLowerCase().includes(coinSearchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(coinSearchQuery.toLowerCase())
    );

    const valueFilters = [
      { label: '$50K+', value: 50000 },
      { label: '$100K+', value: 100000 },
      { label: '$500K+', value: 500000 },
      { label: '$1M+', value: 1000000 },
      { label: '$5M+', value: 5000000 },
      { label: '$10M+', value: 10000000 },
    ];

    const enabledRules = alertRules.filter(r => r.enabled);

    return (
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-[#0a0a23] flex items-center gap-2">
              Whale Alerts
              <div className="w-1.5 h-1.5 rounded-full bg-[rgba(0,192,118,0.1)] animate-pulse"></div>
            </h3>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Track large crypto transactions across chains</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAlertPanel(!showAlertPanel); setNewAlertNotifs(0); }}
              className={`relative p-2 rounded-[4px] transition-all ${showAlertPanel ? 'bg-[#f4f5f7] text-[#1a6bdb] border border-[#e2e5ea]' : 'bg-[#f4f5f7] text-[#4a4f5c] hover:text-[#0a0a23] hover:bg-[#f4f5f7] border border-[#e2e5ea]'}`}
            >
              {alertsEnabled && enabledRules.length > 0 ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              {newAlertNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[rgba(255,59,59,0.1)] text-[8px] text-[#0a0a23] flex items-center justify-center font-bold">{newAlertNotifs > 9 ? '9+' : newAlertNotifs}</span>
              )}
            </button>
            <button
              onClick={() => fetchWhaleAlerts()}
              disabled={whaleAlertsLoading}
              className="p-2 rounded-[4px] bg-[#f4f5f7] hover:bg-[#f4f5f7] transition-colors border border-[#e2e5ea]"
            >
              <RefreshCw className={`w-4 h-4 text-[#4a4f5c] ${whaleAlertsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {showAlertPanel && (
          <div className={`${cardClass} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-[#0a0a23] flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-[#1a6bdb]" />
                Alert Rules
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (!alertsEnabled) {
                      const perm = await requestNotifPermission();
                      if (perm === 'granted') setAlertsEnabled(true);
                    } else {
                      setAlertsEnabled(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-[4px] text-[10px] font-semibold transition-all ${
                    alertsEnabled ? 'bg-[#f4f5f7] text-[#1a6bdb] border border-[#e2e5ea]' : 'bg-[#f4f5f7] text-[#4a4f5c] border border-[#e2e5ea]'
                  }`}
                >
                  {alertsEnabled ? 'Alerts ON' : 'Enable Alerts'}
                </button>
              </div>
            </div>

            {notifPermission === 'denied' && (
              <div className="bg-[rgba(255,59,59,0.1)] border border-[#e2e5ea] rounded-[4px] p-3 mb-3">
                <p className="text-[10px] text-[#dc2626]">Browser notifications are blocked. Please enable them in your browser settings.</p>
              </div>
            )}

            <div className="space-y-1.5 mb-3">
              {alertRules.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-[11px] text-[#8b91a0]">No alert rules yet</p>
                  <p className="text-[9px] text-[#8b91a0] mt-1">Search a coin or enter a wallet address below to add alerts</p>
                </div>
              ) : (
                alertRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between bg-[#f4f5f7] border border-[#e2e5ea] rounded-[4px] p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
                        rule.type === 'coin' ? 'bg-[rgba(245,166,35,0.1)] text-[#d97706] border border-[#e2e5ea]' : 'bg-[#f4f5f7] text-[#1a6bdb] border border-[#e2e5ea]'
                      }`}>{rule.type}</span>
                      <span className="text-[11px] font-semibold text-[#0a0a23] truncate">{rule.label}</span>
                      <span className="text-[9px] text-[#8b91a0] font-mono tabular-nums">{formatNum(rule.minValue)}+</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleAlertRule(rule.id)}
                        className={`w-8 h-4 rounded-full transition-all relative ${rule.enabled ? 'bg-[#2762bc]' : 'bg-[#3a3b45]'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-[#fff] transition-all ${rule.enabled ? 'left-[18px]' : 'left-0.5'}`}></div>
                      </button>
                      <button onClick={() => removeAlertRule(rule.id)} className="text-[#8b91a0] hover:text-[#dc2626] transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add wallet address to watch..."
                className="flex-1 bg-[#fff] border border-[#e2e5ea] rounded-[4px] px-3 py-2 text-[11px] text-[#0a0a23] placeholder-[#555] outline-none focus:border-[#2762bc] focus:ring-1 focus:ring-[#2762bc]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      addAlertRule('wallet', val, shortAddr(val), 'all');
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  if (whaleCoinFilter) {
                    addAlertRule('coin', whaleCoinFilter, whaleCoinFilter, whaleChainFilter);
                  }
                }}
                disabled={!whaleCoinFilter}
                className="px-3 py-2 rounded-[4px] text-[10px] font-semibold bg-[#f4f5f7] text-[#1a6bdb] border border-[#e2e5ea] hover:bg-[#f4f5f7] transition-all disabled:opacity-30"
              >
                + Watch {whaleCoinFilter || 'Coin'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(['all', 'ethereum', 'solana'] as const).map(c => (
              <button
                key={c}
                onClick={() => { setWhaleChainFilter(c); fetchWhaleAlerts(c); }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all flex items-center gap-1 ${
                  whaleChainFilter === c ? 'bg-[#f4f5f7] text-[#1a6bdb] border border-[#e2e5ea]' : 'bg-[#f4f5f7] text-[#8b91a0] hover:text-[#0a0a23] border border-[#e2e5ea]'
                }`}
              >
                {c === 'all' ? 'All Chains' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative" ref={coinSearchRef}>
            <button
              onClick={() => { setCoinSearchOpen(!coinSearchOpen); if (!coinSearchOpen) setCoinSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all flex items-center gap-1.5 ${
                whaleCoinFilter ? 'bg-[rgba(245,166,35,0.1)] text-[#d97706] border border-[#e2e5ea]' : 'bg-[#f4f5f7] text-[#8b91a0] hover:text-[#0a0a23] border border-[#e2e5ea]'
              }`}
            >
              <Search className="w-3 h-3" />
              {whaleCoinFilter || 'Search Coin'}
              {whaleCoinFilter && (
                <span
                  onClick={(e) => { e.stopPropagation(); setWhaleCoinFilter(''); fetchWhaleAlerts(undefined, ''); }}
                  className="ml-1 hover:text-[#0a0a23] cursor-pointer"
                >×</span>
              )}
              <ChevronDown className="w-3 h-3" />
            </button>

            {coinSearchOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[#fff] border border-[#e2e5ea] rounded-[4px] z-50 overflow-hidden">
                <div className="p-2 border-b border-[#e2e5ea]">
                  <input
                    type="text"
                    placeholder="Search coins..."
                    value={coinSearchQuery}
                    onChange={(e) => setCoinSearchQuery(e.target.value)}
                    className="w-full bg-[#f4f5f7] border border-[#e2e5ea] rounded-[4px] px-2.5 py-1.5 text-[11px] text-[#0a0a23] placeholder-[#555] outline-none focus:border-[#2762bc]"
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredCoins.map(c => (
                    <button
                      key={c.symbol}
                      onClick={() => {
                        setWhaleCoinFilter(c.symbol);
                        setCoinSearchOpen(false);
                        fetchWhaleAlerts(undefined, c.symbol);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#f4f5f7] transition-colors ${
                        whaleCoinFilter === c.symbol ? 'bg-[#f4f5f7]' : ''
                      }`}
                    >
                      <div>
                        <span className="text-[11px] font-semibold text-[#0a0a23]">{c.symbol}</span>
                        <span className="text-[10px] text-[#8b91a0] ml-1.5">{c.name}</span>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                        c.chain === 'solana' ? 'text-[#4a4f5c] bg-[#f4f5f7] border border-[#e2e5ea]' : c.chain === 'both' ? 'text-[#4a4f5c] bg-[#f4f5f7] border border-[#e2e5ea]' : 'text-[#1a6bdb] bg-[#f4f5f7] border border-[#e2e5ea]'
                      }`}>
                        {c.chain === 'both' ? 'MULTI' : c.chain.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-[#8b91a0]" />
            {valueFilters.map(f => (
              <button
                key={f.value}
                onClick={() => { setWhaleMinValue(f.value); fetchWhaleAlerts(undefined, undefined, f.value); }}
                className={`px-2 py-1 rounded-full text-[9px] font-semibold transition-all ${
                  whaleMinValue === f.value ? 'bg-[rgba(255,59,59,0.1)] text-[#dc2626] border border-[#e2e5ea]' : 'bg-[#f4f5f7] text-[#8b91a0] hover:text-[#0a0a23] border border-[#e2e5ea]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Transactions</span>
              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full text-[#d97706] bg-[rgba(245,166,35,0.1)] border border-[#e2e5ea]">{formatNum(whaleMinValue)}+</span>
              {whaleCoinFilter && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full text-[#1a6bdb] bg-[#f4f5f7] border border-[#e2e5ea]">{whaleCoinFilter}</span>}
            </div>
            <span className="text-[9px] text-[#8b91a0] font-mono tabular-nums">{whaleAlerts.length} txns</span>
          </div>

          {whaleAlertsLoading && whaleAlerts.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-[#e2e5ea] border-t-[#5a9aee] rounded-full animate-spin"></div>
                <p className="text-[#8b91a0] text-[11px]">Fetching whale transactions...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {whaleAlerts.map((w, i) => {
                const isExToEx = w.fromType === 'exchange' && w.toType === 'exchange';
                const isDeposit = w.toType === 'exchange' && w.fromType !== 'exchange';
                const isWithdraw = w.fromType === 'exchange' && w.toType !== 'exchange';
                const isKnown = w.fromType === 'known' || w.toType === 'known';
                const alertColor = w.amountUsd >= 10000000 ? '#ef4444' : w.amountUsd >= 1000000 ? '#f59e0b' : '#9ca3af';
                const isSol = w.chain === 'solana' || w.blockchain === 'solana';
                const txTimeAgo = (() => {
                  const diff = Math.floor(Date.now() / 1000) - w.timestamp;
                  if (diff < 60) return `${diff}s ago`;
                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                  return `${Math.floor(diff / 86400)}d ago`;
                })();

                return (
                  <div key={i} className="bg-[#f4f5f7] border border-[#e2e5ea] rounded-[4px] p-2 hover:bg-[#eef0f4] transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: alertColor }}></div>
                        <span className="text-[12px] font-bold text-[#0a0a23]">{w.symbol}</span>
                        <span className={`text-[8px] px-1 py-0.5 rounded-full ${isSol ? 'text-[#4a4f5c] bg-[#f4f5f7] border border-[#e2e5ea]' : 'text-[#1a6bdb] bg-[#f4f5f7] border border-[#e2e5ea]'}`}>
                          {isSol ? 'SOL' : w.blockchain?.toUpperCase().slice(0, 3)}
                        </span>
                        <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${
                          isDeposit ? 'text-[#dc2626] bg-[rgba(255,59,59,0.1)] border border-[#e2e5ea]' :
                          isWithdraw ? 'text-[#0d9f6e] bg-[rgba(0,192,118,0.1)] border border-[#e2e5ea]' :
                          isExToEx ? 'text-[#1a6bdb] bg-[#f4f5f7] border border-[#e2e5ea]' :
                          isKnown ? 'text-[#d97706] bg-[rgba(245,166,35,0.1)] border border-[#e2e5ea]' :
                          'text-[#8b91a0] bg-[#f4f5f7] border border-[#e2e5ea]'
                        }`}>
                          {isDeposit ? 'Deposit' : isWithdraw ? 'Withdraw' : isExToEx ? 'Exchange' : isKnown ? 'Whale' : w.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold tabular-nums font-mono" style={{ color: alertColor }}>{formatNum(w.amountUsd)}</span>
                        <button
                          onClick={() => addAlertRule('coin', w.symbol, w.symbol, isSol ? 'solana' : 'all')}
                          className="text-[#8b91a0] hover:text-[#4a4f5c] transition-colors"
                          title={`Watch ${w.symbol}`}
                        >
                          <Bell className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[9px] text-[#8b91a0] min-w-0 flex-1 truncate">
                        <span className={w.fromType === 'exchange' ? 'text-[#f59e0b]' : w.fromLabel ? 'text-[#1a6bdb]' : ''}>
                          {w.fromLabel || w.from}
                        </span>
                        <span className="text-[#c8cdd5] mx-1">→</span>
                        <span className={w.toType === 'exchange' ? 'text-[#f59e0b]' : w.toLabel ? 'text-[#1a6bdb]' : ''}>
                          {w.toLabel || w.to}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-[#8b91a0] font-mono tabular-nums">{w.amount?.toLocaleString()} {w.symbol}</span>
                        <span className="text-[8px] text-[#8b91a0] font-mono tabular-nums">{txTimeAgo}</span>
                      </div>
                    </div>
                    {w.hash && (
                      <div className="mt-1">
                        <a
                          href={isSol ? `https://solscan.io/tx/${w.hash}` : `https://etherscan.io/tx/${w.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[8px] font-mono text-[#1a6bdb] hover:text-[#4a4f5c] transition-colors"
                        >
                          {w.hashShort || w.hash?.substring(0, 20) + '...'}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTopWallets = () => {
    const solanaWallets = [
      { label: 'Solana Foundation', address: 'GK2zqS...', category: 'notable', solBalance: 1250000 },
      { label: 'Jupiter Exchange', address: 'JUP6LK...', category: 'defi', solBalance: 890000 },
      { label: 'Raydium', address: '7YttLk...', category: 'defi', solBalance: 650000 },
      { label: 'Marinade Finance', address: 'MarBmk...', category: 'defi', solBalance: 520000 },
      { label: 'Phantom Treasury', address: 'Phntm...', category: 'notable', solBalance: 380000 },
      { label: 'Magic Eden', address: 'MEisEi...', category: 'notable', solBalance: 290000 },
      { label: 'Jito Labs', address: 'JitoLa...', category: 'defi', solBalance: 245000 },
      { label: 'Tensor', address: 'TSSwap...', category: 'notable', solBalance: 180000 },
      { label: 'Drift Protocol', address: 'dRifty...', category: 'defi', solBalance: 155000 },
      { label: 'Orca', address: 'orcaEK...', category: 'defi', solBalance: 120000 },
    ];

    const isContract = (w: TopWallet) => {
      const contractLabels = ['uniswap', 'weth', 'contract', 'router', 'factory'];
      return w.ethBalance === 0 && contractLabels.some(cl => w.label.toLowerCase().includes(cl));
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-[#0a0a23]">Top Wallets</h3>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Notable addresses across chains</p>
          </div>
          {walletChainTab === 'ethereum' && (
            <button onClick={fetchTopWallets} disabled={whalesLoading} className="p-2 rounded-[4px] bg-[#f4f5f7] hover:bg-[#f4f5f7] transition-colors border border-[#e2e5ea]">
              <RefreshCw className={`w-4 h-4 text-[#4a4f5c] ${whalesLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="flex gap-0 border-b border-[#e2e5ea]">
          {(['ethereum', 'solana'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setWalletChainTab(tab)}
              className={`tab-btn flex items-center gap-1.5 ${walletChainTab === tab ? 'tab-btn-active' : ''}`}
            >
              <span className="text-[10px] font-bold font-mono">{tab === 'ethereum' ? 'ETH' : 'SOL'}</span>
              {tab === 'ethereum' ? 'Ethereum' : 'Solana'}
            </button>
          ))}
        </div>

        {walletChainTab === 'ethereum' && (
          <>
            {whalesLoading && topWallets.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#e2e5ea] border-t-[#5a9aee] rounded-full animate-spin"></div>
                  <p className="text-[#8b91a0] text-[11px]">Fetching wallet balances...</p>
                </div>
              </div>
            ) : (
              <div className={`${cardClass} overflow-hidden`}>
                <table className="w-full">
                  <thead>
                    <tr className="table-header border-b border-[#e2e5ea]">
                      <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">#</th>
                      <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Wallet</th>
                      <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 hidden sm:table-cell font-medium">Category</th>
                      <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">ETH Balance</th>
                      <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 w-10 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {topWallets.map((w, i) => (
                      <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4] cursor-pointer" onClick={() => { setSearchQuery(w.address); setSubTab('wallet'); }}>
                        <td className="px-2 py-1.5 text-[11px] text-[#8b91a0] tabular-nums font-mono">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <div>
                            <p className="text-[12px] font-semibold text-[#0a0a23]">{w.label}</p>
                            <p className="text-[10px] text-[#8b91a0] font-mono">{shortAddr(w.address)}</p>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 hidden sm:table-cell">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${categoryColors[w.category] || '#9ca3af'}15`, color: categoryColors[w.category] || '#9ca3af' }}>
                            {w.category.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {isContract(w) ? (
                            <span className="text-[11px] text-[#8b91a0] italic">Contract</span>
                          ) : w.ethBalance === 0 ? (
                            <span className="text-[11px] text-[#8b91a0]">N/A</span>
                          ) : (
                            <span className="text-[12px] font-bold text-[#1a6bdb] tabular-nums font-mono">{w.ethBalance >= 1000 ? formatNum(w.ethBalance, '') : w.ethBalance.toFixed(2)} ETH</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <a href={`https://etherscan.io/address/${w.address}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#8b91a0] hover:text-[#4a4f5c] transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {walletChainTab === 'solana' && (
          <div className={`${cardClass} overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr className="table-header border-b border-[#e2e5ea]">
                  <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">#</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Wallet</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 hidden sm:table-cell font-medium">Category</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">SOL Balance</th>
                  <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 w-10 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {solanaWallets.map((w, i) => (
                  <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                    <td className="px-2 py-1.5 text-[11px] text-[#8b91a0] tabular-nums font-mono">{i + 1}</td>
                    <td className="px-2 py-1.5">
                      <div>
                        <p className="text-[12px] font-semibold text-[#0a0a23]">{w.label}</p>
                        <p className="text-[10px] text-[#8b91a0] font-mono">{w.address}</p>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 hidden sm:table-cell">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${categoryColors[w.category] || '#9ca3af'}15`, color: categoryColors[w.category] || '#9ca3af' }}>
                        {w.category.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="text-[12px] font-bold text-[#4a4f5c] tabular-nums font-mono">{formatNum(w.solBalance, '')} SOL</span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#8b91a0] hover:text-[#4a4f5c] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-[#e2e5ea]">
              <p className="text-[9px] text-[#8b91a0]">Solana wallet balances are estimated averages and not live data</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 view-animate">
      <div className="card p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#4a4f5c] font-semibold">On-Chain Intelligence</p>
            <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#0a0a23] tracking-[-0.02em] mt-1">Whale, Gas & Wallet Command</h2>
          </div>
          <span className="badge badge-accent text-[10px] uppercase tracking-[0.06em]">Realtime Monitor</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-[4px] border border-[#e2e5ea] bg-[#f8f9fa] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Alerts</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{alertRules.length}</p>
          </div>
          <div className="rounded-[4px] border border-[#e2e5ea] bg-[#f8f9fa] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Top Wallets</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{topWallets.length}</p>
          </div>
          <div className="rounded-[4px] border border-[#e2e5ea] bg-[#f8f9fa] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Flow Events</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{whaleAlerts.length}</p>
          </div>
        </div>
      </div>

      <div className="card p-1.5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {[
          { key: 'whale-alerts' as SubTab, label: 'Whale Alerts' },
          { key: 'whales' as SubTab, label: 'Top Wallets' },
          { key: 'wallet' as SubTab, label: 'Wallet Lookup' },
          { key: 'gas' as SubTab, label: 'Gas Tracker' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`tab-btn ${subTab === tab.key ? 'tab-btn-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {subTab === 'wallet' && renderWalletSearch()}
      {subTab === 'gas' && renderGasTracker()}
      {subTab === 'whale-alerts' && renderWhaleAlerts()}
      {subTab === 'whales' && renderTopWallets()}
    </div>
  );
};
