import React, { useState, useEffect, useCallback } from 'react';
import { NewsItem } from '../types';
import { RefreshCw, TriangleAlert as AlertTriangle } from 'lucide-react';
import { fetchEconomicCalendar } from '../services/geminiService';

interface NewsViewProps {
  news: NewsItem[];
  onRefresh?: () => void;
}

interface EconEvent {
  date: string;
  country: string;
  event: string;
  category: string;
  impact: string;
  description: string;
  actual?: string;
  estimate?: string;
  prev?: string;
  unit?: string;
  source?: string;
}

function assignCategory(title: string, existingCat?: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('ethereum') || lower.includes('btc') || lower.includes('blockchain')) return 'Crypto';
  if (lower.includes('fed') || lower.includes('inflation') || lower.includes('gdp') || lower.includes('rate') || lower.includes('economic') || lower.includes('treasury')) return 'Macro';
  if (lower.includes('earning') || lower.includes('stock') || lower.includes('ipo') || lower.includes('share') || lower.includes('market')) return 'Stocks';
  if (lower.includes('ai') || lower.includes('tech') || lower.includes('chip') || lower.includes('software')) return 'Tech';
  if (lower.includes('forex') || lower.includes('currency') || lower.includes('dollar')) return 'Forex';
  if (existingCat && existingCat !== 'General') return existingCat;
  return 'General';
}

function assignTags(title: string, sentiment: string, confidence: number): { label: string; color: string; bg: string }[] {
  const lower = title.toLowerCase();
  const tags: { label: string; color: string; bg: string }[] = [];

  if (confidence >= 75 || lower.includes('breaking') || lower.includes('urgent') || lower.includes('alert')) {
    tags.push({ label: 'Important', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' });
  }

  if (lower.includes('whale') || lower.includes('large transfer') || lower.includes('million') || lower.includes('billion')) {
    tags.push({ label: 'Whale', color: '#1a6bdb', bg: 'rgba(26,107,219,0.08)' });
  }

  if (sentiment === 'Bullish' && (lower.includes('surge') || lower.includes('rally') || lower.includes('jump') || lower.includes('soar') || lower.includes('pump') || lower.includes('gain') || lower.includes('outperform'))) {
    tags.push({ label: 'Momentum', color: '#0d9f6e', bg: 'rgba(13,159,110,0.08)' });
  }

  if (sentiment === 'Bearish' && (lower.includes('crash') || lower.includes('dump') || lower.includes('plunge') || lower.includes('drop') || lower.includes('tumble') || lower.includes('sell') || lower.includes('loss'))) {
    tags.push({ label: 'Risk', color: '#d97706', bg: 'rgba(217,119,6,0.08)' });
  }

  if (lower.includes('accumulate') || lower.includes('buy') || lower.includes('inflow')) {
    tags.push({ label: 'Accumulate', color: '#1a6bdb', bg: 'rgba(26,107,219,0.08)' });
  }

  if (tags.length === 0) {
    tags.push({
      label: sentiment === 'Bullish' ? 'Bullish' : sentiment === 'Bearish' ? 'Bearish' : 'Neutral',
      color: sentiment === 'Bullish' ? '#0d9f6e' : sentiment === 'Bearish' ? '#d97706' : '#8b91a0',
      bg: sentiment === 'Bullish' ? 'rgba(13,159,110,0.08)' : sentiment === 'Bearish' ? 'rgba(217,119,6,0.08)' : 'rgba(139,145,160,0.1)',
    });
  }

  return tags.slice(0, 4);
}

function extractTokens(title: string): { name: string; color: string }[] {
  const tokens: { name: string; color: string }[] = [];
  const tokenMap: Record<string, string> = {
    BTC: '#f59e0b', Bitcoin: '#f59e0b', ETH: '#627eea', Ethereum: '#627eea',
    SOL: '#9945ff', Solana: '#9945ff', XRP: '#00aae4', BNB: '#f3ba2f',
    DOGE: '#c3a634', ADA: '#0033ad', AVAX: '#e84142', DOT: '#e6007a',
    MATIC: '#8247e5', LINK: '#2a5ada', UNI: '#ff007a', AAVE: '#b6509e',
    USDT: '#26a17b', USDC: '#2775ca', AAPL: '#555555', TSLA: '#cc0000',
    NVDA: '#76b900', MSFT: '#00a4ef', GOOG: '#4285f4', AMZN: '#ff9900',
    META: '#1877f2', Oil: '#888888', Gold: '#ffd700',
  };

  for (const [key, color] of Object.entries(tokenMap)) {
    if (title.includes(key)) tokens.push({ name: key, color });
  }

  return tokens.slice(0, 3);
}

function getDaysUntil(dateStr: string): number {
  const eventDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getCountryFlag(country: string): string {
  return country === 'US' ? 'US' : country === 'TR' ? 'TR' : '--';
}

function getImpactStyle(impact: string) {
  switch (impact) {
    case 'high':
      return { color: '#dc2626', bg: 'rgba(220,38,38,0.06)', text: 'HIGH' };
    case 'medium':
      return { color: '#d97706', bg: 'rgba(217,119,6,0.08)', text: 'MED' };
    default:
      return { color: '#8b91a0', bg: 'rgba(139,145,160,0.1)', text: 'LOW' };
  }
}

export const NewsView: React.FC<NewsViewProps> = ({ news, onRefresh }) => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [activeTab, setActiveTab] = useState<'news' | 'calendar'>('news');
  const [calendarEvents, setCalendarEvents] = useState<EconEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'US' | 'TR'>('all');
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'all' | 'central_bank' | 'economic_data' | 'report'>('all');

  useEffect(() => {
    setLastRefresh(Date.now());
  }, [news]);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastRefresh) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setCountdown(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [lastRefresh]);

  useEffect(() => {
    if (activeTab === 'calendar' && calendarEvents.length === 0) {
      setCalendarLoading(true);
      fetchEconomicCalendar().then(data => {
        setCalendarEvents(data.events || []);
        setCalendarLoading(false);
      });
    }
  }, [activeTab, calendarEvents.length]);

  const handleManualRefresh = useCallback(() => {
    if (activeTab === 'calendar') {
      setCalendarLoading(true);
      fetchEconomicCalendar().then(data => {
        setCalendarEvents(data.events || []);
        setCalendarLoading(false);
      });
      return;
    }

    if (onRefresh) {
      setRefreshing(true);
      onRefresh();
      setLastRefresh(Date.now());
      setTimeout(() => setRefreshing(false), 2000);
    }
  }, [onRefresh, activeTab]);

  const enrichedNews = news.map(item => ({
    ...item,
    category: item.category || assignCategory(item.title),
    confidence: item.confidence || 35,
  }));

  const categories = ['All', 'Stocks', 'Crypto', 'Macro', 'Tech', 'Forex', 'General'];
  const filteredNews = activeFilter === 'All' ? enrichedNews : enrichedNews.filter(n => n.category === activeFilter);

  const bullishCount = enrichedNews.filter(n => n.sentiment === 'Bullish').length;
  const bearishCount = enrichedNews.filter(n => n.sentiment === 'Bearish').length;
  const neutralCount = enrichedNews.filter(n => n.sentiment === 'Neutral').length;
  const total = enrichedNews.length || 1;

  const feed = filteredNews;
  const formatCountdownStr = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const bullishRatio = ((bullishCount / total) * 100).toFixed(0);

  const filteredCalendarEvents = calendarEvents.filter(e => {
    if (calendarFilter !== 'all' && e.country !== calendarFilter) return false;
    if (calendarCategoryFilter !== 'all' && e.category !== calendarCategoryFilter) return false;
    return true;
  });

  const nextEvent = calendarEvents.length > 0 ? calendarEvents[0] : null;
  const nextEventDays = nextEvent ? getDaysUntil(nextEvent.date) : null;

  return (
    <div className="space-y-3 sm:space-y-4 view-animate">
      <div className="card p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#4a4f5c] font-semibold">Signal Desk</p>
            <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#0a0a23] tracking-[-0.02em] mt-1">
              {activeTab === 'news' ? 'Market News Intelligence' : 'Economic Calendar Intelligence'}
            </h2>
          </div>
          <button
            onClick={handleManualRefresh}
            className="h-9 px-3 rounded-lg border border-[#e2e5ea] bg-[#f4f5f7] hover:bg-[#eef0f4] transition-colors text-[#4a4f5c] text-[11px] font-medium inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || calendarLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Coverage</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">
              {activeTab === 'news' ? enrichedNews.length : calendarEvents.length}
            </p>
          </div>

          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Auto Cycle</p>
            <p className="text-[16px] font-semibold text-[#0a0a23] font-mono tabular-nums mt-0.5">
              {activeTab === 'news' ? formatCountdownStr(countdown) : 'Manual'}
            </p>
          </div>

          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Bullish Share</p>
            <p className="text-[16px] font-semibold text-[#0d9f6e] font-mono tabular-nums mt-0.5">{bullishRatio}%</p>
          </div>

          <div className="rounded-lg border border-[#e2e5ea] bg-[#fff] px-3 py-2.5">
            <p className="text-[10px] text-[#4a4f5c] uppercase tracking-[0.06em]">Focus</p>
            <p className="text-[13px] font-semibold text-[#0a0a23] mt-1">
              {activeTab === 'news' ? 'Flows & sentiment' : 'Macro event risk'}
            </p>
          </div>
        </div>

        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide pb-0.5">
          <button onClick={() => setActiveTab('news')} className={`tab-btn ${activeTab === 'news' ? 'tab-btn-active' : ''}`}>News</button>
          <button onClick={() => setActiveTab('calendar')} className={`tab-btn ${activeTab === 'calendar' ? 'tab-btn-active' : ''}`}>Economic Calendar</button>
        </div>
      </div>

      {activeTab === 'news' ? (
        <>
          <div className="card p-3 sm:p-3.5 flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-[#0d9f6e] font-semibold font-mono tabular-nums">{bullishCount} Bullish</span>
              <span className="text-[#8b91a0]">·</span>
              <span className="text-[#dc2626] font-semibold font-mono tabular-nums">{bearishCount} Bearish</span>
              <span className="text-[#8b91a0]">·</span>
              <span className="text-[#8b91a0] font-mono tabular-nums">{neutralCount} Neutral</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-[#f4f5f7] overflow-hidden flex">
              <div className="bg-[#0d9f6e] h-full transition-all duration-700" style={{ width: `${(bullishCount / total) * 100}%` }}></div>
              <div className="bg-[#8b91a0] h-full transition-all duration-700" style={{ width: `${(neutralCount / total) * 100}%` }}></div>
              <div className="bg-[#dc2626] h-full transition-all duration-700" style={{ width: `${(bearishCount / total) * 100}%` }}></div>
            </div>
            <span className={`text-[10px] font-semibold ${bullishCount > bearishCount ? 'text-[#0d9f6e]' : bearishCount > bullishCount ? 'text-[#dc2626]' : 'text-[#8b91a0]'}`}>
              {bullishCount > bearishCount ? 'Bullish Tilt' : bearishCount > bullishCount ? 'Bearish Tilt' : 'Balanced'}
            </span>
          </div>

          <div className="card p-2">
            <div className="flex gap-1 overflow-x-auto pb-1 px-1 scrollbar-hide">
              {categories.map(cat => {
                const count = cat === 'All' ? enrichedNews.length : enrichedNews.filter(n => n.category === cat).length;
                return (
                  <button key={cat} onClick={() => setActiveFilter(cat)} className={`tab-btn text-[10px] ${cat === activeFilter ? 'tab-btn-active' : ''}`}>
                    {cat} <span className="text-[9px] opacity-65 ml-0.5">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {feed.map((item, idx) => {
              const conf = item.confidence || 35;
              const tags = assignTags(item.title, item.sentiment || 'Neutral', conf);
              const tokens = extractTokens(item.title);
              const entities = item.source ? [item.source] : [];

              return (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={idx}
                  className="card-interactive rounded-lg p-3 flex flex-col gap-2.5 cursor-pointer"
                  style={{ background: '#fff', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                        style={{ color: tag.color, background: tag.bg }}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>

                  <p className="text-[12px] font-medium leading-snug text-[#0a0a23] line-clamp-2 flex-1">{item.title}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    {tokens.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-[#8b91a0]">Tokens</span>
                        {tokens.map((t, i) => (
                          <div key={i} className="w-2 h-2 rounded-full" style={{ background: t.color }} title={t.name}></div>
                        ))}
                      </div>
                    )}

                    {entities.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-[#8b91a0]">Source:</span>
                        <span className="text-[9px] text-[#4a4f5c]">{entities[0]}</span>
                      </div>
                    )}

                    <span className="text-[9px] text-[#8b91a0] font-mono tabular-nums ml-auto">{item.time}</span>
                  </div>
                </a>
              );
            })}

            {enrichedNews.length === 0 && (
              <div className="col-span-full p-10 card text-center text-[#8b91a0]">Loading market feeds...</div>
            )}
          </div>
        </>
      ) : (
        <>
          {nextEvent && nextEventDays !== null && (
            <div className="card p-3 flex items-center gap-3">
              <AlertTriangle className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
              <span className="text-[9px] uppercase tracking-[0.08em] text-[#d97706] font-semibold shrink-0">Next Event</span>
              <span className="text-[11px] font-semibold text-[#0a0a23] truncate flex-1">{nextEvent.event}</span>
              <span className="text-[9px] text-[#8b91a0] font-mono tabular-nums shrink-0">{formatEventDate(nextEvent.date)}</span>
              <span className={`text-[11px] font-bold font-mono tabular-nums shrink-0 ${nextEventDays <= 3 ? 'text-[#dc2626]' : nextEventDays <= 7 ? 'text-[#d97706]' : 'text-[#1a6bdb]'}`}>
                {nextEventDays === 0 ? 'TODAY' : `${nextEventDays}d`}
              </span>
            </div>
          )}

          <div className="card p-2">
            <div className="flex gap-1 overflow-x-auto pb-1 px-1 scrollbar-hide">
              {([['all', 'All'], ['US', 'US'], ['TR', 'TR']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setCalendarFilter(key as any)} className={`tab-btn text-[10px] ${calendarFilter === key ? 'tab-btn-active' : ''}`}>
                  {label}
                </button>
              ))}
              <div className="w-px bg-[#e2e5ea] mx-1 self-stretch"></div>
              {([['all', 'All Types'], ['central_bank', 'Central Bank'], ['economic_data', 'Data'], ['report', 'Reports']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setCalendarCategoryFilter(key as any)} className={`tab-btn text-[10px] ${calendarCategoryFilter === key ? 'tab-btn-active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {calendarLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#e2e5ea] border-t-[#1a6bdb] rounded-full animate-spin"></div>
            </div>
          ) : filteredCalendarEvents.length === 0 ? (
            <div className="p-10 card text-center text-[#8b91a0]">No events found for this filter.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="text-left text-[10px] uppercase tracking-[0.07em] text-[#8b91a0] font-semibold px-2.5 py-2">Date</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.07em] text-[#8b91a0] font-semibold px-2.5 py-2">Country</th>
                    <th className="text-left text-[10px] uppercase tracking-[0.07em] text-[#8b91a0] font-semibold px-2.5 py-2">Event</th>
                    <th className="text-center text-[10px] uppercase tracking-[0.07em] text-[#8b91a0] font-semibold px-2.5 py-2">Impact</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.07em] text-[#8b91a0] font-semibold px-2.5 py-2">Value</th>
                    <th className="text-right text-[10px] uppercase tracking-[0.07em] text-[#8b91a0] font-semibold px-2.5 py-2">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalendarEvents.map((evt, idx) => {
                    const daysUntil = getDaysUntil(evt.date);
                    const impactStyle = getImpactStyle(evt.impact);
                    const isToday = daysUntil === 0;

                    return (
                      <tr key={`${evt.date}-${evt.event}-${idx}`} className={`table-row table-row-stripe border-t border-[#eef0f4] ${isToday ? 'bg-[rgba(220,38,38,0.04)]' : ''}`}>
                        <td className="px-2.5 py-2 text-[10px] text-[#4a4f5c] font-mono tabular-nums whitespace-nowrap">{formatEventDate(evt.date)}</td>
                        <td className="px-2.5 py-2 text-[10px] text-[#4a4f5c]">{getCountryFlag(evt.country)}</td>
                        <td className="px-2.5 py-2">
                          <span className="text-[11px] font-medium text-[#0a0a23] truncate block max-w-[320px]">{evt.event}</span>
                          <span className="text-[9px] text-[#8b91a0] truncate block max-w-[320px]">{evt.description}</span>
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{ color: impactStyle.color, background: impactStyle.bg }}>
                            {impactStyle.text}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-right text-[10px] font-mono tabular-nums">
                          {evt.actual ? (
                            <span className="text-[#0d9f6e]">{evt.actual}{evt.unit || ''}</span>
                          ) : evt.estimate ? (
                            <span className="text-[#d97706]">Est: {evt.estimate}{evt.unit || ''}</span>
                          ) : (
                            <span className="text-[#8b91a0]">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <span className={`text-[10px] font-bold font-mono tabular-nums ${isToday ? 'text-[#dc2626]' : daysUntil <= 7 ? 'text-[#d97706]' : 'text-[#4a4f5c]'}`}>
                            {isToday ? 'TODAY' : `${daysUntil}d`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
