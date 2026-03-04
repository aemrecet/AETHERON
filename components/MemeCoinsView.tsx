import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Clock } from 'lucide-react';

type ChainTab = 'solana' | 'ethereum' | 'bsc' | 'new';

interface MemeCoin {
  symbol: string;
  name: string;
  chain: string;
  price: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  fdv: number;
  buys24h: number;
  sells24h: number;
  buys1h: number;
  sells1h: number;
  dex: string;
  pairAddress: string;
  pairCreatedAt: number;
  url: string;
  logo: string;
  address: string;
}

type SortKey = 'volume24h' | 'price' | 'priceChange24h' | 'priceChange1h' | 'marketCap' | 'liquidity' | 'pairCreatedAt';

const formatNum = (n: any, prefix = '$') => {
  const v = typeof n === 'number' ? n : parseFloat(n) || 0;
  if (!v && v !== 0) return `${prefix}0`;
  if (Math.abs(v) >= 1e12) return `${prefix}${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${prefix}${(v / 1e3).toFixed(1)}K`;
  return `${prefix}${v.toLocaleString()}`;
};

const formatPrice = (p: any) => {
  const n = typeof p === 'number' ? p : parseFloat(p) || 0;
  if (!n || isNaN(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  if (n >= 0.00000001) return `$${n.toFixed(8)}`;
  return `$${n.toExponential(2)}`;
};

const PctBadge: React.FC<{ value: number; className?: string }> = ({ value, className = '' }) => {
  const v = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  const color = v >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]';
  return <span className={`${color} tabular-nums font-mono font-semibold ${className}`}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>;
};

const timeAgo = (ts: number) => {
  if (!ts) return '--';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const CHAIN_TABS: { key: ChainTab; label: string }[] = [
  { key: 'solana', label: 'SOL' },
  { key: 'ethereum', label: 'ETH' },
  { key: 'bsc', label: 'BNB' },
  { key: 'new', label: 'NEW' },
];

const MiniChart: React.FC<{ coin: MemeCoin }> = ({ coin }) => {
  const chartUrl = `https://dexscreener.com/${coin.chain}/${coin.pairAddress}?embed=1&theme=dark&trades=0&info=0`;
  return (
    <div className="w-full h-[300px] rounded-lg overflow-hidden bg-[#111] border border-[#1e1e1e]">
      <iframe
        src={chartUrl}
        className="w-full h-full border-0"
        title={`${coin.symbol} chart`}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

interface MemeCoinsViewProps {
  onBack?: () => void;
}

export const MemeCoinsView: React.FC<MemeCoinsViewProps> = ({ onBack }) => {
  const [activeChain, setActiveChain] = useState<ChainTab>('solana');
  const [coins, setCoins] = useState<Record<ChainTab, MemeCoin[]>>({ solana: [], ethereum: [], bsc: [], new: [] });
  const [loading, setLoading] = useState<Record<ChainTab, boolean>>({ solana: true, ethereum: false, bsc: false, new: false });
  const [errors, setErrors] = useState<Record<ChainTab, string | null>>({ solana: null, ethereum: null, bsc: null, new: null });
  const [loaded, setLoaded] = useState<Set<ChainTab>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'volume24h', dir: 'desc' });
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const fetchChain = useCallback(async (chain: ChainTab) => {
    if (loaded.has(chain)) return;
    setLoading(prev => ({ ...prev, [chain]: true }));
    try {
      const url = chain === 'new' ? '/api/memecoins/new' : `/api/memecoins/${chain}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (Array.isArray(data)) {
        setCoins(prev => ({ ...prev, [chain]: data }));
      }
      setLoaded(prev => new Set(prev).add(chain));
      setErrors(prev => ({ ...prev, [chain]: null }));
    } catch (e) {
      console.error(`[MemeCoins] Failed to fetch ${chain}:`, e);
      setErrors(prev => ({ ...prev, [chain]: 'Failed to load data. Try again later.' }));
    } finally {
      setLoading(prev => ({ ...prev, [chain]: false }));
    }
  }, [loaded]);

  useEffect(() => {
    fetchChain(activeChain);
  }, [activeChain, fetchChain]);

  useEffect(() => {
    setPage(1);
  }, [activeChain, searchQuery, sortConfig]);

  const filteredCoins = useMemo(() => {
    let list = coins[activeChain] || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.symbol?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] || 0;
      const bVal = (b as any)[sortConfig.key] || 0;
      return sortConfig.dir === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return list;
  }, [coins, activeChain, searchQuery, sortConfig]);

  const paginatedCoins = useMemo(() => {
    return filteredCoins.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredCoins, page]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-[#555] opacity-50" />;
    return sortConfig.dir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#5a9aee]" />
      : <ArrowDown className="w-3 h-3 text-[#5a9aee]" />;
  };

  const totalCoins = filteredCoins.length;
  const totalVolume = filteredCoins.reduce((s, c) => s + (c.volume24h || 0), 0);
  const avgChange = filteredCoins.length > 0 ? filteredCoins.reduce((s, c) => s + (c.priceChange24h || 0), 0) / filteredCoins.length : 0;

  return (
    <div className="space-y-4 view-animate">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[#fff]">Meme Coins</h2>
          <p className="text-[12px] text-[#888] mt-0.5">Live from DexScreener</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></div>
            <span className="text-[10px] text-[#555]">Live</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {CHAIN_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveChain(tab.key)}
            className={`tab-btn ${activeChain === tab.key ? 'tab-btn-active' : ''} flex items-center gap-1.5`}
          >
            {tab.label}
            {coins[tab.key]?.length > 0 && (
              <span className="text-[10px] opacity-70 ml-0.5">({coins[tab.key].length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="card p-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">Tokens</p>
            <p className="text-[15px] font-semibold text-[#fff] tabular-nums font-mono">{totalCoins.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">24h Volume</p>
            <p className="text-[15px] font-semibold text-[#5a9aee] tabular-nums font-mono">{formatNum(totalVolume)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">Avg 24h Change</p>
            <PctBadge value={avgChange} className="text-[15px] font-semibold" />
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
        <input
          type="text"
          placeholder={`Search ${activeChain === 'new' ? 'new' : activeChain} meme coins...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg pl-11 pr-4 py-2 text-xs text-[#fff] focus:outline-none focus:ring-2 focus:ring-[#5a9aee]/20 transition-colors placeholder-[#555]"
        />
      </div>

      {loading[activeChain] ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#161616] border-t-[#5a9aee] rounded-full animate-spin"></div>
            <p className="text-[#555] text-[11px]">Loading {activeChain === 'new' ? 'new tokens' : `${activeChain} meme coins`}...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header" style={{ background: '#111217' }}>
                    <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium w-8">#</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium">Token</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none" onClick={() => handleSort('price')}>
                      <div className="flex items-center justify-end gap-1">Price {renderSortIcon('price')}</div>
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none hidden sm:table-cell" onClick={() => handleSort('priceChange1h')}>
                      <div className="flex items-center justify-end gap-1">1H {renderSortIcon('priceChange1h')}</div>
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none" onClick={() => handleSort('priceChange24h')}>
                      <div className="flex items-center justify-end gap-1">24H {renderSortIcon('priceChange24h')}</div>
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none" onClick={() => handleSort('volume24h')}>
                      <div className="flex items-center justify-end gap-1">Volume {renderSortIcon('volume24h')}</div>
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('liquidity')}>
                      <div className="flex items-center justify-end gap-1">Liq {renderSortIcon('liquidity')}</div>
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort('marketCap')}>
                      <div className="flex items-center justify-end gap-1">MCap {renderSortIcon('marketCap')}</div>
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium hidden lg:table-cell">Txns</th>
                    {activeChain === 'new' && (
                      <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort('pairCreatedAt')}>
                        <div className="flex items-center justify-end gap-1">Age {renderSortIcon('pairCreatedAt')}</div>
                      </th>
                    )}
                    <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#555] px-2 py-1.5 font-medium w-8">Dex</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCoins.map((coin, i) => {
                    const isExpanded = expandedCoin === `${coin.chain}-${coin.address}`;
                    return (
                      <React.Fragment key={`${coin.chain}-${coin.address}-${i}`}>
                        <tr
                          className="table-row table-row-stripe cursor-pointer"
                          onClick={() => setExpandedCoin(isExpanded ? null : `${coin.chain}-${coin.address}`)}
                        >
                          <td className="px-2 py-1.5 text-[11px] text-[#555] tabular-nums font-mono">{i + 1}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                              {coin.logo ? (
                                <img src={coin.logo} alt="" className="w-6 h-6 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#161616] border border-[#1e1e1e] flex items-center justify-center shrink-0">
                                  <span className="text-[8px] text-[#555] font-semibold">{(coin.symbol || '?').slice(0, 2)}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[12px] font-semibold text-[#fff] truncate max-w-[120px]">{coin.symbol}</div>
                                <div className="text-[10px] text-[#555] truncate max-w-[120px]">{coin.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right text-[11px] font-semibold text-[#fff] tabular-nums font-mono">{formatPrice(coin.price)}</td>
                          <td className="px-2 py-1.5 text-right hidden sm:table-cell">
                            <PctBadge value={coin.priceChange1h} className="text-[10px]" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <PctBadge value={coin.priceChange24h} className="text-[10px]" />
                          </td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-[#888] tabular-nums font-mono font-semibold">{formatNum(coin.volume24h)}</td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-[#888] tabular-nums font-mono hidden md:table-cell">{formatNum(coin.liquidity)}</td>
                          <td className="px-2 py-1.5 text-right text-[10px] text-[#888] tabular-nums font-mono hidden md:table-cell">{formatNum(coin.marketCap)}</td>
                          <td className="px-2 py-1.5 text-right hidden lg:table-cell">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-[#10b981] tabular-nums font-mono">{coin.buys24h || 0}</span>
                              <span className="text-[8px] text-[#333]">/</span>
                              <span className="text-[10px] text-[#ef4444] tabular-nums font-mono">{coin.sells24h || 0}</span>
                            </div>
                          </td>
                          {activeChain === 'new' && (
                            <td className="px-2 py-1.5 text-right text-[10px] text-[#555] hidden lg:table-cell">
                              <div className="flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3" />
                                {timeAgo(coin.pairCreatedAt)}
                              </div>
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-center">
                            <span className="text-[9px] text-[#555] bg-[#111] border border-[#1e1e1e] px-1.5 py-0.5 rounded-md">{(coin.dex || '').slice(0, 6)}</span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={11} className="px-2 py-2 bg-[#111]">
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-2 shadow-sm">
                                    <p className="text-[9px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">5m Change</p>
                                    <PctBadge value={coin.priceChange5m} className="text-[12px] font-semibold font-mono" />
                                  </div>
                                  <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-2 shadow-sm">
                                    <p className="text-[9px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">6h Change</p>
                                    <PctBadge value={coin.priceChange6h} className="text-[12px] font-semibold font-mono" />
                                  </div>
                                  <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-2 shadow-sm">
                                    <p className="text-[9px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">FDV</p>
                                    <p className="text-[12px] font-semibold text-[#fff] tabular-nums font-mono">{formatNum(coin.fdv)}</p>
                                  </div>
                                  <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-2 shadow-sm">
                                    <p className="text-[9px] uppercase tracking-[0.06em] text-[#555] font-medium mb-0.5">1h Txns</p>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[12px] font-semibold text-[#10b981] tabular-nums font-mono">{coin.buys1h || 0}</span>
                                      <span className="text-[10px] text-[#333]">/</span>
                                      <span className="text-[12px] font-semibold text-[#ef4444] tabular-nums font-mono">{coin.sells1h || 0}</span>
                                    </div>
                                  </div>
                                </div>
                                <MiniChart coin={coin} />
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-[#555]">{coin.dex}</span>
                                    <span className="text-[9px] text-[#333]">|</span>
                                    <span className="text-[9px] text-[#555]">{coin.chain}</span>
                                    {coin.pairCreatedAt > 0 && (
                                      <>
                                        <span className="text-[9px] text-[#333]">|</span>
                                        <span className="text-[9px] text-[#555]">{timeAgo(coin.pairCreatedAt)}</span>
                                      </>
                                    )}
                                  </div>
                                  <a
                                    href={coin.url || `https://dexscreener.com/${coin.chain}/${coin.pairAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-[11px] text-[#5a9aee] hover:text-[#5a9aee] transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    DexScreener
                                  </a>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {paginatedCoins.length < filteredCoins.length && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 bg-[#0d0d0d] hover:bg-[#111] border border-[#1e1e1e] rounded-lg text-[12px] font-medium text-[#888] hover:text-[#fff] transition-all shadow-sm"
            >
              Load More ({paginatedCoins.length} / {filteredCoins.length})
            </button>
          )}

          {errors[activeChain] && (
            <div className="text-center py-12">
              <p className="text-[#ef4444] text-sm">{errors[activeChain]}</p>
              <button onClick={() => { setLoaded(prev => { const n = new Set(prev); n.delete(activeChain); return n; }); fetchChain(activeChain); }} className="mt-3 px-4 py-2 bg-[#0d0d0d] hover:bg-[#111] border border-[#1e1e1e] rounded-lg text-[11px] text-[#888] transition-colors shadow-sm">Retry</button>
            </div>
          )}

          {filteredCoins.length === 0 && !loading[activeChain] && !errors[activeChain] && (
            <div className="text-center py-16">
              <p className="text-[#555] text-sm">No meme coins found</p>
              <p className="text-[#555] text-xs mt-1">Try a different search or chain</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
