import React, { useState, useMemo } from 'react';
import { Stock } from '../types';

interface MarketsViewProps {
  stocks: Stock[];
  onStockSelect?: (stock: Stock) => void;
}

type MarketType = 'NASDAQ' | 'BIST' | 'CRYPTO';
type SortKey = 'price' | 'changePercent' | 'marketCap' | 'volume' | null;
type SortDirection = 'asc' | 'desc';

const formatCompactCurrency = (value: number) => {
  if (!value && value !== 0) return '$0';
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

export const MarketsView: React.FC<MarketsViewProps> = ({ stocks, onStockSelect }) => {
  const [activeMarket, setActiveMarket] = useState<MarketType>('NASDAQ');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: null,
    direction: 'desc',
  });

  const parseMetricValue = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (!val || val === '---') return 0;
    const cleanVal = val.replace(/[^0-9.-]+/g, '');
    const num = parseFloat(cleanVal);
    if (isNaN(num)) return 0;
    const upper = val.toUpperCase();
    if (upper.includes('T')) return num * 1e12;
    if (upper.includes('B')) return num * 1e9;
    if (upper.includes('M')) return num * 1e6;
    if (upper.includes('K')) return num * 1e3;
    return num;
  };

  const marketStocks = useMemo(
    () => stocks.filter(stock => stock.market === activeMarket),
    [stocks, activeMarket],
  );

  const marketSummary = useMemo(() => {
    if (marketStocks.length === 0) {
      return {
        assetCount: 0,
        totalMarketCap: 0,
        avgChange: 0,
        advancers: 0,
        decliners: 0,
        topGainer: null as Stock | null,
        topLoser: null as Stock | null,
      };
    }

    const sortedByChange = [...marketStocks].sort((a, b) => b.changePercent - a.changePercent);
    const totalMarketCap = marketStocks.reduce((acc, stock) => acc + parseMetricValue(stock.marketCap), 0);
    const avgChange = marketStocks.reduce((acc, stock) => acc + stock.changePercent, 0) / marketStocks.length;

    return {
      assetCount: marketStocks.length,
      totalMarketCap,
      avgChange,
      advancers: marketStocks.filter(stock => stock.changePercent >= 0).length,
      decliners: marketStocks.filter(stock => stock.changePercent < 0).length,
      topGainer: sortedByChange[0] || null,
      topLoser: sortedByChange[sortedByChange.length - 1] || null,
    };
  }, [marketStocks]);

  const breadthPct = marketSummary.assetCount > 0
    ? (marketSummary.advancers / marketSummary.assetCount) * 100
    : 0;

  const filteredStocks = useMemo(() => {
    if (!searchQuery) return marketStocks;
    const lowerQuery = searchQuery.toLowerCase();
    return marketStocks
      .filter(stock => stock.symbol.toLowerCase().includes(lowerQuery) || stock.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        const aSymbolStart = a.symbol.toLowerCase().startsWith(lowerQuery);
        const bSymbolStart = b.symbol.toLowerCase().startsWith(lowerQuery);
        if (aSymbolStart && !bSymbolStart) return -1;
        if (!aSymbolStart && bSymbolStart) return 1;
        const aNameStart = a.name.toLowerCase().startsWith(lowerQuery);
        const bNameStart = b.name.toLowerCase().startsWith(lowerQuery);
        if (aNameStart && !bNameStart) return -1;
        if (!aNameStart && bNameStart) return 1;
        return a.symbol.localeCompare(b.symbol);
      });
  }, [marketStocks, searchQuery]);

  const sortedStocks = useMemo(() => {
    const data = [...filteredStocks];
    if (!sortConfig.key) return data;
    return data.sort((a, b) => {
      let aValue = 0;
      let bValue = 0;
      switch (sortConfig.key) {
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'changePercent':
          aValue = a.changePercent;
          bValue = b.changePercent;
          break;
        case 'marketCap':
          aValue = parseMetricValue(a.marketCap);
          bValue = parseMetricValue(b.marketCap);
          break;
        case 'volume':
          aValue = parseMetricValue(a.volume);
          bValue = parseMetricValue(b.volume);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredStocks, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const renderSortIcon = (key: SortKey) => {
    const isActive = sortConfig.key === key;
    const isAsc = sortConfig.direction === 'asc';
    return (
      <svg
        width="8"
        height="8"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke={isActive ? '#1a6bdb' : '#8b91a0'}
        style={{ opacity: isActive ? 1 : 0.5 }}
      >
        {isActive && isAsc ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
      </svg>
    );
  };

  return (
    <div className="space-y-3 view-animate h-full flex flex-col">
      <div className="card p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8b91a0] font-semibold font-heading">{activeMarket} Market Matrix</p>
            <h2 className="text-[15px] sm:text-[17px] font-bold text-[#0a0a23] tracking-[-0.01em] mt-1 font-heading uppercase">{activeMarket} Overview</h2>
          </div>
          <span className="badge badge-accent text-[10px] uppercase tracking-[0.06em]">Live Universe</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#8b91a0] uppercase tracking-[0.08em] font-mono">Assets</p>
            <p className="text-[17px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{marketSummary.assetCount}</p>
          </div>
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#8b91a0] uppercase tracking-[0.08em] font-mono">Total Cap</p>
            <p className="text-[17px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{formatCompactCurrency(marketSummary.totalMarketCap)}</p>
          </div>
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#8b91a0] uppercase tracking-[0.08em] font-mono">Breadth</p>
            <p className="text-[15px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">{marketSummary.advancers}/{marketSummary.decliners}</p>
          </div>
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#8b91a0] uppercase tracking-[0.08em] font-mono">Avg Move</p>
            <p className={`text-[17px] font-semibold font-mono tabular-nums mt-0.5 ${marketSummary.avgChange >= 0 ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>
              {marketSummary.avgChange >= 0 ? '+' : ''}{marketSummary.avgChange.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          <div className="rounded-lg border border-[#eef0f4] bg-[#fff] px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.07em] text-[#8b91a0]">Top Gainer</p>
            {marketSummary.topGainer ? (
              <p className="text-[12px] mt-1 text-[#0a0a23]">
                <span className="font-semibold">{marketSummary.topGainer.symbol}</span>
                <span className="font-mono ml-2 text-[#0d9f6e]">+{marketSummary.topGainer.changePercent.toFixed(2)}%</span>
              </p>
            ) : (
              <p className="text-[12px] mt-1 text-[#8b91a0]">No data</p>
            )}
          </div>
          <div className="rounded-lg border border-[#eef0f4] bg-[#fff] px-3 py-2">
            <p className="text-[9px] uppercase tracking-[0.07em] text-[#8b91a0]">Top Loser</p>
            {marketSummary.topLoser ? (
              <p className="text-[12px] mt-1 text-[#0a0a23]">
                <span className="font-semibold">{marketSummary.topLoser.symbol}</span>
                <span className="font-mono ml-2 text-[#dc2626]">{marketSummary.topLoser.changePercent.toFixed(2)}%</span>
              </p>
            ) : (
              <p className="text-[12px] mt-1 text-[#8b91a0]">No data</p>
            )}
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-[#eef0f4] bg-[#fff] px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] uppercase tracking-[0.07em] text-[#8b91a0]">Breadth Pulse</p>
            <span className={`text-[11px] font-mono tabular-nums font-semibold ${breadthPct >= 50 ? 'text-[#0d9f6e]' : 'text-[#d97706]'}`}>
              {breadthPct.toFixed(0)}% advancing
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#eef0f4] overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${breadthPct >= 50 ? 'bg-[#0d9f6e]' : 'bg-[#ffb066]'}`}
              style={{ width: `${Math.max(0, Math.min(100, breadthPct))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="card p-2.5 sm:p-3">
        <div className="relative mb-2.5">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8b91a0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={`Search ${activeMarket} symbols...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-3 text-[12px] input-field focus-ring"
            />
          </div>

        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          {(['NASDAQ', 'BIST', 'CRYPTO'] as MarketType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveMarket(tab)}
              className={`tab-btn focus-ring ${activeMarket === tab ? 'tab-btn-active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
          <div className="hidden md:block card overflow-hidden p-0">
            <table className="w-full text-left">
              <thead>
                <tr className="table-header" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="py-2.5 px-3 text-[10px] uppercase tracking-[0.08em] font-semibold font-mono" style={{ color: 'var(--color-text-tertiary)' }}>Ticker</th>
                  <th
                    className="py-2.5 px-3 text-[10px] uppercase tracking-[0.08em] font-semibold font-mono text-right cursor-pointer select-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">Price {renderSortIcon('price')}</div>
                  </th>
                  <th
                    className="py-2.5 px-3 text-[10px] uppercase tracking-[0.08em] font-semibold font-mono text-right cursor-pointer select-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onClick={() => handleSort('changePercent')}
                  >
                    <div className="flex items-center justify-end gap-1">Change {renderSortIcon('changePercent')}</div>
                  </th>
                  <th
                    className="hidden lg:table-cell py-2.5 px-3 text-[10px] uppercase tracking-[0.08em] font-semibold font-mono text-right cursor-pointer select-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onClick={() => handleSort('marketCap')}
                  >
                    <div className="flex items-center justify-end gap-1">Mkt Cap {renderSortIcon('marketCap')}</div>
                  </th>
                  <th
                    className="hidden xl:table-cell py-2.5 px-3 text-[10px] uppercase tracking-[0.08em] font-semibold font-mono text-right cursor-pointer select-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center justify-end gap-1">Volume {renderSortIcon('volume')}</div>
                  </th>
                  <th className="py-2.5 w-9"></th>
                </tr>
              </thead>
              <tbody>
                {sortedStocks.map((stock) => {
                  const isPositive = stock.change >= 0;
                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => onStockSelect && onStockSelect(stock)}
                      className="group cursor-pointer table-row table-row-stripe"
                      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2.5">
                          {stock.logo ? (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ background: '#f4f5f7', border: '1px solid #e2e5ea' }}>
                              <img src={stock.logo} alt={stock.symbol} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-[9px] font-mono shrink-0" style={{ background: '#f4f5f7', border: '1px solid #e2e5ea', color: '#8b91a0' }}>
                              {stock.symbol.substring(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-[11px] font-mono" style={{ color: 'var(--color-text-primary)' }}>{stock.symbol}</div>
                            <div className="text-[9px] truncate max-w-[140px]" style={{ color: 'var(--color-text-tertiary)' }}>{stock.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right text-[11px] font-mono tabular-nums font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className={`badge text-[10px] font-mono font-semibold tabular-nums ${isPositive ? 'badge-positive' : 'badge-negative'}`}>
                          {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="hidden lg:table-cell py-2 px-3 text-right">
                        <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>{stock.marketCap}</span>
                      </td>
                      <td className="hidden xl:table-cell py-2 px-3 text-right text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                        {stock.volume}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b91a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden card p-1.5">
            {sortedStocks.map(stock => {
              const isPositive = stock.change >= 0;
              return (
                <div
                  key={stock.symbol}
                  onClick={() => onStockSelect && onStockSelect(stock)}
                  className="flex items-center gap-2.5 py-2 px-2 cursor-pointer row-hover rounded-lg"
                >
                  {stock.logo ? (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden p-0.5 shrink-0" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid var(--color-border-subtle)' }}>
                      <img src={stock.logo} alt={stock.symbol} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-[9px] font-mono shrink-0" style={{ background: '#f4f5f7', border: '1px solid #e2e5ea', color: '#8b91a0' }}>
                      {stock.symbol.substring(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[11px] font-mono" style={{ color: 'var(--color-text-primary)' }}>{stock.symbol}</div>
                    <div className="text-[9px] truncate" style={{ color: 'var(--color-text-tertiary)' }}>{stock.name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-mono tabular-nums font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[10px] font-mono font-semibold tabular-nums ${isPositive ? 'text-[#0d9f6e]' : 'text-[#dc2626]'}`}>
                      {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {sortedStocks.length === 0 && (
            <div className="p-10 text-center card" style={{ color: 'var(--color-text-tertiary)' }}>
              <p className="text-[12px]">No assets found for this filter.</p>
            </div>
          )}
        </div>
    </div>
  );
};
