import React, { useState, useMemo, useEffect } from 'react';
import { Stock, NewsItem } from '../types';
import { StockChart } from './StockChart';
import { askGemini } from '../services/geminiService';
import { ArrowLeft, ExternalLink, Globe, Users, TrendingUp, TrendingDown, Building2, ChartBar as BarChart3, Activity, GitFork, Star, MessageCircle, Newspaper } from 'lucide-react';

interface StockDetailViewProps {
  stock: Stock;
  news: NewsItem[];
  onBack: () => void;
  onAnalyze: () => void;
}

const API_BASE = '';

const formatBigNum = (n: number | null | undefined): string => {
  if (!n && n !== 0) return '---';
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
};

const formatPct = (n: number | null | undefined): string => {
  if (n == null) return '---';
  return `${(n * 100).toFixed(2)}%`;
};

const formatPctDirect = (n: number | null | undefined): string => {
  if (n == null) return '---';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const formatSupply = (n: number | null | undefined): string => {
  if (!n) return '---';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
};

const cardClass = "card";

export const StockDetailView: React.FC<StockDetailViewProps> = ({ stock, news, onBack, onAnalyze }) => {
  const isPositive = stock.change >= 0;
  const color = isPositive ? '#10b981' : '#ef4444';
  const [activeRange, setActiveRange] = useState('1M');
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    setDescExpanded(false);
    setAnalysisText('');

    const fetchDetail = async () => {
      try {
        if (stock.market === 'CRYPTO') {
          const coinId = (stock as any).coinId || stock.name.toLowerCase().replace(/\s+/g, '-');
          const r = await fetch(`${API_BASE}/api/crypto-detail/${coinId}`);
          if (r.ok) {
            const d = await r.json();
            if (!d.error) setDetail(d);
          }
        } else {
          const r = await fetch(`${API_BASE}/api/stock-detail/${stock.symbol}`);
          if (r.ok) {
            const d = await r.json();
            if (!d.error) setDetail(d);
          }
        }
      } catch (e) {
        console.error('Detail fetch error:', e);
      }
      setLoading(false);
    };
    fetchDetail();
  }, [stock.symbol, stock.market]);

  const chartData = useMemo(() => {
    if (!stock.data || stock.data.length === 0) return [];
    const totalPoints = stock.data.length;
    switch(activeRange) {
      case '1D': return stock.data.slice(-Math.min(totalPoints, 48));
      case '1M': return stock.data.slice(-Math.min(totalPoints, 150));
      default: return stock.data;
    }
  }, [stock.data, activeRange]);

  const handleInlineAnalyze = async () => {
    setAnalysisLoading(true);
    setAnalysisText('');
    const prompt = `Analyze ${stock.symbol} (${stock.name}). Current price: $${stock.price.toFixed(2)}, change: ${stock.changePercent.toFixed(2)}%. Market: ${stock.market}. Volume: ${stock.volume}. Market Cap: ${stock.marketCap}. Provide technical analysis, sentiment, key levels, and a clear recommendation.`;
    const context = `${stock.symbol}: $${stock.price.toFixed(2)} (${stock.changePercent > 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%)`;
    const response = await askGemini(prompt, context, [{ role: 'user', content: prompt }]);
    setAnalysisText(response);
    setAnalysisLoading(false);
  };

  const StatRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
    <div className="flex justify-between items-center py-1.5" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span className={`text-[11px] font-semibold tabular-nums font-mono ${valueColor || ''}`} style={!valueColor ? { color: '#e4e8ee' } : {}}>{value}</span>
    </div>
  );

  const SectionHeader = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h3 className="text-[10px] uppercase tracking-[0.06em] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{title}</h3>
    </div>
  );

  const isCrypto = stock.market === 'CRYPTO';

  const relatedNews = useMemo(() => {
    const sym = stock.symbol.toLowerCase();
    const name = stock.name.toLowerCase();
    const filtered = news.filter(n => {
      const t = (n.title || '').toLowerCase();
      return t.includes(sym) || t.includes(name);
    });
    return filtered.length > 0 ? filtered.slice(0, 12) : news.slice(0, 12);
  }, [news, stock.symbol, stock.name]);

  return (
    <div className="flex flex-col view-animate pb-6">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-medium card-interactive px-2.5 py-1.5 rounded-lg"
          style={{ color: '#7db8ff', border: '1px solid var(--color-border-subtle)', background: 'rgba(89, 129, 191, 0.14)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="card p-3 mb-2">
      <p className="text-[10px] uppercase tracking-[0.1em] text-[#88a8cf] font-semibold mb-2">Asset Intelligence</p>
      <div className="flex items-center gap-3">
        {stock.logo && (
          <img src={stock.logo} alt={stock.symbol} className="w-10 h-10 object-contain shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold text-white">{stock.symbol}</span>
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ color: '#4c8bf5', background: 'rgba(76,139,245,0.1)' }}>{stock.market}</span>
            {detail?.industry && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: 'var(--color-text-secondary)', background: 'rgba(89, 129, 191, 0.16)' }}>{detail.industry}</span>}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{stock.name}</p>
        </div>
        <div className="text-right">
          <div className="text-[24px] font-bold font-mono tabular-nums text-white tracking-[-0.02em]">
            ${stock.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: stock.price < 1 ? 6 : 2})}
          </div>
          <span className={`text-[13px] font-semibold tabular-nums font-mono ${isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      </div>

      <div className="flex gap-3 mb-2">
        <div className="flex-1 min-w-0 rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="w-full" style={{ height: '320px' }}>
            <StockChart data={chartData} color={color} range={activeRange} />
          </div>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-[10px] font-medium px-2.5 py-1 rounded" style={{ background: 'rgba(76,139,245,0.12)', color: '#4c8bf5' }}>1M</span>
            <button
              onClick={handleInlineAnalyze}
              disabled={analysisLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
              style={{ background: '#ffffff', color: '#0d0e12' }}
            >
              {analysisLoading && (
                <div className="w-3.5 h-3.5 border-2 border-[#0d0e12]/20 border-t-[#0d0e12] rounded-full animate-spin"></div>
              )}
              Analyze {stock.symbol}
            </button>
          </div>
        </div>

        <div className="hidden lg:block w-[320px] shrink-0">
          <div className="card p-2.5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <Newspaper className="w-3.5 h-3.5 text-[#4c8bf5]" />
              <span className="text-[10px] uppercase tracking-[0.06em] font-medium text-[#868c98]">Related News</span>
              <span className="text-[9px] font-mono text-[#555962] ml-auto">{relatedNews.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
              {relatedNews.map((item, i) => (
                <a href={item.url} target="_blank" rel="noopener noreferrer" key={i} className="block card-interactive rounded p-2">
                  <p className="text-[11px] text-[#e4e8ee] leading-snug mb-1 line-clamp-2">{item.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#555962] truncate">{item.source}</span>
                    <span className="text-[9px] text-[#555962]">{item.time}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-[#555962] ml-auto shrink-0" />
                  </div>
                </a>
              ))}
              {relatedNews.length === 0 && (
                <p className="text-[11px] text-[#555962] text-center py-4">No related news</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {(analysisLoading || analysisText) && (
        <div className="rounded-md overflow-hidden mb-3" style={{ background: 'linear-gradient(180deg, rgba(16, 25, 40, 0.88), rgba(9, 15, 24, 0.96))', border: '1px solid var(--color-border)' }}>
          <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4c8bf5 0%, #6366f1 100%)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-white">{'\u00C6thron AI Analysis'}</span>
            <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>GPT-5.2</span>
          </div>
          <div className="px-4 py-3">
            {analysisLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#2a2b33] border-t-[#4c8bf5] rounded-full animate-spin"></div>
                <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>Analyzing {stock.symbol}...</span>
              </div>
            ) : (
              <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: '#c4c9d4' }}>
                {analysisText.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-semibold text-white mt-2 mb-1">{line.replace(/\*\*/g, '')}</p>;
                  }
                  if (line.startsWith('# ')) {
                    return <p key={i} className="font-bold text-white text-[13px] mt-3 mb-1">{line.replace(/^# /, '')}</p>;
                  }
                  if (line.startsWith('## ')) {
                    return <p key={i} className="font-semibold text-white text-[12px] mt-2 mb-1">{line.replace(/^## /, '')}</p>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <p key={i} className="pl-3 mb-0.5">{line}</p>;
                  }
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i} className="mb-1">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {detail?.description && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="About" icon={<Building2 className="w-4 h-4 text-[#555962]" />} />
          <p className={`text-[12px] leading-relaxed ${!descExpanded ? 'line-clamp-4' : ''}`} style={{ color: 'var(--color-text-secondary)' }}>
            {detail.description.replace(/<[^>]*>/g, '')}
          </p>
          {detail.description.length > 300 && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="text-[11px] text-[#4c8bf5] font-medium mt-2 hover:underline">
              {descExpanded ? 'Show Less' : 'Read More'}
            </button>
          )}
          {(detail.sector || detail.website || detail.employees) && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[#ffffff0f]">
              {detail.sector && (
                <div className="text-[11px]">
                  <span className="text-[#555962]">Sector </span>
                  <span className="text-white font-medium">{detail.sector}</span>
                </div>
              )}
              {detail.country && (
                <div className="text-[11px]">
                  <span className="text-[#555962]">HQ </span>
                  <span className="text-white font-medium">{detail.city ? `${detail.city}, ` : ''}{detail.country}</span>
                </div>
              )}
              {detail.employees && (
                <div className="text-[11px]">
                  <span className="text-[#555962]">Employees </span>
                  <span className="text-white font-medium">{detail.employees.toLocaleString()}</span>
                </div>
              )}
              {detail.website && (
                <a href={detail.website} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#4c8bf5] hover:underline flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
            </div>
          )}

          {isCrypto && detail?.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#ffffff0f]">
              {detail.categories.filter(Boolean).slice(0, 6).map((cat: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-[#1c1d24] text-[#868c98]">{cat}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <div className={`${cardClass} p-2.5`}>
          <SectionHeader title={isCrypto ? "Market Data" : "Price & Volume"} icon={<BarChart3 className="w-3.5 h-3.5 text-[#6da0f7]" />} />
          <StatRow label="Market Cap" value={detail?.marketCap ? formatBigNum(detail.marketCap) : stock.marketCap} />
          <StatRow label="Volume (24h)" value={isCrypto ? (detail?.totalVolume ? formatBigNum(detail.totalVolume) : stock.volume) : stock.volume} />
          {!isCrypto && <StatRow label="Avg Volume" value={detail?.averageVolume ? formatSupply(detail.averageVolume) : '---'} />}
          <StatRow label="Day High" value={`$${(detail?.high24h || detail?.dayHigh || stock.dayHigh)?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '---'}`} />
          <StatRow label="Day Low" value={`$${(detail?.low24h || detail?.dayLow || stock.dayLow)?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '---'}`} />
          {!isCrypto && detail?.open && <StatRow label="Open" value={`$${detail.open.toLocaleString(undefined, {minimumFractionDigits: 2})}`} />}
          {!isCrypto && detail?.previousClose && <StatRow label="Prev Close" value={`$${detail.previousClose.toLocaleString(undefined, {minimumFractionDigits: 2})}`} />}
          {!isCrypto && detail?.fiftyTwoWeekHigh && <StatRow label="52W High" value={`$${detail.fiftyTwoWeekHigh.toFixed(2)}`} />}
          {!isCrypto && detail?.fiftyTwoWeekLow && <StatRow label="52W Low" value={`$${detail.fiftyTwoWeekLow.toFixed(2)}`} />}
          {!isCrypto && detail?.fiftyDayAverage && <StatRow label="50D Avg" value={`$${detail.fiftyDayAverage.toFixed(2)}`} />}
          {!isCrypto && detail?.twoHundredDayAverage && <StatRow label="200D Avg" value={`$${detail.twoHundredDayAverage.toFixed(2)}`} />}
          {isCrypto && detail?.ath && (
            <>
              <StatRow label="All-Time High" value={`$${detail.ath.toLocaleString()}`} />
              <StatRow label="ATH Change" value={formatPctDirect(detail.athChangePercent)} valueColor={detail.athChangePercent >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />
              <StatRow label="All-Time Low" value={`$${detail.atl?.toLocaleString() || '---'}`} />
              <StatRow label="ATL Change" value={formatPctDirect(detail.atlChangePercent)} valueColor={detail.atlChangePercent >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />
            </>
          )}
        </div>

        <div className={`${cardClass} p-2.5`}>
          {isCrypto ? (
            <>
              <SectionHeader title="Supply & Valuation" icon={<Activity className="w-3.5 h-3.5 text-[#7c5cbf]" />} />
              <StatRow label="Circulating Supply" value={formatSupply(detail?.circulatingSupply)} />
              <StatRow label="Total Supply" value={formatSupply(detail?.totalSupply)} />
              <StatRow label="Max Supply" value={detail?.maxSupply ? formatSupply(detail.maxSupply) : 'Unlimited'} />
              <StatRow label="FDV" value={detail?.fullyDilutedValuation ? formatBigNum(detail.fullyDilutedValuation) : '---'} />
              <StatRow label="Market Cap Rank" value={detail?.marketCapRank ? `#${detail.marketCapRank}` : '---'} />
              {detail?.priceChangePercent7d != null && <StatRow label="7D Change" value={formatPctDirect(detail.priceChangePercent7d)} valueColor={detail.priceChangePercent7d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />}
              {detail?.priceChangePercent30d != null && <StatRow label="30D Change" value={formatPctDirect(detail.priceChangePercent30d)} valueColor={detail.priceChangePercent30d >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />}
              {detail?.priceChangePercent1y != null && <StatRow label="1Y Change" value={formatPctDirect(detail.priceChangePercent1y)} valueColor={detail.priceChangePercent1y >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />}
              {detail?.genesisDate && <StatRow label="Genesis Date" value={detail.genesisDate} />}
            </>
          ) : (
            <>
              <SectionHeader title="Fundamentals" icon={<Activity className="w-4 h-4 text-[#7c5cbf]" />} />
              {detail?.trailingPE && <StatRow label="P/E (TTM)" value={detail.trailingPE.toFixed(2)} />}
              {detail?.forwardPE && <StatRow label="P/E (Forward)" value={detail.forwardPE.toFixed(2)} />}
              {detail?.priceToBook && <StatRow label="P/B Ratio" value={detail.priceToBook.toFixed(2)} />}
              {detail?.pegRatio && <StatRow label="PEG Ratio" value={detail.pegRatio.toFixed(2)} />}
              {detail?.beta && <StatRow label="Beta" value={detail.beta.toFixed(2)} />}
              {detail?.enterpriseValue && <StatRow label="Enterprise Value" value={formatBigNum(detail.enterpriseValue)} />}
              {detail?.bookValue && <StatRow label="Book Value" value={`$${detail.bookValue.toFixed(2)}`} />}
              {detail?.sharesOutstanding && <StatRow label="Shares Outstanding" value={formatSupply(detail.sharesOutstanding)} />}
              {detail?.dividendYield != null && <StatRow label="Dividend Yield" value={formatPct(detail.dividendYield)} />}
              {detail?.dividendRate && <StatRow label="Dividend Rate" value={`$${detail.dividendRate.toFixed(2)}`} />}
              {detail?.payoutRatio != null && <StatRow label="Payout Ratio" value={formatPct(detail.payoutRatio)} />}
            </>
          )}
        </div>
      </div>

      {!isCrypto && detail && (detail.totalRevenue || detail.profitMargins) && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Financials" icon={<TrendingUp className="w-4 h-4 text-[#6da0f7]" />} />
          <div className="grid grid-cols-2 gap-x-6">
            {detail.totalRevenue && <StatRow label="Total Revenue" value={formatBigNum(detail.totalRevenue)} />}
            {detail.ebitda && <StatRow label="EBITDA" value={formatBigNum(detail.ebitda)} />}
            {detail.profitMargins != null && <StatRow label="Profit Margin" value={formatPct(detail.profitMargins)} />}
            {detail.grossMargins != null && <StatRow label="Gross Margin" value={formatPct(detail.grossMargins)} />}
            {detail.operatingMargins != null && <StatRow label="Operating Margin" value={formatPct(detail.operatingMargins)} />}
            {detail.returnOnEquity != null && <StatRow label="Return on Equity" value={formatPct(detail.returnOnEquity)} />}
            {detail.revenuePerShare && <StatRow label="Revenue/Share" value={`$${detail.revenuePerShare.toFixed(2)}`} />}
            {detail.earningsGrowth != null && <StatRow label="Earnings Growth" value={formatPct(detail.earningsGrowth)} valueColor={detail.earningsGrowth >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />}
            {detail.revenueGrowth != null && <StatRow label="Revenue Growth" value={formatPct(detail.revenueGrowth)} valueColor={detail.revenueGrowth >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'} />}
            {detail.totalCash && <StatRow label="Cash" value={formatBigNum(detail.totalCash)} />}
            {detail.totalDebt && <StatRow label="Total Debt" value={formatBigNum(detail.totalDebt)} />}
            {detail.debtToEquity != null && <StatRow label="Debt/Equity" value={detail.debtToEquity.toFixed(2)} />}
            {detail.operatingCashflow && <StatRow label="Operating Cash Flow" value={formatBigNum(detail.operatingCashflow)} />}
            {detail.freeCashflow && <StatRow label="Free Cash Flow" value={formatBigNum(detail.freeCashflow)} />}
          </div>
        </div>
      )}

      {!isCrypto && detail?.recommendationTrend?.length > 0 && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Analyst Ratings" icon={<Users className="w-4 h-4 text-[#6da0f7]" />} />
          {detail.recommendationKey && (
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${
                detail.recommendationKey === 'buy' || detail.recommendationKey === 'strong_buy' ? 'bg-[#0f2d1f] text-[#10b981]' :
                detail.recommendationKey === 'sell' || detail.recommendationKey === 'strong_sell' ? 'bg-[#2d1520] text-[#ef4444]' :
                'bg-[#2d2810] text-[#f59e0b]'
              }`}>{detail.recommendationKey.replace('_', ' ').toUpperCase()}</span>
              {detail.numberOfAnalystOpinions > 0 && (
                <span className="text-[11px] text-[#555962]">{detail.numberOfAnalystOpinions} analysts</span>
              )}
            </div>
          )}

          {detail.targetMeanPrice && (
            <div className="mb-3">
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-2">Price Target Range</p>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[#ef4444] font-mono">${detail.targetLowPrice?.toFixed(2) || '---'}</span>
                <div className="flex-1 h-1.5 bg-[#22232b] rounded-full relative overflow-hidden">
                  {detail.targetLowPrice && detail.targetHighPrice && stock.price && (() => {
                    const range = detail.targetHighPrice - detail.targetLowPrice;
                    const pos = range > 0 ? Math.min(100, Math.max(0, ((stock.price - detail.targetLowPrice) / range) * 100)) : 50;
                    return (
                      <>
                        <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#ef4444] via-[#f59e0b] to-[#10b981] rounded-full opacity-50" style={{ width: '100%' }}></div>
                        <div className="absolute top-0 h-full w-0.5 bg-white rounded-full" style={{ left: `${pos}%` }}></div>
                      </>
                    );
                  })()}
                </div>
                <span className="text-[11px] text-[#10b981] font-mono">${detail.targetHighPrice?.toFixed(2) || '---'}</span>
              </div>
              <p className="text-[11px] text-[#868c98] mt-1.5 text-center">Mean: <span className="text-white font-semibold font-mono tabular-nums">${detail.targetMeanPrice.toFixed(2)}</span></p>
            </div>
          )}

          <div className="grid grid-cols-5 gap-1">
            {detail.recommendationTrend.slice(0, 1).map((t: any, idx: number) => {
              const total = (t.strongBuy || 0) + (t.buy || 0) + (t.hold || 0) + (t.sell || 0) + (t.strongSell || 0);
              if (total === 0) return null;
              const items = [
                { label: 'Strong Buy', val: t.strongBuy, color: '#10b981' },
                { label: 'Buy', val: t.buy, color: '#5dc47a' },
                { label: 'Hold', val: t.hold, color: '#f59e0b' },
                { label: 'Sell', val: t.sell, color: '#e06b6b' },
                { label: 'Strong Sell', val: t.strongSell, color: '#ef4444' },
              ];
              return items.map((item, i) => (
                <div key={i} className="text-center">
                  <div className="h-12 bg-[#1c1d24] rounded flex items-end justify-center pb-1 mb-1 border border-[#ffffff0f]">
                    <div className="w-4 rounded-t" style={{ height: `${Math.max(3, (item.val / total) * 40)}px`, backgroundColor: item.color }}></div>
                  </div>
                  <p className="text-[9px] text-[#555962]">{item.label}</p>
                  <p className="text-[11px] font-bold text-white">{item.val}</p>
                </div>
              ));
            })}
          </div>
        </div>
      )}

      {!isCrypto && detail?.earningsHistory?.length > 0 && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Earnings History" icon={<BarChart3 className="w-4 h-4 text-[#6da0f7]" />} />
          <div className="grid grid-cols-4 gap-2">
            {detail.earningsHistory.map((q: any, i: number) => {
              const beat = q.actual != null && q.estimate != null ? q.actual > q.estimate : null;
              return (
                <div key={i} className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                  <p className="text-[9px] text-[#555962] font-mono tabular-nums mb-0.5">{q.date}</p>
                  <p className={`text-[11px] font-bold tabular-nums font-mono ${beat ? 'text-[#10b981]' : beat === false ? 'text-[#ef4444]' : 'text-white'}`}>
                    {q.actual != null ? `$${q.actual.toFixed(2)}` : '---'}
                  </p>
                  <p className="text-[9px] text-[#555962] mt-0.5 font-mono tabular-nums">Est: {q.estimate != null ? `$${q.estimate.toFixed(2)}` : '---'}</p>
                  {beat != null && (
                    <span className={`text-[9px] font-bold ${beat ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                      {beat ? 'BEAT' : 'MISS'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isCrypto && detail && (detail.heldPercentInsiders != null || detail.topInstitutions?.length > 0) && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Ownership" icon={<Users className="w-4 h-4 text-[#7c5cbf]" />} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {detail.heldPercentInsiders != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Insiders</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatPct(detail.heldPercentInsiders)}</p>
              </div>
            )}
            {detail.heldPercentInstitutions != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Institutions</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatPct(detail.heldPercentInstitutions)}</p>
              </div>
            )}
            {detail.floatShares && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Float</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.floatShares)}</p>
              </div>
            )}
            {detail.shortPercentOfFloat != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Short %</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatPct(detail.shortPercentOfFloat)}</p>
              </div>
            )}
          </div>
          {detail.topInstitutions?.length > 0 && (
            <>
              <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-2">Top Holders</p>
              {detail.topInstitutions.slice(0, 5).map((inst: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-1" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span className="text-[11px] text-[#868c98] truncate max-w-[60%]">{inst.organization}</span>
                  <span className="text-[11px] text-white font-mono tabular-nums">{formatPct(inst.pctHeld)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {isCrypto && detail?.topExchanges?.length > 0 && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Supported Exchanges" icon={<Building2 className="w-4 h-4 text-[#6da0f7]" />} />
          <div className="space-y-1">
            {detail.topExchanges.map((ex: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#ffffff0f]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-white">{ex.exchange}</span>
                  <span className="text-[10px] text-[#555962]">{ex.pair}</span>
                </div>
                <div className="flex items-center gap-3">
                  {ex.volume && <span className="text-[10px] text-[#868c98] tabular-nums font-mono">{formatBigNum(ex.volume)}</span>}
                  {ex.trustScore && (
                    <span className={`w-1.5 h-1.5 rounded-full ${ex.trustScore === 'green' ? 'bg-[#10b981]' : ex.trustScore === 'yellow' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`}></span>
                  )}
                  {ex.tradeUrl && (
                    <a href={ex.tradeUrl} target="_blank" rel="noopener noreferrer" className="text-[#4c8bf5] hover:underline">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCrypto && detail && (detail.twitterFollowers || detail.redditSubscribers || detail.sentimentUpPercent) && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Social Traction" icon={<MessageCircle className="w-4 h-4 text-[#7c5cbf]" />} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
            {detail.twitterFollowers && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Twitter/X</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.twitterFollowers)}</p>
              </div>
            )}
            {detail.redditSubscribers && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Reddit</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.redditSubscribers)}</p>
              </div>
            )}
            {detail.watchlistUsers && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-0.5">Watchlists</p>
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.watchlistUsers)}</p>
              </div>
            )}
            {detail.sentimentUpPercent != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <p className="text-[9px] uppercase tracking-[0.06em] text-[#555962] font-medium mb-1">Sentiment</p>
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3 text-[#10b981]" />
                  <span className="text-[11px] font-bold text-[#10b981] font-mono tabular-nums">{detail.sentimentUpPercent?.toFixed(0)}%</span>
                  <TrendingDown className="w-3 h-3 text-[#ef4444] ml-1" />
                  <span className="text-[11px] font-bold text-[#ef4444] font-mono tabular-nums">{detail.sentimentDownPercent?.toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>

          {detail.links && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#ffffff0f]">
              {detail.links.twitter && (
                <a href={`https://x.com/${detail.links.twitter}`} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-[#1c1d24] text-[#4c8bf5] card-interactive border border-[#ffffff0f]">@{detail.links.twitter}</a>
              )}
              {detail.links.reddit && (
                <a href={detail.links.reddit} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-[#1c1d24] text-[#f59e0b] card-interactive border border-[#ffffff0f]">Reddit</a>
              )}
              {detail.links.telegram && (
                <a href={`https://t.me/${detail.links.telegram}`} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-[#1c1d24] text-[#6da0f7] card-interactive border border-[#ffffff0f]">Telegram</a>
              )}
              {detail.links.github?.length > 0 && (
                <a href={detail.links.github[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-[#1c1d24] text-[#868c98] card-interactive border border-[#ffffff0f]">GitHub</a>
              )}
              {detail.links.homepage?.length > 0 && detail.links.homepage[0] && (
                <a href={detail.links.homepage[0]} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-[#1c1d24] text-[#4c8bf5] card-interactive flex items-center gap-1 border border-[#ffffff0f]"><Globe className="w-3 h-3" /> Website</a>
              )}
            </div>
          )}
        </div>
      )}

      {isCrypto && detail && (detail.devStars || detail.devForks || detail.devCommit4Weeks) && (
        <div className={`${cardClass} p-3 mb-3`}>
          <SectionHeader title="Developer Activity" icon={<GitFork className="w-4 h-4 text-[#868c98]" />} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {detail.devStars != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <Star className="w-3.5 h-3.5 text-[#f59e0b] mx-auto mb-0.5" />
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.devStars)}</p>
                <p className="text-[9px] text-[#555962]">Stars</p>
              </div>
            )}
            {detail.devForks != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <GitFork className="w-3.5 h-3.5 text-[#6da0f7] mx-auto mb-0.5" />
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.devForks)}</p>
                <p className="text-[9px] text-[#555962]">Forks</p>
              </div>
            )}
            {detail.devCommit4Weeks != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <Activity className="w-3.5 h-3.5 text-[#10b981] mx-auto mb-0.5" />
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{detail.devCommit4Weeks}</p>
                <p className="text-[9px] text-[#555962]">Commits (4w)</p>
              </div>
            )}
            {detail.devPullRequests != null && (
              <div className="bg-[#1c1d24] rounded p-2 text-center border border-[#ffffff0f]">
                <MessageCircle className="w-3.5 h-3.5 text-[#6da0f7] mx-auto mb-0.5" />
                <p className="text-[11px] font-bold text-white tabular-nums font-mono">{formatSupply(detail.devPullRequests)}</p>
                <p className="text-[9px] text-[#555962]">PRs Merged</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="lg:hidden mb-3">
        <SectionHeader title="Related News" icon={<Newspaper className="w-4 h-4 text-[#4c8bf5]" />} />
        <div className="space-y-1">
          {relatedNews.slice(0, 6).map((item, i) => (
            <a href={item.url} target="_blank" rel="noopener noreferrer" key={i} className="block card-interactive rounded p-2">
              <p className="text-[11px] text-[#e4e8ee] leading-snug mb-1 line-clamp-2">{item.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#555962] truncate">{item.source}</span>
                <span className="text-[9px] text-[#555962]">{item.time}</span>
                <ExternalLink className="w-2.5 h-2.5 text-[#555962] ml-auto shrink-0" />
              </div>
            </a>
          ))}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 pointer-events-none flex items-start justify-center pt-20 z-50">
          <div className="bg-[#16171c] border border-[#ffffff0f] rounded px-4 py-2 flex items-center gap-2 shadow-lg pointer-events-auto">
            <div className="w-4 h-4 border-2 border-[#2a2b33] border-t-[#4c8bf5] rounded-full animate-spin"></div>
            <span className="text-[11px] text-[#868c98]">Loading details...</span>
          </div>
        </div>
      )}
    </div>
  );
};
