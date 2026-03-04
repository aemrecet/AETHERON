import React, { useEffect, useState } from 'react';

interface InsiderViewProps {
  onCongressMemberClick: (name: string) => void;
  onFundClick: (id: string) => void;
}

type SubTab = 'insider' | 'congress' | 'funds';

export const InsiderView: React.FC<InsiderViewProps> = ({ onCongressMemberClick, onFundClick }) => {
  const [subTab, setSubTab] = useState<SubTab>('insider');
  const [trades, setTrades] = useState<any[]>([]);
  const [congress, setCongress] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (subTab === 'insider' && trades.length === 0) {
          const r = await fetch('/api/insider/trades');
          const d = await r.json();
          setTrades(d);
        } else if (subTab === 'congress' && congress.length === 0) {
          const r = await fetch('/api/insider/congress');
          const d = await r.json();
          setCongress(d);
        } else if (subTab === 'funds' && funds.length === 0) {
          const r = await fetch('/api/insider/funds');
          const d = await r.json();
          setFunds(d);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetchData();
  }, [subTab]);

  const formatVal = (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v)) || 0;
    if (!n || isNaN(n)) return '$0';
    if (Math.abs(n) >= 1e12) return `$${(n/1e12).toFixed(1)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'insider', label: 'Insider Trades' },
    { id: 'congress', label: 'Congress' },
    { id: 'funds', label: 'Funds & ETFs' },
  ];

  const renderInsiderTrades = () => (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 table-header">
        <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Corporate Insider Trades</p>
        <span className="text-[10px] text-[#8b91a0] font-mono tabular-nums">{trades.length} trades</span>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="table-header border-t border-[#eef0f4]">
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Symbol</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Type</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Name</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Shares</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Value</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Date</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t: any, i: number) => {
            const isBuy = t.transactionType === 'Buy' || t.transactionType === 'P';
            return (
              <tr key={i} className="table-row table-row-stripe border-t border-[#eef0f4]">
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-[#f4f5f7] flex items-center justify-center overflow-hidden shrink-0">
                      <img src={`https://assets.parqet.com/logos/symbol/${t.symbol}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <span className="text-[11px] font-bold text-[#0a0a23]">{t.symbol}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${isBuy ? 'text-[#0d9f6e] bg-[rgba(13,159,110,0.08)]' : 'text-[#dc2626] bg-[rgba(220,38,38,0.06)]'}`}>
                    {t.transactionType}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-[#4a4f5c] truncate max-w-[180px]">{t.name}</td>
                <td className="px-2 py-1.5 text-right text-[10px] text-[#4a4f5c] font-mono tabular-nums">{t.share?.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-right text-[11px] font-bold text-[#0a0a23] font-mono tabular-nums">{formatVal(t.value)}</td>
                <td className="px-2 py-1.5 text-right text-[10px] text-[#8b91a0] font-mono tabular-nums">{t.transactionDate}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );

  const PieChart = ({ data, size = 100 }: { data: { label: string; value: number; color: string }[]; size?: number }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return null;
    const r = size / 2;
    const ir = r * 0.55;
    let cumAngle = -Math.PI / 2;
    const slices = data.map(d => {
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = cumAngle;
      cumAngle += angle;
      const endAngle = cumAngle;
      const largeArc = angle > Math.PI ? 1 : 0;
      const x1 = r + r * Math.cos(startAngle);
      const y1 = r + r * Math.sin(startAngle);
      const x2 = r + r * Math.cos(endAngle);
      const y2 = r + r * Math.sin(endAngle);
      const ix1 = r + ir * Math.cos(startAngle);
      const iy1 = r + ir * Math.sin(startAngle);
      const ix2 = r + ir * Math.cos(endAngle);
      const iy2 = r + ir * Math.sin(endAngle);
      const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${ir} ${ir} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
      return { ...d, path, pct: ((d.value / total) * 100).toFixed(0) };
    });
    return (
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((s, i) => (
            <path key={i} d={s.path} fill={s.color} opacity="0.85" />
          ))}
        </svg>
        <div className="flex flex-col gap-1">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }}></div>
              <span className="text-[10px] text-[#4a4f5c]">{s.label}</span>
              <span className="text-[10px] font-mono font-semibold text-[#0a0a23] tabular-nums">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const congressPartyData = () => {
    const d = congress.reduce((acc: Record<string, number>, m: any) => {
      const p = m.party === 'D' ? 'Democrat' : m.party === 'R' ? 'Republican' : 'Other';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    return [
      { label: 'Democrat', value: d['Democrat'] || 0, color: '#1a6bdb' },
      { label: 'Republican', value: d['Republican'] || 0, color: '#dc2626' },
      ...(d['Other'] ? [{ label: 'Other', value: d['Other'], color: '#d97706' }] : []),
    ];
  };

  const congressBuySellData = () => {
    const buys = congress.reduce((s: number, m: any) => s + (m.totalBuys || 0), 0);
    const sells = congress.reduce((s: number, m: any) => s + (m.totalSells || 0), 0);
    return [
      { label: 'Buys', value: buys, color: '#0d9f6e' },
      { label: 'Sells', value: sells, color: '#dc2626' },
    ];
  };

  const fundsTypeData = () => {
    const d = funds.reduce((acc: Record<string, number>, f: any) => {
      const t = f.type || 'Other';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    const colors = ['#1a6bdb', '#0d9f6e', '#d97706', '#8b5cf6', '#dc2626', '#06b6d4', '#ec4899'];
    return Object.entries(d).map(([label, value], i) => ({
      label,
      value: value as number,
      color: colors[i % colors.length],
    }));
  };

  const renderCongress = () => (
    <div className="space-y-3">
      {congress.length > 0 && (
        <div className="card p-3">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-3">Congressional Trading Overview</p>
          <div className="flex flex-wrap gap-8 justify-center">
            <div>
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-2 text-center">Party Breakdown</p>
              <PieChart data={congressPartyData()} size={90} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-2 text-center">Buy vs Sell</p>
              <PieChart data={congressBuySellData()} size={90} />
            </div>
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 table-header">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Congress Members</p>
          <span className="text-[10px] text-[#8b91a0] font-mono tabular-nums">{congress.length} members tracked</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
        <thead>
          <tr className="table-header border-t border-[#eef0f4]">
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Member</th>
            <th className="text-center text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Party</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">State</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Buys</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Sells</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Total</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Top Tickers</th>
          </tr>
        </thead>
        <tbody>
          {congress.map((m: any, i: number) => (
            <tr key={i} className="table-row table-row-stripe border-t border-[#eef0f4] cursor-pointer" onClick={() => onCongressMemberClick(m.name)}>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-[#f4f5f7] flex items-center justify-center text-[9px] font-bold text-[#1a6bdb] shrink-0">
                    {m.name.split(' ').map((n: string) => n[0]).join('').substring(0,2)}
                  </div>
                  <span className="text-[11px] font-semibold text-[#0a0a23] truncate max-w-[140px]">{m.name}</span>
                </div>
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${m.party === 'D' ? 'text-[#1a6bdb] bg-[rgba(26,107,219,0.08)]' : m.party === 'R' ? 'text-[#dc2626] bg-[rgba(220,38,38,0.06)]' : 'text-[#d97706] bg-[rgba(217,119,6,0.08)]'}`}>
                  {m.party}
                </span>
              </td>
              <td className="px-2 py-1.5 text-[10px] text-[#4a4f5c]">{m.state} - {m.chamber}</td>
              <td className="px-2 py-1.5 text-right text-[10px] text-[#0d9f6e] font-mono tabular-nums">{m.totalBuys}</td>
              <td className="px-2 py-1.5 text-right text-[10px] text-[#dc2626] font-mono tabular-nums">{m.totalSells}</td>
              <td className="px-2 py-1.5 text-right text-[10px] text-[#4a4f5c] font-mono tabular-nums">{m.totalTrades}</td>
              <td className="px-2 py-1.5">
                <div className="flex flex-wrap gap-0.5">
                  {(m.topTickers || []).slice(0, 4).map((t: string, j: number) => (
                    <span key={j} className="text-[9px] text-[#4a4f5c] bg-[#f4f5f7] px-1 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
    </div>
  );

  const renderFunds = () => (
    <div className="space-y-3">
      {funds.length > 0 && (
        <div className="card p-3">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium mb-3">Fund Type Distribution</p>
          <div className="flex justify-center">
            <PieChart data={fundsTypeData()} size={90} />
          </div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 table-header">
          <p className="text-[9px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium">Global Investment Funds & ETFs</p>
          <span className="text-[10px] text-[#8b91a0] font-mono tabular-nums">{funds.length} funds</span>
        </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="table-header border-t border-[#eef0f4]">
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Fund</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Type</th>
            <th className="text-right text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">AUM</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">CEO</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">HQ</th>
            <th className="text-left text-[10px] uppercase tracking-[0.06em] text-[#8b91a0] font-medium px-2 py-1.5">Top ETFs</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((f: any, i: number) => (
            <tr key={i} className="table-row table-row-stripe border-t border-[#eef0f4] cursor-pointer" onClick={() => onFundClick(f.id)}>
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-[#f4f5f7] flex items-center justify-center overflow-hidden shrink-0">
                    {f.logo || f.ticker ? (
                      <img src={f.logo || `https://assets.parqet.com/logos/symbol/${f.ticker}?format=png`} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-[8px] font-bold text-[#8b91a0]">{f.name.substring(0,2)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-[#0a0a23] truncate block max-w-[140px]">{f.name}</span>
                    {f.ticker && <span className="text-[9px] text-[#8b91a0]">{f.ticker}</span>}
                  </div>
                </div>
              </td>
              <td className="px-2 py-1.5 text-[10px] text-[#1a6bdb] font-semibold">{f.type}</td>
              <td className="px-2 py-1.5 text-right text-[11px] font-bold text-[#1a6bdb] font-mono tabular-nums">{f.aum}</td>
              <td className="px-2 py-1.5 text-[10px] text-[#4a4f5c] truncate max-w-[120px]">{f.ceo}</td>
              <td className="px-2 py-1.5 text-[10px] text-[#8b91a0]">{f.hq}</td>
              <td className="px-2 py-1.5">
                <div className="flex flex-wrap gap-0.5">
                  {(f.topEtfs || []).slice(0, 4).map((etf: string, j: number) => (
                    <span key={j} className="text-[9px] text-[#4a4f5c] bg-[#f4f5f7] px-1 py-0.5 rounded">{etf}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
    </div>
  );

  return (
    <div className="space-y-3 view-animate">
      <div className="card p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#4a4f5c] font-semibold">Insider Intelligence</p>
            <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#0a0a23] tracking-[-0.02em] mt-1">Capital Movers Dashboard</h2>
          </div>
          <span className="badge badge-accent text-[10px] uppercase tracking-[0.06em]">Live Tracking</span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Trades</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{trades.length}</p>
          </div>
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Congress</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{congress.length}</p>
          </div>
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Funds</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{funds.length}</p>
          </div>
        </div>
      </div>

      <div className="card p-1.5">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`tab-btn ${subTab === tab.id ? 'tab-btn-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#e2e5ea] border-t-[#1a6bdb] rounded-full animate-spin"></div>
            <p className="text-sm text-[#8b91a0]">Loading insider intelligence...</p>
          </div>
        </div>
      ) : (
        <>
          {subTab === 'insider' && renderInsiderTrades()}
          {subTab === 'congress' && renderCongress()}
          {subTab === 'funds' && renderFunds()}
        </>
      )}
    </div>
  );
};
