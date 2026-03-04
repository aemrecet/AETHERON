import React, { useEffect, useState } from 'react';

interface CongressDetailViewProps {
  memberName: string;
  onBack: () => void;
}

export const CongressDetailView: React.FC<CongressDetailViewProps> = ({ memberName, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'purchase' | 'sale'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/insider/congress/${encodeURIComponent(memberName)}`);
        const d = await r.json();
        setData(d);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
  }, [memberName]);

  const cardClass = "card";
  const innerCardClass = "bg-[#0a0a0a] border border-[#1e1e1e] rounded-[4px]";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1e1e1e] border-t-[#5a9aee] rounded-full animate-spin"></div>
          <p className="text-sm text-[#555]">Loading {memberName} profile...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredTrades = filter === 'all' ? data.trades : data.trades.filter((t: any) => filter === 'purchase' ? t.type === 'purchase' : t.type !== 'purchase');

  return (
    <div className="space-y-4 view-animate">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#5a9aee] hover:text-[#888] transition-colors duration-100 font-medium px-2.5 py-1.5 rounded-[4px]"
        style={{ background: '#111', border: '1px solid #1e1e1e' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>

      <div className={`${cardClass} p-3`}>
        <p className="text-[10px] uppercase tracking-[0.1em] text-[#888] font-semibold mb-2">Congress Trading Profile</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-[4px] bg-[#111] flex items-center justify-center text-sm font-bold text-[#5a9aee]">
            {data.name.split(' ').map((n: string) => n[0]).join('').substring(0,2)}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#fff]">{data.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${data.party === 'D' ? 'text-[#5a9aee] bg-[#111]' : data.party === 'R' ? 'text-[#ef4444] bg-[rgba(255,59,59,0.1)]' : 'text-[#f59e0b] bg-[rgba(245,166,35,0.1)]'}`}>
                {data.party === 'D' ? 'Democrat' : data.party === 'R' ? 'Republican' : 'Independent'}
              </span>
              <span className="text-xs text-[#555]">{data.state}{data.district ? ` - District ${data.district}` : ''}</span>
              <span className="text-xs text-[#555]">{data.chamber}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className={`${innerCardClass} p-2 text-center`}>
            <p className="text-base font-bold text-[#fff] tabular-nums font-mono">{data.totalTrades}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium">Total Trades</p>
          </div>
          <div className={`${innerCardClass} p-2 text-center`}>
            <p className="text-base font-bold text-[#10b981] tabular-nums font-mono">{data.totalBuys}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium">Purchases</p>
          </div>
          <div className={`${innerCardClass} p-2 text-center`}>
            <p className="text-base font-bold text-[#ef4444] tabular-nums font-mono">{data.totalSells}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium">Sales</p>
          </div>
          <div className={`${innerCardClass} p-2 text-center`}>
            <p className="text-base font-bold text-[#5a9aee] tabular-nums font-mono">{data.topHoldings?.length || 0}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium">Stocks Traded</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mb-2">Portfolio Holdings</p>
          <div className="space-y-1.5">
            {(data.portfolio || []).map((h: any, i: number) => (
              <div key={i} className={`${innerCardClass} p-2.5`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-[4px] bg-[#161616] flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                      <img src={`https://assets.parqet.com/logos/symbol/${h.ticker}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <span className="text-sm font-bold text-[#fff]">{h.ticker}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#5a9aee] tabular-nums font-mono">{h.estimatedValue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold ${h.lastAction === 'purchase' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                    Last: {h.lastAction === 'purchase' ? 'BUY' : 'SELL'}
                  </span>
                  <span className="text-[10px] text-[#555]">{h.trades} trades</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mb-2">Sector Allocation</p>
          <div className="space-y-2">
            {(data.sectorAllocation || []).map((s: any, i: number) => {
              const colors = ['#5a9aee', '#2762bc', '#888', '#f59e0b', '#ef4444', '#06b6d4'];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[#888]">{s.name}</span>
                    <span className="text-sm font-semibold tabular-nums font-mono" style={{ color: colors[i % colors.length] }}>{s.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.pct}%`, backgroundColor: colors[i % colors.length], opacity: 0.7 }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mt-4 mb-2">Top Tickers</p>
          <div className="flex flex-wrap gap-1.5">
            {(data.topHoldings || []).map((h: any, i: number) => (
              <span key={i} className={`${innerCardClass} text-xs text-[#888] px-2 py-1`}>
                {h.ticker} <span className="text-[#555]">({h.count})</span>
              </span>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium mb-2">Recent Activity</p>
          <div className="space-y-1">
            {(data.recentActivity || []).map((t: any, i: number) => {
              const isBuy = t.type === 'purchase';
              return (
                <div key={i} className={`${innerCardClass} p-2.5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#fff]">{t.ticker}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isBuy ? 'text-[#10b981] bg-[rgba(0,192,118,0.1)]' : 'text-[#ef4444] bg-[rgba(255,59,59,0.1)]'}`}>
                        {isBuy ? 'BUY' : 'SELL'}
                      </span>
                    </div>
                    <span className="text-xs text-[#555] font-mono tabular-nums">{t.transactionDate}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[#555] font-mono tabular-nums">{t.amount}</span>
                    <span className="text-[10px] text-[#555]">{t.owner}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#555] font-medium">All Transactions</p>
          <div className="flex items-center gap-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
            {(['all', 'purchase', 'sale'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`tab-btn ${filter === f ? 'tab-btn-active' : ''}`}>
                {f === 'all' ? 'All' : f === 'purchase' ? 'Buys' : 'Sells'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
          {filteredTrades.map((t: any, i: number) => {
            const isBuy = t.type === 'purchase';
            return (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-[4px] hover:bg-[#111] transition-colors">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-5 h-5 rounded-md bg-[#161616] flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                    <img src={`https://assets.parqet.com/logos/symbol/${t.ticker}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <span className="text-xs font-bold text-[#fff]">{t.ticker}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isBuy ? 'text-[#10b981] bg-[rgba(0,192,118,0.1)]' : 'text-[#ef4444] bg-[rgba(255,59,59,0.1)]'}`}>
                    {isBuy ? 'BUY' : 'SELL'}
                  </span>
                  {t.assetDescription && <span className="text-xs text-[#555] truncate">{t.assetDescription}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-[#888] font-mono tabular-nums">{t.amount}</span>
                  <span className="text-xs text-[#555]">{t.owner}</span>
                  <span className="text-xs text-[#555] tabular-nums font-mono w-20 text-right">{t.transactionDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
