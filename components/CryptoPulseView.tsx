import React, { useEffect, useState, useCallback, useRef } from 'react';

const API_BASE = '';

type SubTab = 'overview' | 'spot' | 'derivatives' | 'btc-treasuries' | 'cryptocurrencies';

const fetchJSON = async (url: string, fallback: any = {}) => {
  try {
    const r = await fetch(`${API_BASE}${url}`);
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } catch { return fallback; }
};

const formatNum = (val: any, prefix = '$') => {
  const n = typeof val === 'number' ? val : parseFloat(val) || 0;
  if (!n && n !== 0) return `${prefix}0`;
  if (Math.abs(n) >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${prefix}${(n / 1e3).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString()}`;
};

const formatBtc = (val: any) => {
  const n = typeof val === 'number' ? val : parseFloat(val) || 0;
  if (!n && n !== 0) return '0 BTC';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M BTC`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K BTC`;
  return `${n.toFixed(2)} BTC`;
};

const formatPrice = (p: any) => {
  const n = typeof p === 'number' ? p : parseFloat(p);
  if (!n && n !== 0 || isNaN(n)) return '$0';
  if (n >= 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

const PctChange: React.FC<{ value: any; className?: string }> = ({ value, className = '' }) => {
  const v = typeof value === 'number' ? value : parseFloat(value) || 0;
  const color = v >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]';
  return <span className={`${color} font-mono tabular-nums ${className}`}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>;
};

const FearGreedGauge: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const v = Math.max(0, Math.min(100, value || 50));
  const angle = -90 + (v / 100) * 180;
  const getColor = (val: number) => {
    if (val <= 24) return '#ef4444';
    if (val <= 44) return '#f59e0b';
    if (val <= 55) return '#6b7280';
    if (val <= 74) return '#059669';
    return '#059669';
  };
  const color = getColor(v);
  const r = 60;
  const cx = 100;
  const cy = 80;
  const needleAngle = (angle * Math.PI) / 180;
  const nx = cx + (r - 8) * Math.cos(needleAngle);
  const ny = cy + (r - 8) * Math.sin(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="100" viewBox="0 0 200 130">
        <defs>
          <linearGradient id="fgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#6b7280" />
            <stop offset="75%" stopColor="#059669" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#fgGrad)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill={color} />
        <text x={cx - r} y={cy + 14} textAnchor="start" fill="#8b91a0" fontSize="9" fontFamily="IBM Plex Mono, monospace">0</text>
        <text x={cx + r} y={cy + 14} textAnchor="end" fill="#8b91a0" fontSize="9" fontFamily="IBM Plex Mono, monospace">100</text>
        <text x={cx} y={cy + 24} textAnchor="middle" fill="#0a0a23" fontSize="26" fontWeight="bold" fontFamily="IBM Plex Mono, monospace">{v}</text>
        <text x={cx} y={cy + 40} textAnchor="middle" fill={color} fontSize="11" fontWeight="600" fontFamily="Inter, sans-serif">{label}</text>
      </svg>
    </div>
  );
};

const Sparkline: React.FC<{ data: number[]; color?: string; width?: number; height?: number }> = ({ data, color = '#2563eb', width = 160, height = 32 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

const LoadingSpinner: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-[#e2e5ea] border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-[#8b91a0] text-[11px]">{text}</p>
    </div>
  </div>
);

const cardClass = "card";
const innerCardClass = "card";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'spot', label: 'Spot' },
  { key: 'derivatives', label: 'Derivatives' },
  { key: 'btc-treasuries', label: 'BTC Treasuries' },
  { key: 'cryptocurrencies', label: 'Cryptocurrencies' },
];

const OverviewTab: React.FC = () => {
  const [marketStats, setMarketStats] = useState<any>(null);
  const [fearGreed, setFearGreed] = useState<any>(null);
  const [trending, setTrending] = useState<any>({ coins: [], categories: [] });
  const [feed, setFeed] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [ms, fg, tr, fd] = await Promise.all([
      fetchJSON('/api/pulse/market-stats', null),
      fetchJSON('/api/pulse/fear-greed', null),
      fetchJSON('/api/pulse/trending', { coins: [], categories: [] }),
      fetchJSON('/api/pulse/feed', []),
    ]);
    setMarketStats(ms);
    setFearGreed(fg);
    setTrending(tr);
    setFeed(Array.isArray(fd) ? fd : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <LoadingSpinner text="Loading market overview..." />;

  const filters = ['All', 'BTC Tracker', 'Project', 'Funding', 'X Highlight', 'Regulation', 'Token', 'General'];
  const filteredFeed = activeFilter === 'All' ? feed : feed.filter((a: any) => a.category === activeFilter);

  const btcDom = marketStats?.btcDominance || 0;
  const ethDom = marketStats?.ethDominance || 0;
  const otherDom = Math.max(0, 100 - btcDom - ethDom);
  const isBitcoinSeason = btcDom >= 55;
  const altSeasonIndex = Math.max(0, Math.min(100, Math.round(100 - btcDom)));

  const dominanceBreakdown = marketStats?.dominanceBreakdown || [];

  return (
    <div className="space-y-3">
      {marketStats && (
        <div className={`${cardClass} p-3`}>
          <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Market Cap</span>
              <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatNum(marketStats.totalMarketCap)}</span>
              <PctChange value={marketStats.marketCapChange24h} className="text-[11px] font-semibold" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">24H Vol</span>
              <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatNum(marketStats.totalVolume24h)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">BTC Dom</span>
              <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{btcDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Active</span>
              <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{(marketStats.activeCryptos || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Fear & Greed Index</p>
          {fearGreed?.current ? (
            <>
              <FearGreedGauge value={fearGreed.current.value} label={fearGreed.current.label} />
              {fearGreed.history && fearGreed.history.length > 1 && (
                <div className="mt-3">
                  <p className="text-[9px] text-[#8b91a0] mb-1">30-Day Trend</p>
                  <Sparkline data={fearGreed.history.map((h: any) => h.value)} />
                </div>
              )}
            </>
          ) : (
            <p className="text-[#8b91a0] text-xs">No data</p>
          )}
        </div>

        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">BTC Dominance Breakdown</p>
          <div className="space-y-2">
            <div className="w-full h-5 rounded-full overflow-hidden flex bg-[#f4f5f7]">
              <div className="h-full bg-[#f4f5f7]" style={{ width: `${btcDom}%` }}></div>
              <div className="h-full bg-[#f4f5f7]" style={{ width: `${ethDom}%` }}></div>
              <div className="h-full bg-[#eef0f4]" style={{ width: `${otherDom}%` }}></div>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f4f5f7]"></div>
                <span className="text-[#4a4f5c]">BTC</span>
                <span className="text-[#0a0a23] font-mono font-bold tabular-nums">{btcDom.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f4f5f7]"></div>
                <span className="text-[#4a4f5c]">ETH</span>
                <span className="text-[#0a0a23] font-mono font-bold tabular-nums">{ethDom.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#eef0f4]"></div>
                <span className="text-[#4a4f5c]">Others</span>
                <span className="text-[#0a0a23] font-mono font-bold tabular-nums">{otherDom.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Altcoin Season Index</p>
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[180px] mb-3">
              <div className="w-full h-3 rounded-full bg-[#f4f5f7] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${altSeasonIndex}%`,
                    background: isBitcoinSeason
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                      : 'linear-gradient(90deg, #2563eb, #059669)',
                  }}
                ></div>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-[#8b91a0]">Bitcoin Season</span>
                <span className="text-[9px] text-[#8b91a0]">Altcoin Season</span>
              </div>
            </div>
            <p className={`text-[22px] font-mono font-bold tabular-nums ${isBitcoinSeason ? 'text-[#f59e0b]' : 'text-[#1a6bdb]'}`}>
              {altSeasonIndex}
            </p>
            <p className="text-[11px] text-[#4a4f5c] mt-1">
              {isBitcoinSeason ? `Bitcoin dominance at ${btcDom.toFixed(1)}%` : `Altcoins hold ${(100 - btcDom).toFixed(1)}% of market`}
            </p>
          </div>
        </div>
      </div>

      {dominanceBreakdown.length > 0 && (
        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Market Cap Dominance</p>
          <div className="space-y-2.5">
            {dominanceBreakdown.slice(0, 10).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[11px] text-[#4a4f5c] w-10 shrink-0 font-semibold">{item.symbol}</span>
                <div className="flex-1 h-4 rounded-full bg-[#f4f5f7] overflow-hidden">
                  <div className="h-full rounded-full bg-[#f4f5f7] transition-all duration-500" style={{ width: `${Math.min(item.percentage, 100)}%` }}></div>
                </div>
                <span className="text-[11px] text-[#0a0a23] font-mono font-bold tabular-nums w-14 text-right">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className={`lg:col-span-1 ${cardClass} p-3`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Trending Coins</p>
            <span className="text-[9px] text-[#8b91a0]">24H</span>
          </div>
          <div className="space-y-0.5">
            {(trending.coins || []).map((coin: any, i: number) => (
              <div key={coin.id || i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[#f4f5f7] transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-[11px] text-[#8b91a0] font-mono w-5 shrink-0 text-right">{i + 1}</span>
                  {coin.logo ? (
                    <img src={coin.logo} alt="" className="w-6 h-6 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#f4f5f7] shrink-0"></div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[12px] font-semibold text-[#0a0a23]">{coin.name}</span>
                    <span className="text-[9px] text-[#8b91a0] ml-1.5">{coin.symbol}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {coin.price != null && <span className="text-[11px] text-[#4a4f5c] tabular-nums font-mono">{formatPrice(coin.price)}</span>}
                  {coin.priceChange24h != null && <PctChange value={coin.priceChange24h} className="text-[11px] font-bold" />}
                </div>
              </div>
            ))}
          </div>

          {trending.categories?.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#e2e5ea]">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Trending Categories</p>
              <div className="space-y-2">
                {trending.categories.map((cat: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#f4f5f7] transition-colors">
                    <span className="text-[12px] text-[#0a0a23]">{cat.name}</span>
                    {cat.marketCapChange24h != null && <PctChange value={cat.marketCapChange24h} className="text-[10px] font-bold" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center gap-0 mb-3 overflow-x-auto border-b border-[#e2e5ea]">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`tab-btn ${activeFilter === f ? 'tab-btn-active' : ''}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredFeed.length === 0 ? (
              <div className={`${cardClass} p-6 text-center`}>
                <p className="text-[#8b91a0] text-sm">No items in this category yet</p>
              </div>
            ) : (
              filteredFeed.map((item: any, i: number) => (
                <a
                  key={item.id || i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${cardClass} p-3 block hover:bg-[#f4f5f7] transition-all cursor-pointer group`}
                >
                  <div className="flex items-start gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="w-20 h-16 rounded-lg object-cover shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          item.category === 'BTC Tracker' ? 'text-[#d97706] bg-[#f4f5f7]' :
                          item.category === 'Funding' ? 'text-[#0d9f6e] bg-[#ecfdf5]' :
                          item.category === 'X Highlight' ? 'text-[#1a6bdb] bg-[#f4f5f7]' :
                          item.category === 'Regulation' ? 'text-[#dc2626] bg-[#fef2f2]' :
                          item.category === 'Project' ? 'text-[#4a4f5c] bg-[#f4f5f7]' :
                          item.category === 'Token' ? 'text-[#1a6bdb] bg-[#f4f5f7]' :
                          'text-[#8b91a0] bg-[#f4f5f7]'
                        }`}>{item.category}</span>
                        <span className={`text-[9px] font-semibold ${
                          item.sentiment === 'Bullish' ? 'text-[#0d9f6e]' :
                          item.sentiment === 'Bearish' ? 'text-[#dc2626]' : 'text-[#8b91a0]'
                        }`}>{item.sentiment}</span>
                        <span className="text-[9px] text-[#8b91a0] ml-auto">{item.relativeTime}</span>
                      </div>
                      <h3 className="text-[14px] font-semibold text-[#0a0a23] leading-snug mb-1.5 group-hover:text-[#1557b8] transition-colors">{item.title}</h3>
                      {item.summary && (
                        <p className="text-[11px] text-[#4a4f5c] leading-relaxed line-clamp-2">{item.summary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-[#8b91a0]">{item.source}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SpotTab: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJSON('/api/pulse/exchanges', { exchanges: [], stats: {} }).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner text="Loading spot exchanges..." />;

  const exchanges = data?.exchanges || [];
  const stats = data?.stats || {};
  const topExchange = exchanges[0]?.name || 'N/A';

  const getTrustColor = (score: number) => {
    if (score >= 10) return 'bg-[#ecfdf5]';
    if (score >= 7) return 'bg-[#f4f5f7]';
    return 'bg-[#fef2f2]';
  };

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3`}>
        <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Spot Vol (24H)</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatBtc(stats.totalVolume24hBtc || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Exchanges</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{exchanges.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Top</span>
            <span className="text-[14px] font-bold text-[#0a0a23]">{topExchange}</span>
          </div>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-3 border-b border-[#e2e5ea]">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Top Exchanges by Volume</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-[#e2e5ea]">
                <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">#</th>
                <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Exchange</th>
                <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Trust</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">24H Volume (BTC)</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Country</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Est.</th>
              </tr>
            </thead>
            <tbody>
              {exchanges.map((ex: any, i: number) => (
                <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                  <td className="px-2 py-1.5 text-[12px] text-[#4a4f5c] font-mono tabular-nums">{ex.rank || i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {ex.image ? (
                        <img src={ex.image} alt="" className="w-5 h-5 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#f4f5f7] shrink-0"></div>
                      )}
                      <span className="text-[12px] font-semibold text-[#0a0a23]">{ex.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${getTrustColor(ex.trustScore || 0)}`}></div>
                      <span className="text-[11px] text-[#4a4f5c] font-mono tabular-nums">{ex.trustScore || '-'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatBtc(ex.volume24hBtc || 0)}</td>
                  <td className="px-2 py-1.5 text-right hidden md:table-cell">
                    <span className="text-[10px] text-[#4a4f5c] bg-[#f4f5f7] px-2 py-0.5 rounded-full">{ex.country || '--'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] font-mono tabular-nums hidden md:table-cell">{ex.year || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const DerivativesTab: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJSON('/api/pulse/derivatives', { exchanges: [], tickers: [], stats: {} }).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner text="Loading derivatives data..." />;

  const exchanges = data?.exchanges || [];
  const tickers = data?.tickers || [];
  const stats = data?.stats || {};

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3`}>
        <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Open Interest</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatBtc(stats.totalOpenInterestBtc || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">24H Vol</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatBtc(stats.totalVolume24hBtc || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Perps</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{(stats.totalPerpetualPairs || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Futures</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{(stats.totalFuturesPairs || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-3 border-b border-[#e2e5ea]">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Top Derivatives Exchanges</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-[#e2e5ea]">
                <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Exchange</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Open Interest (BTC)</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">24H Vol (BTC)</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Perpetuals</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Futures</th>
              </tr>
            </thead>
            <tbody>
              {exchanges.map((ex: any, i: number) => (
                <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {ex.image ? (
                        <img src={ex.image} alt="" className="w-5 h-5 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#f4f5f7] shrink-0"></div>
                      )}
                      <span className="text-[12px] font-semibold text-[#0a0a23]">{ex.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatBtc(ex.openInterestBtc || 0)}</td>
                  <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatBtc(ex.tradeVolume24hBtc || 0)}</td>
                  <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] font-mono tabular-nums hidden md:table-cell">{ex.perpetuals || 0}</td>
                  <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] font-mono tabular-nums hidden md:table-cell">{ex.futures || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tickers.length > 0 && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="p-3 border-b border-[#e2e5ea]">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Top Tickers</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header border-b border-[#e2e5ea]">
                  <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Market</th>
                  <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Symbol</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Price</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Funding Rate</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Open Interest</th>
                  <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">24H Volume</th>
                </tr>
              </thead>
              <tbody>
                {tickers.slice(0, 20).map((t: any, i: number) => {
                  const fr = typeof t.fundingRate === 'number' ? t.fundingRate : parseFloat(t.fundingRate) || 0;
                  return (
                    <tr key={i} className="table-row table-row-stripe border-b border-[#eef0f4]">
                      <td className="px-2 py-1.5 text-[12px] text-[#4a4f5c]">{t.market}</td>
                      <td className="px-2 py-1.5 text-[12px] font-semibold text-[#0a0a23]">{t.symbol}</td>
                      <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] tabular-nums font-mono">{formatPrice(t.price)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className={`text-[11px] font-bold tabular-nums font-mono ${fr >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>
                          {fr >= 0 ? '+' : ''}{(fr * 100).toFixed(4)}%
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] tabular-nums hidden md:table-cell font-mono">{formatNum(t.openInterest || 0)}</td>
                      <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] tabular-nums hidden md:table-cell font-mono">{formatNum(t.volume24h || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const BtcTreasuriesTab: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJSON('/api/pulse/btc-treasuries', { treasuries: [], stats: {}, countries: [] }).then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner text="Loading BTC treasuries..." />;

  const treasuries = data?.treasuries || [];
  const stats = data?.stats || {};
  const countries = data?.countries || [];
  const maxCountryPct = Math.max(...countries.map((c: any) => c.percentage || 0), 1);
  const totalSupply = 21000000;
  const supplyPct = ((stats.totalBtcHeld || 0) / totalSupply) * 100;

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3`}>
        <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">BTC Held</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{(stats.totalBtcHeld || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Value</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatNum(stats.totalValue || 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">% Supply</span>
            <span className="text-[14px] font-bold text-[#f59e0b] font-mono tabular-nums">{(stats.percentOfSupply || supplyPct).toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">BTC Price</span>
            <span className="text-[14px] font-bold text-[#f59e0b] font-mono tabular-nums">{formatPrice(stats.btcPrice || 0)}</span>
            <span className="text-[9px] text-[#8b91a0]">{stats.companiesCount || treasuries.length} cos</span>
          </div>
        </div>
      </div>

      {countries.length > 0 && (
        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Countries Breakdown</p>
          <div className="space-y-2.5">
            {countries.slice(0, 8).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] text-[#4a4f5c] bg-[#f4f5f7] px-2 py-0.5 rounded-full w-8 text-center shrink-0">{c.country}</span>
                <div className="flex-1 h-4 rounded-full bg-[#f4f5f7] overflow-hidden">
                  <div className="h-full rounded-full bg-[#f4f5f7] transition-all duration-500" style={{ width: `${(c.percentage / maxCountryPct) * 100}%` }}></div>
                </div>
                <span className="text-[11px] text-[#0a0a23] font-mono font-bold tabular-nums w-16 text-right">{(c.btcHeld || 0).toLocaleString()}</span>
                <span className="text-[10px] text-[#4a4f5c] font-mono tabular-nums w-12 text-right">{c.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-3 border-b border-[#e2e5ea]">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Bitcoin Holdings</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-[#e2e5ea]">
                <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">#</th>
                <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">Company</th>
                <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Ticker</th>
                <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Country</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">BTC Held</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden sm:table-cell">Avg Cost</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden md:table-cell">Value</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium hidden lg:table-cell">P/L</th>
                <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] px-2 py-1.5 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {treasuries.map((t: any, i: number) => {
                const isTop3 = i < 3;
                const btcPrice = stats.btcPrice || 68900;
                const plPct = t.avgPrice > 0 ? ((btcPrice - t.avgPrice) / t.avgPrice) * 100 : 0;
                return (
                  <tr key={i} className={`table-row table-row-stripe border-b border-[#eef0f4] ${isTop3 ? 'bg-[#f0f4f8]' : ''}`}>
                    <td className="px-2 py-1.5 text-[12px] text-[#4a4f5c] font-mono tabular-nums">{t.rank || i + 1}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        {t.logo ? (
                          <img src={t.logo} alt="" className="w-5 h-5 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-[#f4f5f7] flex items-center justify-center shrink-0"><span className="text-[8px] text-[#8b91a0] font-bold">{(t.ticker || '?')[0]}</span></div>
                        )}
                        <span className={`text-[12px] font-semibold ${isTop3 ? 'text-[#d97706]' : 'text-[#0a0a23]'}`}>{t.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-[11px] text-[#4a4f5c] hidden md:table-cell">{t.ticker || '--'}</td>
                    <td className="px-2 py-1.5 text-center hidden md:table-cell">
                      <span className="text-[10px] text-[#4a4f5c] bg-[#f4f5f7] px-2 py-0.5 rounded-full">{t.country || '--'}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-[12px] font-bold text-[#0a0a23] font-mono tabular-nums">{(t.btcHeld || 0).toLocaleString()}</td>
                    <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] tabular-nums hidden sm:table-cell font-mono">{t.avgPrice > 0 ? formatPrice(t.avgPrice) : '--'}</td>
                    <td className="px-2 py-1.5 text-right text-[11px] text-[#4a4f5c] tabular-nums hidden md:table-cell font-mono">{formatNum(t.value || 0)}</td>
                    <td className="px-2 py-1.5 text-right hidden lg:table-cell">
                      {t.avgPrice > 0 ? (
                        <span className={`text-[11px] font-bold tabular-nums font-mono ${plPct >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>
                          {plPct >= 0 ? '+' : ''}{plPct.toFixed(1)}%
                        </span>
                      ) : <span className="text-[10px] text-[#8b91a0]">--</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-[#f4f5f7] overflow-hidden">
                          <div className="h-full rounded-full bg-[#f4f5f7]" style={{ width: `${Math.min((t.percentOfTotal || 0), 100)}%` }}></div>
                        </div>
                        <span className="text-[10px] text-[#4a4f5c] font-mono tabular-nums w-12 text-right">{(t.percentOfTotal || 0).toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CryptocurrenciesTab: React.FC = () => {
  const [marketStats, setMarketStats] = useState<any>(null);
  const [trending, setTrending] = useState<any>({ coins: [], categories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJSON('/api/pulse/market-stats', null),
      fetchJSON('/api/pulse/trending', { coins: [], categories: [] }),
    ]).then(([ms, tr]) => {
      setMarketStats(ms);
      setTrending(tr);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner text="Loading cryptocurrencies..." />;

  return (
    <div className="space-y-3">
      <div className={`${cardClass} p-3`}>
        <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Active Cryptos</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{(marketStats?.activeCryptos || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Exchanges</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{(marketStats?.activeExchanges || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono">Market Cap</span>
            <span className="text-[14px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatNum(marketStats?.totalMarketCap || 0)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Trending Coins</p>
          <div className="space-y-0.5">
            {(trending.coins || []).slice(0, 15).map((coin: any, i: number) => (
              <div key={coin.id || i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[#f4f5f7] transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-[11px] text-[#8b91a0] font-mono w-5 shrink-0 text-right">{i + 1}</span>
                  {coin.logo ? (
                    <img src={coin.logo} alt="" className="w-6 h-6 rounded-full shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#f4f5f7] shrink-0"></div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold text-[#0a0a23]">{coin.name}</span>
                    <span className="text-[10px] text-[#8b91a0] ml-1.5">{coin.symbol}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {coin.price != null && <span className="text-[11px] text-[#4a4f5c] tabular-nums font-mono">{formatPrice(coin.price)}</span>}
                  {coin.marketCap != null && <span className="text-[10px] text-[#8b91a0] tabular-nums hidden sm:block font-mono">{formatNum(coin.marketCap)}</span>}
                  {coin.priceChange24h != null && <PctChange value={coin.priceChange24h} className="text-[11px] font-bold" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#8b91a0] font-medium font-mono mb-3">Trending Categories</p>
          <div className="space-y-2">
            {(trending.categories || []).map((cat: any, i: number) => (
              <div key={i} className={`${innerCardClass} p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] text-[#8b91a0] font-mono w-5 shrink-0 text-right">{i + 1}</span>
                  <span className="text-[13px] font-semibold text-[#0a0a23]">{cat.name}</span>
                </div>
                {cat.marketCapChange24h != null && <PctChange value={cat.marketCapChange24h} className="text-[12px] font-bold" />}
              </div>
            ))}
            {(!trending.categories || trending.categories.length === 0) && (
              <p className="text-[#8b91a0] text-xs text-center py-8">No trending categories available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CryptoPulseView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const loadedTabs = useRef<Set<SubTab>>(new Set(['overview']));
  const [tabKeys, setTabKeys] = useState<Record<SubTab, number>>({
    overview: 0,
    spot: 0,
    derivatives: 0,
    'btc-treasuries': 0,
    cryptocurrencies: 0,
  });

  const handleTabChange = useCallback((tab: SubTab) => {
    setActiveTab(tab);
    if (!loadedTabs.current.has(tab)) {
      loadedTabs.current.add(tab);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      setTabKeys(prev => ({ ...prev, [activeTab]: prev[activeTab] + 1 }));
    }, 60000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab key={tabKeys.overview} />;
      case 'spot': return <SpotTab key={tabKeys.spot} />;
      case 'derivatives': return <DerivativesTab key={tabKeys.derivatives} />;
      case 'btc-treasuries': return <BtcTreasuriesTab key={tabKeys['btc-treasuries']} />;
      case 'cryptocurrencies': return <CryptocurrenciesTab key={tabKeys.cryptocurrencies} />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="space-y-3 view-animate">
      <div className="card p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8b91a0] font-semibold font-mono">Crypto Pulse</p>
            <h2 className="text-[15px] sm:text-[17px] font-bold text-[#0a0a23] tracking-[-0.01em] mt-1 font-mono uppercase">Market Structure</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0d9f6e] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0d9f6e]"></span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.06em] text-[#4a4f5c] font-medium">Live {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="card p-1.5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? 'tab-btn-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {renderTab()}
    </div>
  );
};
