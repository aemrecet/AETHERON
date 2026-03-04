import { Router } from 'express';
import yahooFinance from 'yahoo-finance2';

const router = Router();

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const CG_KEY = process.env.COINGECKO_API_KEY || '';

function assignSentiment(title: string): 'Bullish' | 'Bearish' | 'Neutral' {
  const lower = title.toLowerCase();
  const bullishWords = ['surge', 'rally', 'jump', 'soar', 'gain', 'rise', 'bullish', 'record', 'high', 'up', 'boost', 'growth', 'positive', 'beats', 'outperform'];
  const bearishWords = ['crash', 'dump', 'plunge', 'drop', 'tumble', 'fall', 'bearish', 'loss', 'down', 'sell', 'decline', 'risk', 'warn', 'fear', 'miss'];

  const bullish = bullishWords.some(w => lower.includes(w));
  const bearish = bearishWords.some(w => lower.includes(w));

  if (bullish && !bearish) return 'Bullish';
  if (bearish && !bullish) return 'Bearish';
  return 'Neutral';
}

function assignCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('ethereum') || lower.includes('btc') || lower.includes('blockchain') || lower.includes('defi') || lower.includes('nft')) return 'Crypto';
  if (lower.includes('fed') || lower.includes('inflation') || lower.includes('gdp') || lower.includes('rate') || lower.includes('economic') || lower.includes('treasury') || lower.includes('cpi') || lower.includes('jobs')) return 'Macro';
  if (lower.includes('ai') || lower.includes('tech') || lower.includes('chip') || lower.includes('software') || lower.includes('nvidia') || lower.includes('semiconductor')) return 'Tech';
  if (lower.includes('forex') || lower.includes('currency') || lower.includes('dollar') || lower.includes('euro') || lower.includes('yen')) return 'Forex';
  if (lower.includes('earning') || lower.includes('stock') || lower.includes('ipo') || lower.includes('share') || lower.includes('market') || lower.includes('s&p') || lower.includes('nasdaq')) return 'Stocks';
  return 'General';
}

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

router.get('/news', async (_req, res) => {
  try {
    const allNews: any[] = [];
    const seen = new Set<string>();

    const addIfNew = (item: any) => {
      const key = item.title?.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        allNews.push(item);
      }
    };

    const sources = await Promise.allSettled([
      (async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`
        );
        const data = await response.json();
        return (Array.isArray(data) ? data : []).slice(0, 30).map((n: any) => ({
          id: n.id || Date.now() + Math.random(),
          title: n.headline || n.summary || '',
          source: n.source || 'Finnhub',
          time: n.datetime ? getRelativeTime(n.datetime * 1000) : 'Recent',
          datetime: n.datetime ? n.datetime * 1000 : Date.now(),
          category: assignCategory(n.headline || ''),
          sentiment: assignSentiment(n.headline || ''),
          url: n.url || '',
          imageUrl: n.image || '',
        }));
      })(),

      (async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/news?category=crypto&token=${FINNHUB_KEY}`
        );
        const data = await response.json();
        return (Array.isArray(data) ? data : []).slice(0, 15).map((n: any) => ({
          id: n.id || Date.now() + Math.random(),
          title: n.headline || '',
          source: n.source || 'Finnhub',
          time: n.datetime ? getRelativeTime(n.datetime * 1000) : 'Recent',
          datetime: n.datetime ? n.datetime * 1000 : Date.now(),
          category: 'Crypto',
          sentiment: assignSentiment(n.headline || ''),
          url: n.url || '',
          imageUrl: n.image || '',
        }));
      })(),

      (async () => {
        const response = await fetch(
          `https://finnhub.io/api/v1/news?category=forex&token=${FINNHUB_KEY}`
        );
        const data = await response.json();
        return (Array.isArray(data) ? data : []).slice(0, 10).map((n: any) => ({
          id: n.id || Date.now() + Math.random(),
          title: n.headline || '',
          source: n.source || 'Finnhub',
          time: n.datetime ? getRelativeTime(n.datetime * 1000) : 'Recent',
          datetime: n.datetime ? n.datetime * 1000 : Date.now(),
          category: 'Forex',
          sentiment: assignSentiment(n.headline || ''),
          url: n.url || '',
          imageUrl: n.image || '',
        }));
      })(),

      (async () => {
        const symbols = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'META'];
        const results: any[] = [];
        for (const sym of symbols.slice(0, 3)) {
          try {
            const result = await yahooFinance.search(sym, { newsCount: 3 });
            if (result.news) {
              result.news.forEach((n: any) => {
                results.push({
                  id: n.uuid || `${Date.now()}-${Math.random()}`,
                  title: n.title,
                  source: n.publisher || 'Yahoo Finance',
                  time: n.providerPublishTime
                    ? getRelativeTime(n.providerPublishTime * 1000)
                    : 'Recent',
                  datetime: n.providerPublishTime ? n.providerPublishTime * 1000 : Date.now(),
                  category: assignCategory(n.title || ''),
                  sentiment: assignSentiment(n.title || ''),
                  url: n.link || '',
                });
              });
            }
          } catch {}
        }
        return results;
      })(),

      (async () => {
        const cgUrl = new URL('https://api.coingecko.com/api/v3/news');
        if (CG_KEY) cgUrl.searchParams.set('x_cg_demo_api_key', CG_KEY);
        const response = await fetch(cgUrl.toString());
        const data = await response.json();
        return (data?.data || []).slice(0, 15).map((n: any) => ({
          id: n.id || Date.now() + Math.random(),
          title: n.title || '',
          source: n.author || 'CoinGecko',
          time: n.updated_at ? getRelativeTime(n.updated_at * 1000) : 'Recent',
          datetime: n.updated_at ? n.updated_at * 1000 : Date.now(),
          category: 'Crypto',
          sentiment: assignSentiment(n.title || ''),
          url: n.url || '',
          imageUrl: n.thumb_2x || '',
        }));
      })(),
    ]);

    sources.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        result.value.forEach(addIfNew);
      }
    });

    allNews.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
    res.json(allNews.slice(0, 80));
  } catch (err) {
    console.error('[news]', err);
    res.json([]);
  }
});

router.get('/economic-calendar', async (_req, res) => {
  try {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const to = new Date(now);
    to.setDate(to.getDate() + 30);

    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}&token=${FINNHUB_KEY}`
    );
    const data = await response.json();

    const events = (data?.economicCalendar || [])
      .filter((e: any) => e.country === 'US' || e.country === 'TR')
      .map((e: any) => ({
        date: e.date || '',
        country: e.country || '',
        event: e.event || '',
        category: e.impact === 'high' ? 'central_bank' : 'economic_data',
        impact: e.impact || 'low',
        description: e.event || '',
        actual: e.actual != null ? String(e.actual) : '',
        estimate: e.estimate != null ? String(e.estimate) : '',
        prev: e.prev != null ? String(e.prev) : '',
        unit: e.unit || '',
        source: 'Finnhub',
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({ events });
  } catch (err) {
    console.error('[economic-calendar]', err);
    res.json({ events: [] });
  }
});

export default router;
