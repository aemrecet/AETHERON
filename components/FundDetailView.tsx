import React, { useEffect, useState } from 'react';

interface FundDetailViewProps {
  fundId: string;
  onBack: () => void;
}

export const FundDetailView: React.FC<FundDetailViewProps> = ({ fundId, onBack }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/insider/funds/${fundId}`);
        const d = await r.json();
        setData(d);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
  }, [fundId]);

  const cardClass = "card";
  const innerCardClass = "bg-[#fff] border border-[#e2e5ea] rounded-lg";

  const formatVal = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
    if (!n || isNaN(n)) return '$0';
    if (Math.abs(n) >= 1e12) return `$${(n/1e12).toFixed(1)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#e2e5ea] border-t-[#1a6bdb] rounded-full animate-spin"></div>
          <p className="text-sm text-[#8b91a0]">Loading fund intelligence...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 view-animate">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] text-[#1a6bdb] hover:text-[#4a4f5c] transition-colors duration-100 font-medium px-2.5 py-1.5 rounded-lg"
        style={{ background: '#f4f5f7', border: '1px solid #e2e5ea' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>

      <div className={`${cardClass} p-3`}>
        <p className="text-[10px] uppercase tracking-[0.1em] text-[#4a4f5c] font-semibold mb-2">Fund Command Center</p>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[#f4f5f7] flex items-center justify-center overflow-hidden shrink-0 p-1.5">
            {data.logo || data.ticker ? (
              <img src={data.logo || `https://assets.parqet.com/logos/symbol/${data.ticker}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span className="text-sm font-bold text-[#8b91a0]">{data.name?.substring(0,2)}</span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-[#0a0a23]">{data.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              {data.ticker && <span className="text-sm text-[#8b91a0]">{data.ticker}</span>}
              <span className="text-xs text-[#1a6bdb] font-semibold">{data.type}</span>
              <span className="text-xs text-[#8b91a0]">Founded {data.founded}</span>
            </div>
            <p className="text-xs text-[#4a4f5c] mt-1.5 leading-relaxed max-w-2xl">{data.description}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-[#1a6bdb] tabular-nums font-mono">{data.aum}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">AUM</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className={`${innerCardClass} p-2 text-center`}>
            <p className="text-sm font-bold text-[#0a0a23]">{data.hq}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Headquarters</p>
          </div>
          <div className={`${innerCardClass} p-2 text-center`}>
            <p className="text-sm font-bold text-[#0a0a23] tabular-nums font-mono">{data.employees?.toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Employees</p>
          </div>
          {data.performance && (
            <>
              <div className={`${innerCardClass} p-2 text-center`}>
                <p className={`text-sm font-bold tabular-nums font-mono ${data.performance.ytd >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>{data.performance.ytd >= 0 ? '+' : ''}{data.performance.ytd}%</p>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">YTD Return</p>
              </div>
              <div className={`${innerCardClass} p-2 text-center`}>
                <p className={`text-sm font-bold tabular-nums font-mono ${data.performance.oneYear >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>{data.performance.oneYear >= 0 ? '+' : ''}{data.performance.oneYear}%</p>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">1Y Return</p>
              </div>
              <div className={`${innerCardClass} p-2 text-center`}>
                <p className={`text-sm font-bold tabular-nums font-mono ${data.performance.fiveYear >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>{data.performance.fiveYear >= 0 ? '+' : ''}{data.performance.fiveYear}%</p>
                <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">5Y Return</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className={`${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-2">Management Team</p>
          <div className="space-y-2">
            {(data.managers || []).map((m: any, i: number) => (
              <div key={i} className={`${innerCardClass} p-2`}>
                <p className="text-sm font-bold text-[#0a0a23]">{m.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[#1a6bdb]">{m.title}</span>
                  <span className="text-xs text-[#8b91a0]">Since {m.since}</span>
                </div>
              </div>
            ))}
          </div>

          {data.topEtfs?.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mt-4 mb-2">Top ETFs</p>
              <div className="flex flex-wrap gap-1.5">
                {data.topEtfs.map((etf: string, i: number) => (
                  <span key={i} className={`${innerCardClass} text-xs text-[#4a4f5c] px-2 py-1`}>{etf}</span>
                ))}
              </div>
            </>
          )}

          {data.topETFsData?.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mt-4 mb-2">ETF Live Prices</p>
              <div className="space-y-1">
                {data.topETFsData.map((etf: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0a0a23]">{etf.ticker}</span>
                      <span className="text-xs text-[#8b91a0] truncate max-w-[120px]">{etf.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0a0a23] tabular-nums font-mono">${etf.price?.toFixed(2)}</span>
                      <span className={`text-xs font-semibold tabular-nums font-mono ${etf.change >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>
                        {etf.change >= 0 ? '+' : ''}{etf.change?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={`lg:col-span-2 ${cardClass} p-3`}>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-2">Top Holdings</p>
          <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
            {(data.holdings || []).map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#f4f5f7] transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs text-[#8b91a0] w-5 text-right shrink-0">{i+1}</span>
                  <div className="w-6 h-6 rounded-lg bg-[#f4f5f7] flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                    <img src={`https://assets.parqet.com/logos/symbol/${h.ticker}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <span className="text-sm font-bold text-[#0a0a23]">{h.ticker}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[#8b91a0] tabular-nums font-mono w-12 text-right">{h.weight}%</span>
                  <span className="text-xs text-[#4a4f5c] tabular-nums font-mono w-16 text-right">{h.value}</span>
                  <span className={`text-xs font-semibold tabular-nums w-14 text-right font-mono ${h.change >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>
                    {h.change >= 0 ? '+' : ''}{h.change}%
                  </span>
                  <div className="w-16 h-1.5 bg-[#f4f5f7] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#1a6bdb]" style={{ width: `${Math.min(h.weight * 5, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-3`}>
        <p className="text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-2">Recent Trades</p>
        <div className="space-y-0.5">
          {(data.recentTrades || []).map((t: any, i: number) => {
            const isBuy = t.type === 'Buy';
            return (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#f4f5f7] transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-[#f4f5f7] flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                    <img src={`https://assets.parqet.com/logos/symbol/${t.ticker}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <span className="text-xs font-bold text-[#0a0a23]">{t.ticker}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isBuy ? 'text-[#0d9f6e] bg-[rgba(13,159,110,0.08)]' : 'text-[#dc2626] bg-[rgba(220,38,38,0.06)]'}`}>
                    {t.type}
                  </span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[#4a4f5c] tabular-nums font-mono">{t.shares?.toLocaleString()} shares</span>
                  <span className="text-sm font-bold text-[#0a0a23] tabular-nums font-mono">{t.value}</span>
                  <span className="text-xs text-[#8b91a0] tabular-nums font-mono w-20 text-right">{t.date}</span>
                  <span className="text-[10px] text-[#8b91a0]">{t.quarterFiled}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
