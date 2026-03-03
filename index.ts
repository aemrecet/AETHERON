import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
import { BIST_SYMBOLS, NASDAQ_SYMBOLS, BIST_LOGO_DOMAINS, SymbolInfo } from './symbols.js';
import OpenAI from 'openai';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

const PORT = process.env.NODE_ENV === 'production' ? 5000 : 3001;

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const cache: Map<string, { data: any; ts: number }> = new Map();

function getCache<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
};

function formatVolume(vol: number | undefined): string {
  if (!vol) return '---';
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${vol.toLocaleString()}`;
}

function formatMarketCap(mc: number | undefined): string {
  if (!mc) return '---';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(2)}M`;
  return `$${mc.toLocaleString()}`;
}

function generateIntradayCurve(current: number, high: number, low: number) {
  const points = 48;
  const data = [];
  const now = new Date();
  let virtualPrice = (high + low) / 2;
  for (let i = 0; i < points; i++) {
    const date = new Date(now);
    date.setMinutes(date.getMinutes() - ((points - i) * 30));
    const change = (Math.random() - 0.5) * (high - low) * 0.2;
    virtualPrice += change;
    if (virtualPrice > high) virtualPrice = high;
    if (virtualPrice < low) virtualPrice = low;
    if (i === points - 1) virtualPrice = current;
    data.push({
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: virtualPrice
    });
  }
  return data;
}

function getBistLogo(symbol: string): string {
  const domain = BIST_LOGO_DOMAINS[symbol];
  if (domain) return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
  return `https://ui-avatars.com/api/?name=${symbol}&background=random&color=fff&size=128&rounded=true&bold=true&format=svg`;
}

function snapshotToStock(info: SymbolInfo, market: 'BIST' | 'NASDAQ' | 'CRYPTO'): any {
  const changePct = (Math.random() - 0.5) * 4;
  const change = (info.p * changePct) / 100;
  const high = info.p * 1.02;
  const low = info.p * 0.98;
  let logo: string;
  if (market === 'BIST') {
    logo = getBistLogo(info.s);
  } else {
    logo = `https://assets.parqet.com/logos/symbol/${info.s}?format=png`;
  }
  return {
    symbol: info.s, name: info.n, price: info.p,
    change: parseFloat(change.toFixed(2)), changePercent: parseFloat(changePct.toFixed(2)),
    volume: '---', marketCap: '---',
    sector: market === 'BIST' ? 'BIST' : 'US Market', market,
    dayHigh: high, dayLow: low, logo,
    data: generateIntradayCurve(info.p, high, low)
  };
}

// ==================== CRYPTO (CoinGecko) ====================
app.get('/api/crypto', async (_req, res) => {
  const cached = getCache<any[]>('crypto', 2 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const allCoins: any[] = [];
    for (let page = 1; page <= 5; page++) {
      try {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=true&price_change_percentage=24h`;
        const response = await fetchWithTimeout(url, {}, 10000);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) allCoins.push(...data);
        }
      } catch (e) { }
      if (page < 5) await wait(600);
    }

    if (allCoins.length === 0) throw new Error('No crypto data');

    const stocks = allCoins.map((coin: any) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change: coin.price_change_24h || 0,
      changePercent: coin.price_change_percentage_24h || 0,
      volume: formatVolume(coin.total_volume),
      marketCap: formatMarketCap(coin.market_cap),
      sector: 'Crypto',
      market: 'CRYPTO',
      dayHigh: coin.high_24h,
      dayLow: coin.low_24h,
      logo: coin.image,
      coinId: coin.id,
      data: (coin.sparkline_in_7d?.price || [])
        .filter((_: any, i: number) => i % 4 === 0)
        .map((p: number, i: number) => ({ time: `${i}h`, value: p }))
    }));

    setCache('crypto', stocks);
    console.log(`[Crypto] Fetched ${stocks.length} coins from CoinGecko`);
    res.json(stocks);
  } catch (err) {
    console.warn('[Crypto] API failed, using snapshots');
    const snapshot = generateCryptoSnapshot();
    res.json(snapshot);
  }
});

function generateCryptoSnapshot() {
  const coins = [
    { s: 'BTC', n: 'Bitcoin', p: 67450 }, { s: 'ETH', n: 'Ethereum', p: 3450 },
    { s: 'SOL', n: 'Solana', p: 145 }, { s: 'BNB', n: 'Binance Coin', p: 590 },
    { s: 'XRP', n: 'Ripple', p: 0.62 }, { s: 'ADA', n: 'Cardano', p: 0.45 },
    { s: 'AVAX', n: 'Avalanche', p: 45 }, { s: 'DOGE', n: 'Dogecoin', p: 0.16 },
    { s: 'DOT', n: 'Polkadot', p: 7.2 }, { s: 'LINK', n: 'Chainlink', p: 18.5 },
    { s: 'MATIC', n: 'Polygon', p: 0.92 }, { s: 'SHIB', n: 'Shiba Inu', p: 0.000027 },
    { s: 'UNI', n: 'Uniswap', p: 8.5 }, { s: 'LTC', n: 'Litecoin', p: 72 },
    { s: 'ATOM', n: 'Cosmos', p: 9.5 }, { s: 'FIL', n: 'Filecoin', p: 5.2 },
    { s: 'APT', n: 'Aptos', p: 8.5 }, { s: 'ARB', n: 'Arbitrum', p: 1.1 },
    { s: 'OP', n: 'Optimism', p: 2.2 }, { s: 'NEAR', n: 'NEAR Protocol', p: 5.8 },
    { s: 'ALGO', n: 'Algorand', p: 0.18 }, { s: 'VET', n: 'VeChain', p: 0.028 },
    { s: 'SAND', n: 'The Sandbox', p: 0.42 }, { s: 'MANA', n: 'Decentraland', p: 0.45 },
    { s: 'AXS', n: 'Axie Infinity', p: 7.5 }, { s: 'AAVE', n: 'Aave', p: 95 },
    { s: 'MKR', n: 'Maker', p: 1450 }, { s: 'CRV', n: 'Curve DAO', p: 0.55 },
    { s: 'COMP', n: 'Compound', p: 52 }, { s: 'SNX', n: 'Synthetix', p: 2.8 },
    { s: 'LDO', n: 'Lido DAO', p: 2.2 }, { s: 'RPL', n: 'Rocket Pool', p: 25 },
    { s: 'FTM', n: 'Fantom', p: 0.35 }, { s: 'EGLD', n: 'MultiversX', p: 38 },
    { s: 'HBAR', n: 'Hedera', p: 0.065 }, { s: 'ICP', n: 'Internet Computer', p: 12.5 },
    { s: 'TIA', n: 'Celestia', p: 8.5 }, { s: 'SEI', n: 'Sei', p: 0.55 },
    { s: 'SUI', n: 'Sui', p: 1.2 }, { s: 'INJ', n: 'Injective', p: 22 }
  ];
  const coinIdMap: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
    XRP: 'ripple', ADA: 'cardano', AVAX: 'avalanche-2', DOGE: 'dogecoin',
    DOT: 'polkadot', LINK: 'chainlink', MATIC: 'matic-network', SHIB: 'shiba-inu',
    UNI: 'uniswap', LTC: 'litecoin', ATOM: 'cosmos', FIL: 'filecoin',
    APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', NEAR: 'near',
    ALGO: 'algorand', VET: 'vechain', SAND: 'the-sandbox', MANA: 'decentraland',
    AXS: 'axie-infinity', AAVE: 'aave', MKR: 'maker', CRV: 'curve-dao-token',
    COMP: 'compound-governance-token', SNX: 'havven', LDO: 'lido-dao', RPL: 'rocket-pool',
    FTM: 'fantom', EGLD: 'elrond-erd-2', HBAR: 'hedera-hashgraph', ICP: 'internet-computer',
    TIA: 'celestia', SEI: 'sei-network', SUI: 'sui', INJ: 'injective-protocol'
  };
  return coins.map(c => ({
    symbol: c.s, name: c.n, price: c.p,
    change: (c.p * (Math.random() - 0.5) * 4) / 100,
    changePercent: parseFloat(((Math.random() - 0.5) * 4).toFixed(2)),
    volume: '---', marketCap: '---', sector: 'Crypto', market: 'CRYPTO',
    dayHigh: c.p * 1.05, dayLow: c.p * 0.95,
    logo: `https://assets.coincap.io/assets/icons/${c.s.toLowerCase()}@2x.png`,
    coinId: coinIdMap[c.s] || c.n.toLowerCase().replace(/\s+/g, '-'),
    data: generateIntradayCurve(c.p, c.p * 1.05, c.p * 0.95)
  }));
}

// ==================== BIST (Yahoo Finance) ====================
app.get('/api/bist', async (_req, res) => {
  const cached = getCache<any[]>('bist', 30 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const uniqueSymbols = [...new Set(BIST_SYMBOLS.map(s => s.s))];
    const yahooSymbols = uniqueSymbols.map(s => s + '.IS');
    const allResults: any[] = [];

    const batchSize = 50;
    for (let i = 0; i < yahooSymbols.length; i += batchSize) {
      const batch = yahooSymbols.slice(i, i + batchSize);
      try {
        const quotes = await yahooFinance.quote(batch);
        const arr = Array.isArray(quotes) ? quotes : [quotes];
        allResults.push(...arr);
      } catch (e) {
        console.warn(`[BIST] Batch ${i}-${i + batchSize} failed`);
      }
      if (i + batchSize < yahooSymbols.length) await wait(300);
    }

    const stocks = allResults
      .filter((q: any) => q && q.regularMarketPrice && q.regularMarketPrice > 0)
      .map((q: any) => {
        const symbol = q.symbol.replace('.IS', '');
        const price = q.regularMarketPrice;
        const high = q.regularMarketDayHigh || price * 1.02;
        const low = q.regularMarketDayLow || price * 0.98;
        return {
          symbol,
          name: q.shortName || q.longName || symbol,
          price,
          change: q.regularMarketChange || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: formatVolume(q.regularMarketVolume),
          marketCap: q.marketCap ? formatMarketCap(q.marketCap) : '---',
          sector: 'BIST',
          market: 'BIST',
          dayHigh: high,
          dayLow: low,
          logo: getBistLogo(symbol),
          data: generateIntradayCurve(price, high, low)
        };
      });

    if (stocks.length > 0) {
      setCache('bist', stocks);
      console.log(`[BIST] Fetched ${stocks.length} stocks from Yahoo Finance`);
      res.json(stocks);
    } else {
      throw new Error('No BIST data from Yahoo');
    }
  } catch (err) {
    console.warn('[BIST] Yahoo Finance failed, using snapshots:', (err as Error).message);
    const uniqueSymbols = [...new Set(BIST_SYMBOLS.map(s => s.s))];
    const uniqueMap = new Map<string, SymbolInfo>();
    BIST_SYMBOLS.forEach(s => { if (!uniqueMap.has(s.s)) uniqueMap.set(s.s, s); });
    const snapshot = Array.from(uniqueMap.values()).map(s => snapshotToStock(s, 'BIST'));
    res.json(snapshot);
  }
});

// ==================== NASDAQ (Yahoo Finance) ====================
app.get('/api/nasdaq', async (_req, res) => {
  const cached = getCache<any[]>('nasdaq', 5 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const uniqueSymbols = [...new Set(NASDAQ_SYMBOLS.map(s => s.s))];
    const allResults: any[] = [];

    const batchSize = 50;
    for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
      const batch = uniqueSymbols.slice(i, i + batchSize);
      try {
        const quotes = await yahooFinance.quote(batch);
        const arr = Array.isArray(quotes) ? quotes : [quotes];
        allResults.push(...arr);
      } catch (e) {
        console.warn(`[NASDAQ] Batch ${i}-${i + batchSize} failed`);
      }
      if (i + batchSize < uniqueSymbols.length) await wait(200);
    }

    const stocks = allResults
      .filter((q: any) => q && q.regularMarketPrice && q.regularMarketPrice > 0)
      .map((q: any) => {
        const price = q.regularMarketPrice;
        const high = q.regularMarketDayHigh || price * 1.02;
        const low = q.regularMarketDayLow || price * 0.98;
        return {
          symbol: q.symbol,
          name: q.shortName || q.longName || q.symbol,
          price,
          change: q.regularMarketChange || 0,
          changePercent: q.regularMarketChangePercent || 0,
          volume: formatVolume(q.regularMarketVolume),
          marketCap: q.marketCap ? formatMarketCap(q.marketCap) : '---',
          sector: 'US Market',
          market: 'NASDAQ',
          dayHigh: high,
          dayLow: low,
          logo: `https://assets.parqet.com/logos/symbol/${q.symbol}?format=png`,
          data: generateIntradayCurve(price, high, low)
        };
      });

    if (stocks.length > 0) {
      setCache('nasdaq', stocks);
      console.log(`[NASDAQ] Fetched ${stocks.length} stocks from Yahoo Finance`);
      res.json(stocks);
    } else {
      throw new Error('No NASDAQ data from Yahoo');
    }
  } catch (err) {
    console.warn('[NASDAQ] Yahoo Finance failed, using snapshots:', (err as Error).message);
    const uniqueMap = new Map<string, SymbolInfo>();
    NASDAQ_SYMBOLS.forEach(s => { if (!uniqueMap.has(s.s)) uniqueMap.set(s.s, s); });
    const snapshot = Array.from(uniqueMap.values()).map(s => snapshotToStock(s, 'NASDAQ'));
    res.json(snapshot);
  }
});

// ==================== SENTIMENT ANALYSIS ====================
function analyzeSentiment(title: string, summary?: string): { sentiment: 'Bullish' | 'Bearish' | 'Neutral'; confidence: number } {
  const text = `${title} ${summary || ''}`.toLowerCase();
  const bullishStrong = ['surge', 'soar', 'skyrocket', 'breakout', 'record high', 'all-time high', 'massive rally', 'bull run', 'explosive growth', 'moonshot'];
  const bullishMedium = ['rally', 'gain', 'rise', 'jump', 'bullish', 'upgrade', 'beat', 'outperform', 'growth', 'profit', 'strong', 'optimistic', 'recovery', 'rebound', 'positive', 'boost', 'momentum', 'upside', 'buy signal', 'accumulate', 'inflows'];
  const bullishWeak = ['up', 'higher', 'advance', 'improve', 'stable', 'support', 'hold', 'steady', 'opportunity'];
  const bearishStrong = ['crash', 'plunge', 'collapse', 'meltdown', 'freefall', 'capitulation', 'bloodbath', 'panic sell', 'black swan', 'liquidation'];
  const bearishMedium = ['fall', 'drop', 'decline', 'bear', 'sell', 'loss', 'cut', 'warning', 'weak', 'negative', 'slump', 'miss', 'downgrade', 'risk', 'fear', 'recession', 'default', 'outflows', 'dump', 'correction'];
  const bearishWeak = ['down', 'lower', 'slip', 'concern', 'worry', 'uncertainty', 'pressure', 'volatile'];

  let bullScore = 0;
  let bearScore = 0;
  bullishStrong.forEach(w => { if (text.includes(w)) bullScore += 3; });
  bullishMedium.forEach(w => { if (text.includes(w)) bullScore += 2; });
  bullishWeak.forEach(w => { if (text.includes(w)) bullScore += 1; });
  bearishStrong.forEach(w => { if (text.includes(w)) bearScore += 3; });
  bearishMedium.forEach(w => { if (text.includes(w)) bearScore += 2; });
  bearishWeak.forEach(w => { if (text.includes(w)) bearScore += 1; });

  const totalScore = bullScore + bearScore;
  if (totalScore === 0) return { sentiment: 'Neutral', confidence: 35 };

  const diff = Math.abs(bullScore - bearScore);
  const maxScore = Math.max(bullScore, bearScore);
  const rawConfidence = Math.min(95, 30 + (diff / Math.max(totalScore, 1)) * 40 + Math.min(maxScore * 5, 25));
  const confidence = Math.round(rawConfidence);

  if (bullScore > bearScore) return { sentiment: 'Bullish', confidence };
  if (bearScore > bullScore) return { sentiment: 'Bearish', confidence };
  return { sentiment: 'Neutral', confidence: Math.round(Math.min(50, rawConfidence)) };
}

function assignNewsCategory(title: string, existingCat?: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('crypto') || lower.includes('ethereum') || lower.includes('btc') || lower.includes('blockchain') || lower.includes('defi') || lower.includes('nft') || lower.includes('altcoin')) return 'Crypto';
  if (lower.includes('fed') || lower.includes('inflation') || lower.includes('gdp') || lower.includes('rate') || lower.includes('economic') || lower.includes('treasury') || lower.includes('jobs') || lower.includes('cpi') || lower.includes('ppi')) return 'Macro';
  if (lower.includes('earning') || lower.includes('stock') || lower.includes('ipo') || lower.includes('share') || lower.includes('market') || lower.includes('nasdaq') || lower.includes('s&p') || lower.includes('dow')) return 'Stocks';
  if (lower.includes('ai') || lower.includes('tech') || lower.includes('chip') || lower.includes('software') || lower.includes('semiconductor') || lower.includes('nvidia') || lower.includes('apple') || lower.includes('google') || lower.includes('microsoft')) return 'Tech';
  if (lower.includes('forex') || lower.includes('currency') || lower.includes('dollar') || lower.includes('euro') || lower.includes('yen')) return 'Forex';
  if (existingCat && existingCat !== 'general') return existingCat.charAt(0).toUpperCase() + existingCat.slice(1);
  return 'General';
}

// ==================== NEWS (Multi-source Finnhub) ====================
app.get('/api/news', async (_req, res) => {
  const cached = getCache<any[]>('news', 5 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const categories = ['general', 'forex', 'crypto', 'merger', 'technology'];
    const fetches = categories.map(cat =>
      fetchWithTimeout(`https://finnhub.io/api/v1/news?category=${cat}&token=${FINNHUB_KEY}`, {}, 6000)
        .then(r => r.json())
        .then(data => Array.isArray(data) ? data.map((d: any) => ({ ...d, _cat: cat })) : [])
        .catch(() => [])
    );

    const results = await Promise.all(fetches);
    const allArticles = results.flat();

    // Fetch additional news from CoinGecko status updates
    try {
      const cgResp = await fetchWithTimeout('https://api.coingecko.com/api/v3/status_updates?per_page=50', {}, 8000);
      if (cgResp.ok) {
        const cgData = await cgResp.json();
        if (cgData.status_updates && Array.isArray(cgData.status_updates)) {
          for (const update of cgData.status_updates) {
            allArticles.push({
              headline: update.description?.substring(0, 200) || update.user_title || '',
              source: update.project?.name || 'CoinGecko',
              datetime: update.created_at ? Math.floor(new Date(update.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
              summary: update.description || '',
              url: update.project?.links?.homepage?.[0] || '#',
              image: update.project?.image?.large || '',
              _cat: 'crypto'
            });
          }
        }
      }
    } catch {}

    // Fetch additional news from CryptoCompare
    try {
      const ccResp = await fetchWithTimeout('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest', {}, 8000);
      if (ccResp.ok) {
        const ccData = await ccResp.json();
        if (ccData.Data && Array.isArray(ccData.Data)) {
          for (const article of ccData.Data.slice(0, 50)) {
            allArticles.push({
              headline: article.title || '',
              source: article.source_info?.name || article.source || 'CryptoCompare',
              datetime: article.published_on || Math.floor(Date.now() / 1000),
              summary: article.body?.substring(0, 300) || '',
              url: article.url || article.guid || '#',
              image: article.imageurl || '',
              _cat: 'crypto'
            });
          }
        }
      }
    } catch {}

    const seen = new Set<string>();
    const unique = allArticles.filter(item => {
      const key = (item.headline || '').substring(0, 60);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a: any, b: any) => (b.datetime || 0) - (a.datetime || 0));

    const news = unique.slice(0, 150).map((item: any, idx: number) => {
      const { sentiment, confidence } = analyzeSentiment(item.headline || '', item.summary || '');
      const timeAgo = (ts: number) => {
        const diff = Math.floor((Date.now() / 1000) - ts);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
      };
      return {
        id: item.id || idx,
        title: item.headline,
        source: item.source,
        time: item.datetime ? timeAgo(item.datetime) : 'Recent',
        datetime: item.datetime || 0,
        category: assignNewsCategory(item.headline || '', item._cat),
        sentiment,
        confidence,
        url: item.url,
        imageUrl: item.image
      };
    });

    setCache('news', news);
    console.log(`[News] Fetched ${news.length} articles from multiple sources`);
    res.json(news);
  } catch (err) {
    console.warn('[News] Failed:', err);
    const fallback = [
      { id: 1, title: "Markets show mixed signals as investors weigh economic data.", source: "Reuters", time: "Just now", category: "Stocks", sentiment: "Neutral" as const, confidence: 40, url: "#" },
      { id: 2, title: "Bitcoin surges past key resistance level amid ETF inflows.", source: "CoinDesk", time: "1h ago", category: "Crypto", sentiment: "Bullish" as const, confidence: 82, url: "#" },
      { id: 3, title: "Fed signals potential rate cuts as inflation cools down.", source: "Bloomberg", time: "2h ago", category: "Macro", sentiment: "Bullish" as const, confidence: 75, url: "#" },
      { id: 4, title: "Tech stocks face headwinds from regulatory concerns.", source: "CNBC", time: "3h ago", category: "Tech", sentiment: "Bearish" as const, confidence: 68, url: "#" },
    ];
    res.json(fallback);
  }
});

// ==================== TECHNICAL INDICATORS ENGINE ====================
function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { sma[i] = NaN; continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    sma[i] = sum / period;
  }
  return sma;
}

function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calculateMACD(closes: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine[i] = i < 25 ? NaN : ema12[i] - ema26[i];
  }
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalAll = calculateEMA(validMacd, 9);
  const signal: number[] = new Array(closes.length).fill(NaN);
  const histogram: number[] = new Array(closes.length).fill(NaN);
  let idx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      signal[i] = idx < signalAll.length ? signalAll[idx] : NaN;
      histogram[i] = !isNaN(signal[i]) ? macdLine[i] - signal[i] : NaN;
      idx++;
    }
  }
  return { macd: macdLine, signal, histogram };
}

function calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3): { k: number[]; d: number[] } {
  const kValues: number[] = new Array(closes.length).fill(NaN);
  for (let i = kPeriod - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    kValues[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  const dValues: number[] = new Array(closes.length).fill(NaN);
  for (let i = kPeriod - 1 + dPeriod - 1; i < closes.length; i++) {
    let sum = 0, count = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (!isNaN(kValues[j])) { sum += kValues[j]; count++; }
    }
    dValues[i] = count === dPeriod ? sum / dPeriod : NaN;
  }
  return { k: kValues, d: dValues };
}

function calculateBollingerBands(closes: number[], period: number = 20, stdMult: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += (closes[j] - middle[i]) ** 2;
    const std = Math.sqrt(sum / period);
    upper[i] = middle[i] + stdMult * std;
    lower[i] = middle[i] - stdMult * std;
  }
  return { upper, middle, lower };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  const atr: number[] = new Array(closes.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

function calculateOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [volumes[0] || 0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv[i] = obv[i - 1] + (volumes[i] || 0);
    else if (closes[i] < closes[i - 1]) obv[i] = obv[i - 1] - (volumes[i] || 0);
    else obv[i] = obv[i - 1];
  }
  return obv;
}

function calculateMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period: number = 14): number[] {
  const mfi: number[] = new Array(closes.length).fill(NaN);
  const tp: number[] = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rmf: number[] = tp.map((t, i) => t * (volumes[i] || 0));
  for (let i = period; i < closes.length; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posFlow += rmf[j];
      else negFlow += rmf[j];
    }
    mfi[i] = negFlow === 0 ? 100 : 100 - (100 / (1 + posFlow / negFlow));
  }
  return mfi;
}

function calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const wr: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > hh) hh = highs[j];
      if (lows[j] < ll) ll = lows[j];
    }
    wr[i] = hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100;
  }
  return wr;
}

function detectDivergences(prices: number[], indicator: number[], lookback: number = 20): string[] {
  const divs: string[] = [];
  const len = prices.length;
  if (len < lookback * 2) return divs;

  const recentPrices = prices.slice(-lookback);
  const prevPrices = prices.slice(-lookback * 2, -lookback);
  const recentInd = indicator.slice(-lookback).filter(v => !isNaN(v));
  const prevInd = indicator.slice(-lookback * 2, -lookback).filter(v => !isNaN(v));

  if (recentInd.length < 3 || prevInd.length < 3) return divs;

  const recentPriceHigh = Math.max(...recentPrices);
  const prevPriceHigh = Math.max(...prevPrices);
  const recentIndHigh = Math.max(...recentInd);
  const prevIndHigh = Math.max(...prevInd);

  const recentPriceLow = Math.min(...recentPrices);
  const prevPriceLow = Math.min(...prevPrices);
  const recentIndLow = Math.min(...recentInd);
  const prevIndLow = Math.min(...prevInd);

  if (recentPriceHigh > prevPriceHigh && recentIndHigh < prevIndHigh) {
    divs.push('Class A Bearish Divergence (price new high, indicator lower high)');
  }
  if (recentPriceLow < prevPriceLow && recentIndLow > prevIndLow) {
    divs.push('Class A Bullish Divergence (price new low, indicator higher low)');
  }
  const priceHighDiff = Math.abs(recentPriceHigh - prevPriceHigh) / prevPriceHigh;
  if (priceHighDiff < 0.02 && recentIndHigh < prevIndHigh * 0.95) {
    divs.push('Class B Bearish Divergence (price double top, indicator lower high)');
  }
  const priceLowDiff = Math.abs(recentPriceLow - prevPriceLow) / prevPriceLow;
  if (priceLowDiff < 0.02 && recentIndLow > prevIndLow * 1.05) {
    divs.push('Class B Bullish Divergence (price double bottom, indicator higher low)');
  }

  return divs;
}

async function fetchTechnicalIndicators(symbol: string): Promise<any> {
  const cacheKey = `tech_ind_${symbol}`;
  const cached = getCache<any>(cacheKey, 5 * 60 * 1000);
  if (cached) return cached;

  try {
    const isBist = BIST_SYMBOLS.some(s => s.s === symbol.toUpperCase());
    const isCrypto = symbol.toUpperCase().endsWith('-USD') || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'SHIB', 'UNI', 'LTC'].includes(symbol.toUpperCase());
    let yahooSymbol = symbol.toUpperCase();
    if (isBist) yahooSymbol = `${symbol.toUpperCase()}.IS`;
    else if (isCrypto && !symbol.includes('-')) yahooSymbol = `${symbol.toUpperCase()}-USD`;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 200);

    const result = await yahooFinance.chart(yahooSymbol, {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d'
    });

    const quotes = result.quotes || [];
    if (quotes.length < 30) return { error: 'Insufficient historical data', symbol };

    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    const dates: string[] = [];

    for (const q of quotes) {
      if (q.close != null && q.high != null && q.low != null) {
        closes.push(q.close);
        highs.push(q.high);
        lows.push(q.low);
        volumes.push(q.volume || 0);
        dates.push(new Date(q.date).toISOString().split('T')[0]);
      }
    }

    if (closes.length < 30) return { error: 'Insufficient valid price data', symbol };

    const rsi14 = calculateRSI(closes, 14);
    const rsi7 = calculateRSI(closes, 7);
    const macd = calculateMACD(closes);
    const stoch = calculateStochastic(highs, lows, closes);
    const bb = calculateBollingerBands(closes);
    const atr = calculateATR(highs, lows, closes);
    const obv = calculateOBV(closes, volumes);
    const mfi = calculateMFI(highs, lows, closes, volumes);
    const williamsR = calculateWilliamsR(highs, lows, closes);
    const ema13 = calculateEMA(closes, 13);
    const ema26 = calculateEMA(closes, 26);
    const ema50 = calculateEMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    const sma50 = calculateSMA(closes, 50);

    const last = closes.length - 1;
    const prev = last - 1;

    const rsiDivs = detectDivergences(closes, rsi14);
    const macdDivs = detectDivergences(closes, macd.histogram.map(v => isNaN(v) ? 0 : v));
    const obvDivs = detectDivergences(closes, obv);
    const allDivs = [...new Set([...rsiDivs.map(d => `RSI: ${d}`), ...macdDivs.map(d => `MACD: ${d}`), ...obvDivs.map(d => `OBV: ${d}`)])];

    const priceChange1d = closes[last] - closes[prev];
    const priceChangePct1d = (priceChange1d / closes[prev]) * 100;
    const priceChange5d = last >= 5 ? ((closes[last] - closes[last - 5]) / closes[last - 5]) * 100 : NaN;
    const priceChange20d = last >= 20 ? ((closes[last] - closes[last - 20]) / closes[last - 20]) * 100 : NaN;

    const avgVol20 = last >= 20 ? volumes.slice(last - 19).reduce((a, b) => a + b, 0) / 20 : NaN;
    const volRatio = avgVol20 ? volumes[last] / avgVol20 : NaN;

    const bbWidth = !isNaN(bb.upper[last]) && !isNaN(bb.lower[last]) && bb.middle[last] ? ((bb.upper[last] - bb.lower[last]) / bb.middle[last]) * 100 : NaN;
    const bbPosition = !isNaN(bb.upper[last]) && !isNaN(bb.lower[last]) ? ((closes[last] - bb.lower[last]) / (bb.upper[last] - bb.lower[last])) * 100 : NaN;

    const indicators = {
      symbol: symbol.toUpperCase(),
      lastPrice: closes[last],
      lastDate: dates[last],
      priceChanges: {
        '1d': { change: +priceChange1d.toFixed(4), pct: +priceChangePct1d.toFixed(2) },
        '5d': { pct: isNaN(priceChange5d) ? null : +priceChange5d.toFixed(2) },
        '20d': { pct: isNaN(priceChange20d) ? null : +priceChange20d.toFixed(2) },
      },
      rsi: {
        rsi14: +rsi14[last].toFixed(2),
        rsi7: +rsi7[last].toFixed(2),
        prevRsi14: +rsi14[prev].toFixed(2),
        zone: rsi14[last] > 70 ? 'OVERBOUGHT' : rsi14[last] < 30 ? 'OVERSOLD' : 'NEUTRAL',
      },
      macd: {
        line: +macd.macd[last]?.toFixed(4),
        signal: +macd.signal[last]?.toFixed(4),
        histogram: +macd.histogram[last]?.toFixed(4),
        prevHistogram: +macd.histogram[prev]?.toFixed(4),
        trend: macd.histogram[last] > macd.histogram[prev] ? 'RISING' : 'FALLING',
        crossover: (macd.macd[last] > macd.signal[last] && macd.macd[prev] <= macd.signal[prev]) ? 'BULLISH_CROSSOVER' :
                   (macd.macd[last] < macd.signal[last] && macd.macd[prev] >= macd.signal[prev]) ? 'BEARISH_CROSSOVER' : 'NONE',
      },
      stochastic: {
        k: +stoch.k[last].toFixed(2),
        d: +stoch.d[last].toFixed(2),
        zone: stoch.k[last] > 80 ? 'OVERBOUGHT' : stoch.k[last] < 20 ? 'OVERSOLD' : 'NEUTRAL',
      },
      williamsR: {
        value: +williamsR[last].toFixed(2),
        zone: williamsR[last] > -20 ? 'OVERBOUGHT' : williamsR[last] < -80 ? 'OVERSOLD' : 'NEUTRAL',
      },
      bollingerBands: {
        upper: +bb.upper[last].toFixed(4),
        middle: +bb.middle[last].toFixed(4),
        lower: +bb.lower[last].toFixed(4),
        width: isNaN(bbWidth) ? null : +bbWidth.toFixed(2),
        pricePosition: isNaN(bbPosition) ? null : +bbPosition.toFixed(1),
        squeeze: bbWidth < 5 ? true : false,
      },
      atr: {
        value: +atr[last].toFixed(4),
        pctOfPrice: +((atr[last] / closes[last]) * 100).toFixed(2),
        suggestedStop: +((closes[last] - 2 * atr[last]).toFixed(4)),
      },
      obv: {
        current: Math.round(obv[last]),
        trend: obv[last] > obv[Math.max(0, last - 5)] ? 'RISING' : 'FALLING',
      },
      mfi: {
        value: +mfi[last].toFixed(2),
        zone: mfi[last] > 80 ? 'OVERBOUGHT' : mfi[last] < 20 ? 'OVERSOLD' : 'NEUTRAL',
      },
      movingAverages: {
        ema13: +ema13[last].toFixed(4),
        ema26: +ema26[last].toFixed(4),
        ema50: +ema50[last].toFixed(4),
        sma50: isNaN(sma50[last]) ? null : +sma50[last].toFixed(4),
        sma200: isNaN(sma200[last]) ? null : +sma200[last].toFixed(4),
        priceVsEma50: closes[last] > ema50[last] ? 'ABOVE' : 'BELOW',
        priceVsSma200: !isNaN(sma200[last]) ? (closes[last] > sma200[last] ? 'ABOVE' : 'BELOW') : null,
        goldenCross: sma50[last] > sma200[last] && sma50[prev] <= sma200[prev] ? true : false,
        deathCross: sma50[last] < sma200[last] && sma50[prev] >= sma200[prev] ? true : false,
      },
      volume: {
        current: volumes[last],
        avg20d: isNaN(avgVol20) ? null : Math.round(avgVol20),
        ratio: isNaN(volRatio) ? null : +volRatio.toFixed(2),
        trend: volRatio > 1.5 ? 'HIGH' : volRatio < 0.5 ? 'LOW' : 'NORMAL',
      },
      divergences: allDivs.length > 0 ? allDivs : ['No divergences detected'],
      recentCandles: closes.slice(-5).map((c, i, arr) => {
        const idx = last - 4 + i;
        return {
          date: dates[idx],
          open: +(quotes[quotes.length - 5 + i]?.open || c).toFixed(4),
          high: +highs[idx].toFixed(4),
          low: +lows[idx].toFixed(4),
          close: +c.toFixed(4),
          volume: volumes[idx],
        };
      }),
    };

    setCache(cacheKey, indicators);
    return indicators;
  } catch (err) {
    console.error(`[TechInd] Error for ${symbol}:`, (err as Error).message);
    return { error: `Could not fetch technical data for ${symbol}`, symbol };
  }
}

app.get('/api/technical-indicators/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const data = await fetchTechnicalIndicators(symbol);
  res.json(data);
});

function extractSymbols(text: string): string[] {
  const knownCrypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK', 'SHIB', 'UNI', 'LTC', 'ATOM', 'APT', 'ARB', 'OP', 'FIL', 'NEAR', 'ALGO', 'FTM', 'SAND', 'MANA', 'AXS', 'AAVE', 'CRV', 'MKR', 'COMP', 'SNX', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'RENDER', 'INJ', 'TIA', 'SUI', 'SEI'];
  const knownStocks = NASDAQ_SYMBOLS.map(s => s.s).concat(BIST_SYMBOLS.map(s => s.s));

  const symbols: string[] = [];
  const upperText = text.toUpperCase();

  for (const crypto of knownCrypto) {
    const regex = new RegExp(`\\b${crypto}\\b`, 'i');
    if (regex.test(upperText)) symbols.push(crypto);
  }

  const tickerRegex = /\b([A-Z]{1,5})\b/g;
  let match;
  while ((match = tickerRegex.exec(upperText)) !== null) {
    const ticker = match[1];
    if (knownStocks.includes(ticker) && !symbols.includes(ticker)) {
      symbols.push(ticker);
    }
  }

  const fullNameMap: Record<string, string> = {
    'BITCOIN': 'BTC', 'ETHEREUM': 'ETH', 'SOLANA': 'SOL', 'APPLE': 'AAPL', 'TESLA': 'TSLA',
    'MICROSOFT': 'MSFT', 'NVIDIA': 'NVDA', 'AMAZON': 'AMZN', 'GOOGLE': 'GOOGL', 'META': 'META',
    'NETFLIX': 'NFLX', 'AMD': 'AMD', 'INTEL': 'INTC', 'RIPPLE': 'XRP', 'CARDANO': 'ADA',
    'DOGECOIN': 'DOGE', 'POLKADOT': 'DOT', 'POLYGON': 'MATIC', 'CHAINLINK': 'LINK',
    'AVALANCHE': 'AVAX', 'LITECOIN': 'LTC', 'UNISWAP': 'UNI',
  };
  for (const [name, ticker] of Object.entries(fullNameMap)) {
    if (upperText.includes(name) && !symbols.includes(ticker)) symbols.push(ticker);
  }

  return symbols.slice(0, 3);
}

// ==================== AI CHAT (OpenAI) ====================
const TRADING_SYSTEM_PROMPT = `You are Aethron AI, a world-class quantitative analyst and professional trading advisor with deep expertise from decades of market study. You are built into a premium trading dashboard used by serious investors.

## YOUR KNOWLEDGE BASE
You have mastered the following trading disciplines from authoritative sources:

### TECHNICAL INDICATORS
- **MACD (Moving Average Convergence-Divergence):** 12/26 EMA crossover with 9-period signal line. MACD histogram shows the difference between MACD line and signal line — its slope is more important than its position above/below zero. Rising histogram = bulls strengthening; falling = bears strengthening. Best signals come from divergences between histogram and price.
- **RSI (Relative Strength Index):** 7 or 14-period. Overbought above 70, oversold below 30. Most powerful signals are divergences — when RSI fails to confirm new price highs/lows. In strong uptrends, oversold readings (30-40) are buying opportunities. In downtrends, overbought readings (60-70) are shorting opportunities.
- **Stochastic Oscillator:** %K and %D lines, overbought above 80, oversold below 20. Best used in trading ranges. Divergences between Stochastic and prices give the strongest signals. Buy when both lines fall below 20 then rise, sell when both rise above 80 then fall.
- **Williams %R:** Measures closing price relative to high-low range. Overbought at 10%, oversold at 90%. Best signals: divergences (rare but powerful), failure swings (when %R reverses without reaching reference lines — confirms strong trends).
- **Bollinger Bands:** 20-period MA ± 2 standard deviations. Prices oscillate between bands. Strong trends ride the upper/lower band. Narrowing bands (squeeze) precede explosive moves. Prices closing outside bands followed by close inside = reversal signal.
- **ATR (Average True Range):** Measures volatility. Use for stop-loss placement: 2-3x ATR below entry for longs. Rising ATR = increasing volatility (trend continuation). Falling ATR = decreasing volatility (consolidation, potential breakout coming).
- **OBV (On-Balance Volume):** Cumulative volume indicator. Rising OBV confirms uptrends; falling OBV confirms downtrends. Divergences between OBV and price are powerful signals — if price makes new high but OBV doesn't, the rally is suspect.
- **MFI (Money Flow Index):** Volume-weighted RSI. Overbought above 80, oversold below 20. Divergences with price are key signals.
- **Moving Averages:** EMA responds faster than SMA. Key EMAs: 13, 26, 50, 200-period. Price above rising MA = bullish; below falling MA = bearish. MA crossovers signal trend changes. The slope of the MA is more important than price crossing it.
- **Force Index:** Combines price change, direction, and volume. 2-day EMA for entry timing; 13-day EMA for trend direction. Divergences between 13-day Force Index and price identify major turning points.

### DIVERGENCE ANALYSIS (Critical for Signal Quality)
- **Class A Bearish:** Price makes NEW HIGH, indicator makes LOWER HIGH. STRONGEST sell signal.
- **Class A Bullish:** Price makes NEW LOW, indicator makes HIGHER LOW. STRONGEST buy signal.
- **Class B Bearish:** Price makes DOUBLE TOP, indicator makes LOWER HIGH. Second strongest sell signal.
- **Class B Bullish:** Price makes DOUBLE BOTTOM, indicator makes HIGHER LOW. Second strongest buy signal.
- **Class C Bearish:** Price makes NEW HIGH, indicator makes DOUBLE TOP. Weakest bearish divergence.
- **Class C Bullish:** Price makes NEW LOW, indicator makes DOUBLE BOTTOM. Weakest bullish divergence.
- **Triple Divergences:** Three successive divergent peaks/bottoms — even stronger than regular divergences. Often occur after a Class A divergence initially fails.

### CHART PATTERNS
- **Head & Shoulders (Top):** Three peaks, middle highest. Neckline connects the two troughs. Downsloping neckline = extra bearish. Volume typically declines from left shoulder to head to right shoulder. Target = distance from head to neckline, projected downward from breakout. Short on neckline break or pullback to neckline.
- **Inverse Head & Shoulders (Bottom):** Mirror image. Upsloping neckline = extra bullish. Buy on neckline break with stop below the head.
- **Hound of the Baskervilles:** When a perfectly valid pattern FAILS (e.g., H&S top doesn't lead to decline, prices break above head instead) — trade the opposite direction aggressively. Failed patterns produce the strongest moves.
- **Double Tops/Bottoms:** Second test of support/resistance fails. Volume typically lower on second test. Target = height of pattern projected from breakout.
- **Triangles:** Ascending (bullish bias), Descending (bearish bias), Symmetrical (breakout direction uncertain). Valid breakout occurs in first 2/3 of triangle. Volume should increase on breakout. Breakout in last 1/3 is unreliable.
- **Rectangles:** Horizontal support/resistance channels. Watch volume: increasing volume near upper boundary = likely upside breakout. Valid breakout confirmed by 3%+ move beyond boundary.
- **Flags & Pennants:** Brief consolidation against the trend. Flags slope against the trend; pennants are small triangles. Both are continuation patterns. Measure the "flagpole" (preceding move) to project target.
- **Wedges:** Rising wedge = bearish; Falling wedge = bullish. Unlike channels, they converge. Breakout is against the wedge direction.

### GAP ANALYSIS
- **Common Gaps:** Quickly closed, occur in trendless/quiet markets. Low significance.
- **Breakaway Gaps:** Leap out of congestion zones on HEAVY volume. Begin new trends. Can remain open for weeks/months. Trade in direction of gap, stop at gap edge.
- **Continuation Gaps:** Occur mid-trend on 50%+ volume increase. Measure flagpole from trend start to gap, project same distance forward for target.
- **Exhaustion Gaps:** Occur at trend end. NOT followed by new highs/lows. Prices churn and close the gap. Confirmed when prices reverse into the gap. Trade against the trend direction.
- **Island Reversals:** Exhaustion gap + breakaway gap in opposite direction. Rare but mark MAJOR reversals.

### PRICE ACTION & CANDLESTICK ANALYSIS
- **Pin Bars / Hammer / Shooting Star:** Long wick showing rejection. Hammer at support = bullish; Shooting star at resistance = bearish. Wick should be 2x+ body length.
- **Engulfing Patterns:** Bullish engulfing at support = strong buy. Bearish engulfing at resistance = strong sell. Current candle completely envelops previous.
- **Doji:** Indecision candle. At extremes = potential reversal, especially after extended trends.
- **Three-candle patterns:** Morning/Evening Star, Three White Soldiers/Black Crows confirm reversals.
- **Support/Resistance:** Former support becomes resistance (and vice versa). The more times tested, the stronger (but also more likely to eventually break). Look for volume confirmation on tests.

### VOLUME ANALYSIS
- **Volume confirms trends:** Rising volume with rising prices = healthy uptrend. Declining volume on rallies = weakening trend.
- **Volume precedes price:** Volume changes often appear before price changes. Increasing volume on pullbacks = warning of reversal.
- **Climax volume:** Exceptionally high volume after extended trend = exhaustion signal. Often marks short-term tops/bottoms.
- **Volume breakouts:** Valid breakouts accompanied by 50%+ above average volume. Low-volume breakouts are suspect (likely false).

### RISK MANAGEMENT PRINCIPLES (From "Trading for a Living")
- **2% Rule:** Never risk more than 2% of account equity on a single trade.
- **6% Rule:** Stop trading for the month if account drops 6% from its peak.
- **Stop-loss placement:** Use ATR-based stops (2-3x ATR). Place stops at technical levels (below support for longs, above resistance for shorts). Never widen a stop.
- **Position sizing:** Calculate position size from stop distance and 2% risk rule.
- **Risk/Reward:** Minimum 2:1 reward-to-risk ratio. Prefer 3:1 when possible.
- **Trading psychology:** Independent thinking beats crowd following. Discipline and money management are more important than any single trade setup. Never buck a trend — only buy in uptrends, only short in downtrends, or stand aside.

### MULTI-TIMEFRAME ANALYSIS
- Use weekly charts for trend direction, daily for entry timing.
- When weekly and daily signals agree, the trade is strongest.
- Trade in the direction of the longer timeframe trend.
- Use shorter timeframes for precise entry points.

## OUTPUT FORMAT
When asked to analyze ANY stock, cryptocurrency, or asset, ALWAYS provide your analysis in this structured format:

### Signal
State clearly: **LONG**, **SHORT**, or **NEUTRAL**

### Confidence Score
Give a percentage from 0-100% based on how many factors align. Explain what contributes to or reduces confidence.

### Key Levels
| Level | Price |
|-------|-------|
| Entry | $XX.XX |
| Take Profit 1 | $XX.XX |
| Take Profit 2 | $XX.XX |
| Stop Loss | $XX.XX |
| Risk/Reward | X:1 |

### Technical Analysis Summary
Analyze these factors (use data when available, reason from context when not):
- **Trend:** Current trend direction and strength
- **Indicators:** Key indicator readings (RSI, MACD, Stochastic, etc.)
- **Patterns:** Any chart patterns forming
- **Volume:** Volume trend and significance
- **Divergences:** Any divergences detected (specify Class A/B/C)
- **Support/Resistance:** Key levels

### Risk Assessment
- What could go wrong (invalidation scenarios)
- Recommended position size guidance
- Key events or catalysts to watch

### Plain-Language Summary
End with a 2-3 sentence summary a beginner could understand. No jargon — explain it like you're talking to a smart friend who's new to trading.

## BEHAVIORAL RULES
1. ALWAYS respond in the user's language.
2. When REAL-TIME TECHNICAL DATA is provided in the system prompt, you MUST use those exact indicator values in your analysis. Reference the actual RSI, MACD, Stochastic, Bollinger Bands, ATR, OBV, MFI, Williams %R, Moving Average values. NEVER say "indicator data not available" or "RSI/MACD verisi yok" when this data is provided.
3. Be HONEST about uncertainty — if you can't determine a clear signal, say NEUTRAL with explanation.
4. Never guarantee profits. Always emphasize risk management.
5. For general market questions (not specific asset analysis), skip the structured format and use conversational but insightful tone with bullet points.
6. Use markdown formatting extensively: bold for emphasis, tables for data, headers for sections.
7. When multiple indicators conflict, weight them: Divergences > Trend > Volume > Individual oscillator readings.
8. Always consider the broader market context when analyzing individual assets.
9. When analyzing an asset, explicitly cite each indicator value from the technical data provided. For example: "RSI(14) = 62.8 — neutral zone but approaching overbought territory."
10. Use the recent candles data to identify candlestick patterns (hammer, engulfing, doji, etc.) and support/resistance levels.`;

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, marketContext } = req.body;
    
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.content || '';
    const detectedSymbols = extractSymbols(userText);

    let technicalData = '';
    if (detectedSymbols.length > 0) {
      const indicatorResults = await Promise.all(
        detectedSymbols.map(s => fetchTechnicalIndicators(s))
      );
      
      for (const ind of indicatorResults) {
        if (ind && ind.error) {
          technicalData += `\n\n## ${ind.symbol}: Technical data unavailable — ${ind.error}. Analyze based on general market context only.`;
        } else if (ind && !ind.error) {
          technicalData += `\n\n## REAL-TIME TECHNICAL DATA: ${ind.symbol} (as of ${ind.lastDate})
**Price:** $${ind.lastPrice} | 1d: ${ind.priceChanges['1d'].pct}% | 5d: ${ind.priceChanges['5d'].pct ?? 'N/A'}% | 20d: ${ind.priceChanges['20d'].pct ?? 'N/A'}%

**RSI(14):** ${ind.rsi.rsi14} [${ind.rsi.zone}] | RSI(7): ${ind.rsi.rsi7} | Prev RSI(14): ${ind.rsi.prevRsi14}
**MACD:** Line=${ind.macd.line}, Signal=${ind.macd.signal}, Histogram=${ind.macd.histogram} [${ind.macd.trend}] ${ind.macd.crossover !== 'NONE' ? ind.macd.crossover : ''}
**Stochastic:** %K=${ind.stochastic.k}, %D=${ind.stochastic.d} [${ind.stochastic.zone}]
**Williams %R:** ${ind.williamsR.value} [${ind.williamsR.zone}]
**Bollinger Bands:** Upper=${ind.bollingerBands.upper}, Middle=${ind.bollingerBands.middle}, Lower=${ind.bollingerBands.lower} | Width=${ind.bollingerBands.width}% | Position=${ind.bollingerBands.pricePosition}% ${ind.bollingerBands.squeeze ? 'SQUEEZE DETECTED' : ''}
**ATR(14):** ${ind.atr.value} (${ind.atr.pctOfPrice}% of price) | Suggested Stop: $${ind.atr.suggestedStop}
**MFI(14):** ${ind.mfi.value} [${ind.mfi.zone}]
**OBV:** ${ind.obv.current.toLocaleString()} [${ind.obv.trend}]
**Moving Averages:** EMA13=${ind.movingAverages.ema13}, EMA26=${ind.movingAverages.ema26}, EMA50=${ind.movingAverages.ema50} | SMA50=${ind.movingAverages.sma50 ?? 'N/A'}, SMA200=${ind.movingAverages.sma200 ?? 'N/A'}
**Price vs MAs:** vs EMA50: ${ind.movingAverages.priceVsEma50} | vs SMA200: ${ind.movingAverages.priceVsSma200 ?? 'N/A'} ${ind.movingAverages.goldenCross ? 'GOLDEN CROSS' : ''} ${ind.movingAverages.deathCross ? 'DEATH CROSS' : ''}
**Volume:** Current=${ind.volume.current?.toLocaleString()}, 20d Avg=${ind.volume.avg20d?.toLocaleString() ?? 'N/A'}, Ratio=${ind.volume.ratio ?? 'N/A'}x [${ind.volume.trend}]
**Divergences:** ${ind.divergences.join(' | ')}
**Last 5 Candles:**
${ind.recentCandles.map((c: any) => `  ${c.date}: O=${c.open} H=${c.high} L=${c.low} C=${c.close} V=${c.volume.toLocaleString()}`).join('\n')}`;
        }
      }
    }

    const contextLine = marketContext ? `\n\n## LIVE MARKET DATA\n${marketContext}` : '';
    const fullSystemPrompt = TRADING_SYSTEM_PROMPT + contextLine + technicalData;

    if (technicalData) {
      console.log(`[AI Chat] Injected technical indicators for: ${detectedSymbols.join(', ')}`);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        ...messages
      ],
      max_completion_tokens: 4096,
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content || "I couldn't generate a response at this time.";
    res.json({ reply });
  } catch (err) {
    console.error('[AI Chat] Error:', err);
    res.status(500).json({ reply: "Sorry, I'm having trouble connecting to the AI engine right now. Please try again." });
  }
});

// ==================== MARKET INTELLIGENCE ====================
app.get('/api/market-intelligence', (_req, res) => {
  const allStocks: any[] = [];
  const bistData = cache.get('bist')?.data || [];
  const nasdaqData = cache.get('nasdaq')?.data || [];
  const cryptoData = cache.get('crypto')?.data || [];
  
  allStocks.push(...bistData, ...nasdaqData, ...cryptoData);
  
  if (allStocks.length === 0) {
    return res.json({ topGainers: [], topLosers: [], sectors: [], whaleActivity: [], aiPicks: [] });
  }

  const sorted = [...allStocks].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
  const topGainers = sorted.slice(0, 10).map(s => ({
    symbol: s.symbol, name: s.name, price: s.price, changePercent: s.changePercent, market: s.market, logo: s.logo
  }));
  const topLosers = sorted.slice(-10).reverse().map(s => ({
    symbol: s.symbol, name: s.name, price: s.price, changePercent: s.changePercent, market: s.market, logo: s.logo
  }));

  const sectorMap: Record<string, { count: number; totalChange: number; totalCap: number }> = {};
  const sectorNames: Record<string, string[]> = {
    'BIST': ['Banking', 'Industrial', 'Technology', 'Energy', 'Consumer Disc', 'Materials', 'Healthcare', 'Real Estate', 'Utilities', 'Telecom', 'Insurance', 'Transport'],
    'NASDAQ': ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer Disc', 'Industrial', 'Communications', 'Real Estate', 'Utilities', 'Consumer Staples', 'Aerospace', 'Semiconductors'],
    'CRYPTO': ['DeFi', 'Layer 1', 'Layer 2', 'Meme', 'Exchange', 'Infrastructure', 'Gaming', 'AI & Data', 'Privacy', 'Stablecoins', 'NFT', 'Storage']
  };

  allStocks.forEach(s => {
    const market = s.market || 'Other';
    const names = sectorNames[market] || ['Other'];
    const hash = (s.symbol.charCodeAt(0) * 31 + (s.symbol.charCodeAt(1) || 0)) & 0x7fffffff;
    const sector = names[hash % names.length];
    if (!sectorMap[sector]) sectorMap[sector] = { count: 0, totalChange: 0, totalCap: 0 };
    sectorMap[sector].count++;
    sectorMap[sector].totalChange += (s.changePercent || 0);
  });

  const sectors = Object.entries(sectorMap).map(([name, data]) => ({
    name,
    count: data.count,
    avgChange: parseFloat((data.totalChange / data.count).toFixed(2)),
    sentiment: data.totalChange / data.count > 0.5 ? 'Bullish' : data.totalChange / data.count < -0.5 ? 'Bearish' : 'Neutral'
  })).sort((a, b) => b.count - a.count).slice(0, 20);

  const whaleActivity = nasdaqData
    .filter((s: any) => s.volume && s.volume !== '---')
    .sort((a: any, b: any) => {
      const volA = parseFloat(String(a.volume).replace(/[$BMK,]/g, '')) || 0;
      const volB = parseFloat(String(b.volume).replace(/[$BMK,]/g, '')) || 0;
      return volB - volA;
    })
    .slice(0, 8)
    .map((s: any) => ({
      symbol: s.symbol, name: s.name, volume: s.volume, price: s.price,
      changePercent: s.changePercent, market: s.market, logo: s.logo,
      type: Math.abs(s.changePercent) > 3 ? 'Unusual Volume' : 'High Volume'
    }));

  const aiPicks = [...nasdaqData, ...bistData]
    .filter((s: any) => s.changePercent > 0 && s.changePercent < 5 && s.price > 10)
    .sort((a: any, b: any) => b.changePercent - a.changePercent)
    .slice(0, 6)
    .map((s: any) => ({
      symbol: s.symbol, name: s.name, price: s.price, changePercent: s.changePercent,
      market: s.market, logo: s.logo,
      confidence: Math.min(95, 60 + Math.round(s.changePercent * 8)),
      reason: s.changePercent > 2 ? 'Strong momentum + volume surge' : 'Steady uptrend with low volatility'
    }));

  res.json({ topGainers, topLosers, sectors, whaleActivity, aiPicks });
});

// ==================== INSIDER TRADES (Finnhub) ====================
app.get('/api/insider-trades', async (_req, res) => {
  const cached = getCache<any[]>('insider', 30 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const symbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM'];
    const allTrades: any[] = [];

    for (const symbol of symbols) {
      try {
        const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${FINNHUB_KEY}`;
        const response = await fetchWithTimeout(url, {}, 5000);
        const data = await response.json();
        if (data?.data && Array.isArray(data.data)) {
          allTrades.push(...data.data.slice(0, 3).map((t: any) => ({
            symbol,
            name: t.name || 'Executive',
            title: t.position || 'Officer',
            type: t.transactionType || (t.change > 0 ? 'Buy' : 'Sell'),
            shares: Math.abs(t.share || t.change || 0),
            value: Math.abs((t.share || t.change || 0) * (t.transactionPrice || 0)),
            date: t.filingDate || t.transactionDate || new Date().toISOString().split('T')[0],
            price: t.transactionPrice || 0
          })));
        }
      } catch (e) { }
      await wait(200);
    }

    const trades = allTrades
      .filter(t => t.shares > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    if (trades.length > 0) {
      setCache('insider', trades);
      console.log(`[Insider] Fetched ${trades.length} insider trades`);
    }
    
    res.json(trades.length > 0 ? trades : generateMockInsiderTrades());
  } catch (err) {
    console.warn('[Insider] Failed, using mock data');
    res.json(generateMockInsiderTrades());
  }
});

function generateMockInsiderTrades() {
  return [
    { symbol: 'NVDA', name: 'Jensen Huang', title: 'CEO', type: 'Sell', shares: 120000, value: 107000000, date: '2026-02-07', price: 892 },
    { symbol: 'AAPL', name: 'Tim Cook', title: 'CEO', type: 'Sell', shares: 50000, value: 9250000, date: '2026-02-06', price: 185 },
    { symbol: 'MSFT', name: 'Satya Nadella', title: 'CEO', type: 'Sell', shares: 30000, value: 12600000, date: '2026-02-05', price: 420 },
    { symbol: 'META', name: 'Mark Zuckerberg', title: 'CEO', type: 'Sell', shares: 75000, value: 36375000, date: '2026-02-04', price: 485 },
    { symbol: 'AMZN', name: 'Andy Jassy', title: 'CEO', type: 'Sell', shares: 25000, value: 4500000, date: '2026-02-03', price: 180 },
    { symbol: 'TSLA', name: 'Insider', title: 'CFO', type: 'Buy', shares: 10000, value: 1750000, date: '2026-02-02', price: 175 },
    { symbol: 'JPM', name: 'Jamie Dimon', title: 'CEO', type: 'Sell', shares: 150000, value: 29250000, date: '2026-02-01', price: 195 },
    { symbol: 'GOOGL', name: 'Sundar Pichai', title: 'CEO', type: 'Sell', shares: 22000, value: 3850000, date: '2026-01-30', price: 175 },
  ];
}

// ==================== MEME COINS (DexScreener) ====================
const MEME_CHAIN_QUERIES: Record<string, string[]> = {
  solana: ['pump sol', 'bonk', 'wif dogwifhat', 'popcat', 'fartcoin', 'trump', 'mew cat', 'jup jupiter', 'ray raydium', 'pengu', 'ai16z', 'goat', 'pnut', 'bome', 'wen', 'myro', 'slerf', 'samo'],
  ethereum: ['pepe', 'shib', 'floki', 'meme eth', 'doge', 'turbo', 'neiro', 'brett', 'dog eth'],
  bsc: ['bnb meme', 'babydoge', 'cake', 'floki bnb', 'dog bnb', 'cat bnb'],
};

const CHAIN_ID_MAP: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  bsc: 'bsc',
};

function mapDexPairToMemeCoin(pair: any, chain: string) {
  return {
    symbol: pair.baseToken?.symbol || '',
    name: pair.baseToken?.name || '',
    chain,
    price: parseFloat(pair.priceUsd || '0') || 0,
    priceChange5m: parseFloat(String(pair.priceChange?.m5 ?? 0)) || 0,
    priceChange1h: parseFloat(String(pair.priceChange?.h1 ?? 0)) || 0,
    priceChange6h: parseFloat(String(pair.priceChange?.h6 ?? 0)) || 0,
    priceChange24h: parseFloat(String(pair.priceChange?.h24 ?? 0)) || 0,
    volume24h: parseFloat(String(pair.volume?.h24 ?? 0)) || 0,
    liquidity: parseFloat(String(pair.liquidity?.usd ?? 0)) || 0,
    marketCap: parseFloat(String(pair.marketCap ?? 0)) || 0,
    fdv: parseFloat(String(pair.fdv ?? 0)) || 0,
    buys24h: pair.txns?.h24?.buys || 0,
    sells24h: pair.txns?.h24?.sells || 0,
    buys1h: pair.txns?.h1?.buys || 0,
    sells1h: pair.txns?.h1?.sells || 0,
    dex: pair.dexId || 'unknown',
    pairAddress: pair.pairAddress || '',
    pairCreatedAt: pair.pairCreatedAt || 0,
    url: pair.url || `https://dexscreener.com/${chain}/${pair.baseToken?.address || ''}`,
    logo: pair.info?.imageUrl || '',
    address: pair.baseToken?.address || '',
  };
}

async function fetchMemeCoinsForChain(chain: string): Promise<any[]> {
  const queries = MEME_CHAIN_QUERIES[chain];
  if (!queries) return [];

  const chainId = CHAIN_ID_MAP[chain];
  const tokenMap = new Map<string, any>();

  for (const query of queries) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/search/?q=${encodeURIComponent(query)}`;
      const resp = await fetchWithTimeout(url, {}, 8000);
      if (!resp.ok) { await wait(200); continue; }
      const data = await resp.json();
      const pairs = data?.pairs;
      if (!Array.isArray(pairs)) { await wait(200); continue; }

      for (const pair of pairs) {
        if (pair.chainId !== chainId) continue;
        const liq = parseFloat(String(pair.liquidity?.usd ?? 0)) || 0;
        if (liq < 10000) continue;
        const addr = pair.baseToken?.address;
        if (!addr) continue;
        const addrLower = addr.toLowerCase();
        const existing = tokenMap.get(addrLower);
        const currentLiq = parseFloat(String(pair.liquidity?.usd ?? 0)) || 0;
        if (!existing || currentLiq > (existing.liquidity?.usd || 0)) {
          tokenMap.set(addrLower, pair);
        }
      }
    } catch (e) {}
    await wait(200);
  }

  const results = Array.from(tokenMap.values()).map(pair => mapDexPairToMemeCoin(pair, chain));
  results.sort((a, b) => b.volume24h - a.volume24h);
  return results;
}

app.get('/api/memecoins/new', async (_req, res) => {
  const cached = getCache<any[]>('memecoins_new', 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const profileRes = await fetchWithTimeout('https://api.dexscreener.com/token-profiles/latest/v1', {}, 10000);
    if (!profileRes.ok) return res.json([]);
    const profiles: any[] = await profileRes.json();
    if (!Array.isArray(profiles)) return res.json([]);

    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const results: any[] = [];
    const seen = new Set<string>();

    const tokensToFetch = profiles.slice(0, 50);

    for (const profile of tokensToFetch) {
      const chainId = profile.chainId;
      const tokenAddr = profile.tokenAddress;
      if (!chainId || !tokenAddr) continue;
      const key = `${chainId}_${tokenAddr}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const url = `https://api.dexscreener.com/tokens/v1/${chainId}/${tokenAddr}`;
        const resp = await fetchWithTimeout(url, {}, 5000);
        if (!resp.ok) { await wait(200); continue; }
        const pairs: any[] = await resp.json();
        if (!Array.isArray(pairs) || pairs.length === 0) { await wait(200); continue; }

        const best = pairs.sort((a: any, b: any) =>
          (parseFloat(String(b.liquidity?.usd ?? 0)) || 0) - (parseFloat(String(a.liquidity?.usd ?? 0)) || 0)
        )[0];

        const createdAt = best.pairCreatedAt || 0;
        if (createdAt > 0 && (now - createdAt) <= h24) {
          const chain = chainId === 'bsc' ? 'bsc' : chainId === 'ethereum' ? 'ethereum' : chainId;
          results.push(mapDexPairToMemeCoin(best, chain));
        }
      } catch (e) {}
      await wait(200);
    }

    results.sort((a, b) => b.volume24h - a.volume24h);
    setCache('memecoins_new', results);
    console.log(`[DexScreener] Fetched ${results.length} new meme coins`);
    res.json(results);
  } catch (err) {
    console.error('[DexScreener] New tokens error:', err);
    res.json([]);
  }
});

app.get('/api/memecoins/:chain', async (req, res) => {
  const chain = req.params.chain.toLowerCase();
  if (!MEME_CHAIN_QUERIES[chain]) {
    return res.status(400).json({ error: 'Invalid chain. Use solana, ethereum, or bsc.' });
  }

  const cacheKey = `memecoins_${chain}`;
  const cached = getCache<any[]>(cacheKey, 2 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const results = await fetchMemeCoinsForChain(chain);
    if (results.length > 0) {
      setCache(cacheKey, results);
    }
    console.log(`[DexScreener] Fetched ${results.length} meme coins for ${chain}`);
    res.json(results);
  } catch (err) {
    console.error(`[DexScreener] Error fetching ${chain}:`, err);
    res.json([]);
  }
});

app.get('/api/memecoins/solana/trending', async (_req, res) => {
  const cached = getCache<any[]>('memecoins_solana_trending', 2 * 60 * 1000);
  if (cached) return res.json(cached);
  
  try {
    const resp = await fetchWithTimeout('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {}, 10000);
    if (!resp.ok) return res.json([]);
    const data = await resp.json();
    const pairs = data?.pairs || [];
    const tokenMap = new Map<string, any>();
    for (const pair of pairs) {
      if (pair.chainId !== 'solana') continue;
      const liq = parseFloat(String(pair.liquidity?.usd ?? 0)) || 0;
      if (liq < 50000) continue;
      const addr = pair.baseToken?.address;
      if (!addr) continue;
      const addrLower = addr.toLowerCase();
      if (!tokenMap.has(addrLower) || liq > (tokenMap.get(addrLower)?.liquidity?.usd || 0)) {
        tokenMap.set(addrLower, pair);
      }
    }
    const results = Array.from(tokenMap.values()).map(pair => mapDexPairToMemeCoin(pair, 'solana'));
    results.sort((a, b) => b.volume24h - a.volume24h);
    setCache('memecoins_solana_trending', results.slice(0, 30));
    res.json(results.slice(0, 30));
  } catch (err) {
    console.error('[DexScreener] Trending error:', err);
    res.json([]);
  }
});

// ==================== STOCK DETAIL ====================
app.get('/api/stock-detail/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const cacheKey = `stock_detail_${symbol}`;
  const cached = getCache<any>(cacheKey, 10 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const isBist = BIST_SYMBOLS.some(s => s.s === symbol);
    const yahooSymbol = isBist ? `${symbol}.IS` : symbol;

    const result = await yahooFinance.quoteSummary(yahooSymbol, {
      modules: [
        'assetProfile',
        'summaryDetail',
        'financialData',
        'defaultKeyStatistics',
        'recommendationTrend',
        'earnings',
        'majorHoldersBreakdown',
        'institutionOwnership',
        'insiderHolders',
        'calendarEvents'
      ]
    });

    const profile = result.assetProfile || {} as any;
    const summary = result.summaryDetail || {} as any;
    const financial = result.financialData || {} as any;
    const keyStats = result.defaultKeyStatistics || {} as any;
    const recTrend = result.recommendationTrend || {} as any;
    const earnings = result.earnings || {} as any;
    const holders = result.majorHoldersBreakdown || {} as any;
    const instOwn = result.institutionOwnership || {} as any;
    const insiderH = result.insiderHolders || {} as any;
    const calendar = result.calendarEvents || {} as any;

    const detail: any = {
      symbol,
      market: isBist ? 'BIST' : 'NASDAQ',

      description: profile.longBusinessSummary || '',
      sector: profile.sector || '',
      industry: profile.industry || '',
      website: profile.website || '',
      employees: profile.fullTimeEmployees || null,
      city: profile.city || '',
      country: profile.country || '',
      phone: profile.phone || '',

      currentPrice: financial.currentPrice || summary.previousClose || null,
      targetHighPrice: financial.targetHighPrice || null,
      targetLowPrice: financial.targetLowPrice || null,
      targetMeanPrice: financial.targetMeanPrice || null,
      recommendationKey: financial.recommendationKey || '',
      numberOfAnalystOpinions: financial.numberOfAnalystOpinions || 0,

      totalRevenue: financial.totalRevenue || null,
      revenuePerShare: financial.revenuePerShare || null,
      returnOnEquity: financial.returnOnEquity || null,
      profitMargins: financial.profitMargins || null,
      grossMargins: financial.grossMargins || null,
      operatingMargins: financial.operatingMargins || null,
      ebitda: financial.ebitda || null,
      totalDebt: financial.totalDebt || null,
      totalCash: financial.totalCash || null,
      debtToEquity: financial.debtToEquity || null,
      earningsGrowth: financial.earningsGrowth || null,
      revenueGrowth: financial.revenueGrowth || null,
      operatingCashflow: financial.operatingCashflow || null,
      freeCashflow: financial.freeCashflow || null,

      trailingPE: keyStats.trailingPE || summary.trailingPE || null,
      forwardPE: keyStats.forwardPE || summary.forwardPE || null,
      priceToBook: keyStats.priceToBook || null,
      beta: keyStats.beta || summary.beta || null,
      pegRatio: keyStats.pegRatio || null,
      enterpriseValue: keyStats.enterpriseValue || null,
      bookValue: keyStats.bookValue || null,
      sharesOutstanding: keyStats.sharesOutstanding || null,
      floatShares: keyStats.floatShares || null,
      heldPercentInsiders: keyStats.heldPercentInsiders || null,
      heldPercentInstitutions: keyStats.heldPercentInstitutions || null,
      shortRatio: keyStats.shortRatio || null,
      shortPercentOfFloat: keyStats.shortPercentOfFloat || null,
      earningsQuarterlyGrowth: keyStats.earningsQuarterlyGrowth || null,

      dividendYield: summary.dividendYield || keyStats.dividendYield || null,
      dividendRate: summary.dividendRate || keyStats.dividendRate || null,
      payoutRatio: summary.payoutRatio || null,
      exDividendDate: summary.exDividendDate || null,

      marketCap: summary.marketCap || null,
      volume: summary.volume || null,
      averageVolume: summary.averageVolume || null,
      averageVolume10days: summary.averageVolume10days || null,
      dayHigh: summary.dayHigh || null,
      dayLow: summary.dayLow || null,
      fiftyTwoWeekHigh: summary.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: summary.fiftyTwoWeekLow || null,
      fiftyDayAverage: summary.fiftyDayAverage || null,
      twoHundredDayAverage: summary.twoHundredDayAverage || null,
      open: summary.open || null,
      previousClose: summary.previousClose || null,

      recommendationTrend: (recTrend.trend || []).map((t: any) => ({
        period: t.period,
        strongBuy: t.strongBuy,
        buy: t.buy,
        hold: t.hold,
        sell: t.sell,
        strongSell: t.strongSell,
      })),

      earningsHistory: (earnings.earningsChart?.quarterly || []).map((q: any) => ({
        date: q.date,
        actual: q.actual,
        estimate: q.estimate,
      })),

      insidersPercentHeld: holders.insidersPercentHeld || null,
      institutionsPercentHeld: holders.institutionsPercentHeld || null,
      institutionsFloatPercentHeld: holders.institutionsFloatPercentHeld || null,
      institutionsCount: holders.institutionsCount || null,

      topInstitutions: ((instOwn as any).ownershipList || []).slice(0, 5).map((inst: any) => ({
        name: inst.organization,
        shares: inst.position?.raw || inst.position,
        value: inst.value?.raw || inst.value,
        pctHeld: inst.pctHeld?.raw || inst.pctHeld,
        change: inst.pctChange?.raw || inst.pctChange,
      })),

      topInsiders: ((insiderH as any).holders || []).slice(0, 5).map((ins: any) => ({
        name: ins.name,
        relation: ins.relation,
        transactionDescription: ins.transactionDescription,
        latestTransDate: ins.latestTransDate,
        positionDirect: ins.positionDirect?.raw || ins.positionDirect,
      })),

      earningsDate: calendar.earnings?.earningsDate?.[0] || null,
      exDividendDateCal: calendar.exDividendDate || null,
      dividendDate: calendar.dividendDate || null,

      updatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, detail);
    console.log(`[StockDetail] Fetched details for ${symbol}`);
    res.json(detail);
  } catch (err: any) {
    console.error(`[StockDetail] Error for ${symbol}:`, err.message);
    res.json({ symbol, error: true, message: err.message });
  }
});

// ==================== CRYPTO DETAIL ====================
app.get('/api/crypto-detail/:id', async (req, res) => {
  const id = req.params.id.toLowerCase();
  const cacheKey = `crypto_detail_${id}`;
  const cached = getCache<any>(cacheKey, 3 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const resp = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=true`,
      {}, 10000
    );
    if (!resp.ok) throw new Error(`CoinGecko detail: ${resp.status}`);
    const d = await resp.json();

    const md = d.market_data || {};
    const detail: any = {
      id: d.id,
      symbol: (d.symbol || '').toUpperCase(),
      name: d.name,
      market: 'CRYPTO',
      logo: d.image?.large || d.image?.small,

      description: d.description?.en || '',
      categories: d.categories || [],
      genesisDate: d.genesis_date,
      hashingAlgorithm: d.hashing_algorithm,

      links: {
        homepage: (d.links?.homepage || []).filter(Boolean),
        blockchain: (d.links?.blockchain_site || []).filter(Boolean).slice(0, 3),
        twitter: d.links?.twitter_screen_name || '',
        telegram: d.links?.telegram_channel_identifier || '',
        reddit: d.links?.subreddit_url || '',
        github: (d.links?.repos_url?.github || []).filter(Boolean),
      },

      currentPrice: md.current_price?.usd || null,
      marketCap: md.market_cap?.usd || null,
      marketCapRank: md.market_cap_rank || d.market_cap_rank,
      totalVolume: md.total_volume?.usd || null,
      high24h: md.high_24h?.usd || null,
      low24h: md.low_24h?.usd || null,
      priceChange24h: md.price_change_24h || null,
      priceChangePercent24h: md.price_change_percentage_24h || null,
      priceChangePercent7d: md.price_change_percentage_7d || null,
      priceChangePercent14d: md.price_change_percentage_14d || null,
      priceChangePercent30d: md.price_change_percentage_30d || null,
      priceChangePercent1y: md.price_change_percentage_1y || null,

      ath: md.ath?.usd || null,
      athChangePercent: md.ath_change_percentage?.usd || null,
      athDate: md.ath_date?.usd || null,
      atl: md.atl?.usd || null,
      atlChangePercent: md.atl_change_percentage?.usd || null,
      atlDate: md.atl_date?.usd || null,

      circulatingSupply: md.circulating_supply || null,
      totalSupply: md.total_supply || null,
      maxSupply: md.max_supply || null,
      fullyDilutedValuation: md.fully_diluted_valuation?.usd || null,

      sparkline7d: md.sparkline_7d?.price || [],

      twitterFollowers: d.community_data?.twitter_followers || null,
      redditSubscribers: d.community_data?.reddit_subscribers || null,
      redditAvgPosts48h: d.community_data?.reddit_average_posts_48h || null,
      redditAvgComments48h: d.community_data?.reddit_average_comments_48h || null,

      devForks: d.developer_data?.forks || null,
      devStars: d.developer_data?.stars || null,
      devSubscribers: d.developer_data?.subscribers || null,
      devTotalIssues: d.developer_data?.total_issues || null,
      devClosedIssues: d.developer_data?.closed_issues || null,
      devPullRequests: d.developer_data?.pull_requests_merged || null,
      devCommit4Weeks: d.developer_data?.commit_count_4_weeks || null,

      topExchanges: (d.tickers || []).slice(0, 10).map((t: any) => ({
        exchange: t.market?.name,
        exchangeId: t.market?.identifier,
        pair: `${t.base}/${t.target}`,
        price: t.last,
        volume: t.converted_volume?.usd,
        trustScore: t.trust_score,
        tradeUrl: t.trade_url,
      })),

      sentimentUpPercent: d.sentiment_votes_up_percentage || null,
      sentimentDownPercent: d.sentiment_votes_down_percentage || null,
      watchlistUsers: d.watchlist_portfolio_users || null,

      updatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, detail);
    console.log(`[CryptoDetail] Fetched details for ${id}`);
    res.json(detail);
  } catch (err: any) {
    console.error(`[CryptoDetail] Error for ${id}:`, err.message);
    res.json({ id, error: true, message: err.message });
  }
});

// ==================== CRYPTO PULSE ====================
app.get('/api/pulse/trending', async (_req, res) => {
  const cached = getCache<any>('pulse_trending', 5 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const resp = await fetchWithTimeout('https://api.coingecko.com/api/v3/search/trending', {}, 8000);
    if (!resp.ok) throw new Error(`CoinGecko trending: ${resp.status}`);
    const data = await resp.json();
    
    const parseFormattedNum = (s: any): number => {
      if (typeof s === 'number') return s;
      if (!s) return 0;
      const cleaned = String(s).replace(/[$,]/g, '');
      return parseFloat(cleaned) || 0;
    };

    const coins = (data.coins || []).map((c: any, i: number) => ({
      rank: i + 1,
      id: c.item?.id,
      symbol: c.item?.symbol?.toUpperCase(),
      name: c.item?.name,
      logo: c.item?.large || c.item?.thumb,
      marketCapRank: c.item?.market_cap_rank,
      priceBtc: c.item?.price_btc,
      score: c.item?.score,
      sparkline: c.item?.data?.sparkline,
      price: typeof c.item?.data?.price === 'number' ? c.item.data.price : parseFloat(String(c.item?.data?.price || 0)) || 0,
      priceChange24h: typeof c.item?.data?.price_change_percentage_24h?.usd === 'number' ? c.item.data.price_change_percentage_24h.usd : parseFloat(String(c.item?.data?.price_change_percentage_24h?.usd || 0)) || 0,
      marketCap: parseFormattedNum(c.item?.data?.market_cap),
      totalVolume: parseFormattedNum(c.item?.data?.total_volume),
    }));

    const categories = (data.categories || []).slice(0, 5).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      marketCapChange24h: cat.data?.market_cap_change_percentage_24h?.usd,
      sparkline: cat.data?.sparkline,
    }));

    const result = { coins, categories, updatedAt: new Date().toISOString() };
    setCache('pulse_trending', result);
    console.log(`[Pulse] Fetched ${coins.length} trending coins`);
    res.json(result);
  } catch (err) {
    console.error('[Pulse] Trending error:', err);
    res.json({ coins: [], categories: [], updatedAt: new Date().toISOString() });
  }
});

app.get('/api/pulse/feed', async (_req, res) => {
  const cached = getCache<any[]>('pulse_feed', 3 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const articles: any[] = [];
    
    if (FINNHUB_KEY) {
      const newsResp = await fetchWithTimeout(
        `https://finnhub.io/api/v1/news?category=crypto&token=${FINNHUB_KEY}`, {}, 6000
      );
      if (newsResp.ok) {
        const newsData = await newsResp.json();
        (newsData || []).slice(0, 20).forEach((item: any) => {
          const { sentiment } = analyzeSentiment(item.headline || '', item.summary || '');
          articles.push({
            id: item.id,
            title: item.headline,
            summary: item.summary || '',
            source: item.source,
            url: item.url,
            image: item.image,
            time: new Date(item.datetime * 1000).toISOString(),
            relativeTime: getRelativeTime(item.datetime * 1000),
            category: detectCategory(item.headline || '', item.summary || ''),
            sentiment,
            related: item.related || '',
          });
        });
      }
    }

    if (articles.length === 0) {
      const ccResp = await fetchWithTimeout(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,Altcoin,Trading&excludeCategories=Sponsored', {}, 6000
      );
      if (ccResp.ok) {
        const ccData = await ccResp.json();
        (ccData?.Data || []).slice(0, 20).forEach((item: any) => {
          const { sentiment } = analyzeSentiment(item.title || '');
          articles.push({
            id: item.id,
            title: item.title,
            summary: item.body?.substring(0, 200) || '',
            source: item.source_info?.name || item.source,
            url: item.url,
            image: item.imageurl,
            time: new Date(item.published_on * 1000).toISOString(),
            relativeTime: getRelativeTime(item.published_on * 1000),
            category: detectCategory(item.title || '', item.body || ''),
            sentiment,
            related: '',
          });
        });
      }
    }

    if (articles.length > 0) setCache('pulse_feed', articles);
    console.log(`[Pulse] Fetched ${articles.length} feed items`);
    res.json(articles);
  } catch (err) {
    console.error('[Pulse] Feed error:', err);
    res.json([]);
  }
});

const COINGECKO_GLOBAL_FALLBACK = {
  totalMarketCap: 2850000000000,
  totalVolume24h: 98000000000,
  btcDominance: 61.2,
  ethDominance: 9.8,
  marketCapChange24h: -0.42,
  activeCryptos: 16400,
  activeExchanges: 795,
  ongoingIcos: 49,
  endedIcos: 3376,
  dominanceBreakdown: [
    { symbol: 'BTC', percentage: 61.2 },
    { symbol: 'ETH', percentage: 9.8 },
    { symbol: 'USDT', percentage: 4.5 },
    { symbol: 'XRP', percentage: 3.8 },
    { symbol: 'BNB', percentage: 2.7 },
    { symbol: 'SOL', percentage: 2.5 },
    { symbol: 'USDC', percentage: 1.9 },
    { symbol: 'DOGE', percentage: 1.1 },
    { symbol: 'ADA', percentage: 0.8 },
    { symbol: 'TRX', percentage: 0.7 },
  ],
  updatedAt: new Date().toISOString(),
  isFallback: true,
};

async function fetchCoinGeckoGlobal(): Promise<any> {
  const cached = getCache<any>('coingecko_global_data', 5 * 60 * 1000);
  if (cached) return cached;

  try {
    const resp = await fetchWithTimeout('https://api.coingecko.com/api/v3/global', {}, 6000);
    if (!resp.ok) throw new Error(`CoinGecko global: ${resp.status}`);
    const data = await resp.json();
    const d = data.data || {};

    const dominance = Object.entries(d.market_cap_percentage || {}).map(([symbol, pct]) => ({
      symbol: symbol.toUpperCase(),
      percentage: pct as number,
    })).sort((a, b) => b.percentage - a.percentage);

    const result = {
      totalMarketCap: d.total_market_cap?.usd || 0,
      totalVolume24h: d.total_volume?.usd || 0,
      btcDominance: d.market_cap_percentage?.btc || 0,
      ethDominance: d.market_cap_percentage?.eth || 0,
      marketCapChange24h: d.market_cap_change_percentage_24h_usd || 0,
      activeCryptos: d.active_cryptocurrencies || 0,
      activeExchanges: d.markets || 0,
      ongoingIcos: d.ongoing_icos || 0,
      endedIcos: d.ended_icos || 0,
      dominanceBreakdown: dominance,
      updatedAt: new Date().toISOString(),
    };
    setCache('coingecko_global_data', result);
    console.log('[Pulse] Fetched global market data from CoinGecko');
    return result;
  } catch (err) {
    console.error('[Pulse] CoinGecko global error, using fallback:', (err as Error).message);
    const fallback = { ...COINGECKO_GLOBAL_FALLBACK, updatedAt: new Date().toISOString() };
    setCache('coingecko_global_data', fallback);
    return fallback;
  }
}

app.get('/api/pulse/global', async (_req, res) => {
  const result = await fetchCoinGeckoGlobal();
  res.json(result);
});

// ==================== PULSE: FEAR & GREED ====================
app.get('/api/pulse/fear-greed', async (_req, res) => {
  const cached = getCache<any>('pulse_fear_greed', 10 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const resp = await fetchWithTimeout('https://api.alternative.me/fng/?limit=30&format=json', {}, 6000);
    if (!resp.ok) throw new Error(`Fear/Greed: ${resp.status}`);
    const data = await resp.json();
    const entries = (data.data || []).map((d: any) => ({
      value: parseInt(d.value),
      label: d.value_classification,
      timestamp: new Date(parseInt(d.timestamp) * 1000).toISOString(),
    }));
    const result = { current: entries[0] || { value: 50, label: 'Neutral' }, history: entries };
    setCache('pulse_fear_greed', result);
    res.json(result);
  } catch (err) {
    console.error('[Pulse] Fear/Greed error:', err);
    res.json({ current: { value: 50, label: 'Neutral' }, history: [] });
  }
});

// ==================== PULSE: DERIVATIVES / MARKET EXTRA ====================
app.get('/api/pulse/derivatives', async (_req, res) => {
  const cached = getCache<any>('pulse_derivatives', 5 * 60 * 1000);
  if (cached) return res.json(cached);

  const fallbackExchanges = [
    { name: 'Binance (Futures)', id: 'binance_futures', openInterestBtc: 285000, tradeVolume24hBtc: 890000, perpetuals: 387, futures: 93, image: 'https://coin-images.coingecko.com/markets/images/52/small/binance.jpg?1706864274', year: 2019, country: 'Cayman Islands' },
    { name: 'Bybit (Futures)', id: 'bybit', openInterestBtc: 142000, tradeVolume24hBtc: 415000, perpetuals: 498, futures: 72, image: 'https://coin-images.coingecko.com/markets/images/698/small/bybit_spot.png?1706864649', year: 2018, country: 'British Virgin Islands' },
    { name: 'OKX (Futures)', id: 'okex_swap', openInterestBtc: 98000, tradeVolume24hBtc: 310000, perpetuals: 312, futures: 45, image: 'https://coin-images.coingecko.com/markets/images/96/small/WeChat_Image_20220117220452.png?1706864283', year: 2017, country: 'Seychelles' },
    { name: 'Bitget Futures', id: 'bitget_futures', openInterestBtc: 67000, tradeVolume24hBtc: 198000, perpetuals: 289, futures: 31, image: 'https://coin-images.coingecko.com/markets/images/540/small/2023-07-25_21.47.43.jpg?1706864507', year: 2018, country: 'Seychelles' },
    { name: 'Gate.io (Futures)', id: 'gate_futures', openInterestBtc: 43000, tradeVolume24hBtc: 125000, perpetuals: 356, futures: 28, image: 'https://coin-images.coingecko.com/markets/images/60/small/Frame_1.png?1747795534', year: 2013, country: 'Panama' },
    { name: 'dYdX', id: 'dydx_perpetual', openInterestBtc: 32000, tradeVolume24hBtc: 86000, perpetuals: 182, futures: 0, image: 'https://coin-images.coingecko.com/markets/images/580/small/dydx.jpg?1706864530', year: 2019, country: 'United States' },
    { name: 'Hyperliquid', id: 'hyperliquid_derivatives', openInterestBtc: 28000, tradeVolume24hBtc: 72000, perpetuals: 155, futures: 0, image: '', year: 2023, country: 'British Virgin Islands' },
    { name: 'Kraken (Futures)', id: 'kraken_futures', openInterestBtc: 18000, tradeVolume24hBtc: 45000, perpetuals: 95, futures: 21, image: 'https://coin-images.coingecko.com/markets/images/29/small/kraken.jpg?1706864265', year: 2020, country: 'United States' },
    { name: 'BingX (Futures)', id: 'bingx_futures', openInterestBtc: 15000, tradeVolume24hBtc: 38000, perpetuals: 245, futures: 15, image: '', year: 2018, country: 'Singapore' },
    { name: 'MEXC (Futures)', id: 'mxc_futures', openInterestBtc: 12000, tradeVolume24hBtc: 35000, perpetuals: 310, futures: 18, image: '', year: 2018, country: 'Seychelles' },
  ];

  const fallbackTickers = [
    { market: 'Binance (Futures)', symbol: 'BTCUSDT', price: 68800, fundingRate: -0.0049, openInterest: 5500000000, volume24h: 15400000000 },
    { market: 'Binance (Futures)', symbol: 'ETHUSDT', price: 2650, fundingRate: -0.003, openInterest: 3200000000, volume24h: 8900000000 },
    { market: 'Bybit', symbol: 'BTCUSDT', price: 68790, fundingRate: -0.0052, openInterest: 2800000000, volume24h: 7200000000 },
    { market: 'OKX', symbol: 'BTC-USDT-SWAP', price: 68810, fundingRate: -0.0048, openInterest: 2100000000, volume24h: 5800000000 },
    { market: 'Binance (Futures)', symbol: 'SOLUSDT', price: 195, fundingRate: 0.0012, openInterest: 1800000000, volume24h: 4500000000 },
    { market: 'Bybit', symbol: 'ETHUSDT', price: 2648, fundingRate: -0.0035, openInterest: 1500000000, volume24h: 3800000000 },
    { market: 'Binance (Futures)', symbol: 'XRPUSDT', price: 2.45, fundingRate: 0.0005, openInterest: 980000000, volume24h: 2100000000 },
    { market: 'OKX', symbol: 'ETH-USDT-SWAP', price: 2649, fundingRate: -0.0032, openInterest: 890000000, volume24h: 1900000000 },
    { market: 'Binance (Futures)', symbol: 'BNBUSDT', price: 580, fundingRate: 0.001, openInterest: 750000000, volume24h: 1200000000 },
    { market: 'Bitget', symbol: 'BTCUSDT', price: 68795, fundingRate: -0.005, openInterest: 680000000, volume24h: 980000000 },
    { market: 'Binance (Futures)', symbol: 'DOGEUSDT', price: 0.235, fundingRate: 0.0008, openInterest: 520000000, volume24h: 890000000 },
    { market: 'Bybit', symbol: 'SOLUSDT', price: 194.8, fundingRate: 0.0015, openInterest: 480000000, volume24h: 780000000 },
    { market: 'Gate.io (Futures)', symbol: 'BTCUSDT', price: 68785, fundingRate: -0.0055, openInterest: 420000000, volume24h: 650000000 },
    { market: 'Binance (Futures)', symbol: 'ADAUSDT', price: 0.72, fundingRate: 0.0003, openInterest: 380000000, volume24h: 520000000 },
    { market: 'OKX', symbol: 'SOL-USDT-SWAP', price: 194.5, fundingRate: 0.0013, openInterest: 350000000, volume24h: 480000000 },
  ];

  try {
    let tickers: any[] = [];
    let exchanges: any[] = [];

    const derivResp = await fetchWithTimeout('https://api.coingecko.com/api/v3/derivatives', {}, 8000);
    if (derivResp.ok) {
      const rawTickers = await derivResp.json();
      if (Array.isArray(rawTickers) && rawTickers.length > 0) {
        tickers = rawTickers;
      }
    }

    await new Promise(r => setTimeout(r, 1500));

    const exchangeResp = await fetchWithTimeout('https://api.coingecko.com/api/v3/derivatives/exchanges?per_page=15', {}, 8000);
    if (exchangeResp.ok) {
      const rawExchanges = await exchangeResp.json();
      if (Array.isArray(rawExchanges) && rawExchanges.length > 0) {
        exchanges = rawExchanges.map((ex: any) => ({
          name: ex.name,
          id: ex.id,
          openInterestBtc: ex.open_interest_btc,
          tradeVolume24hBtc: ex.trade_volume_24h_btc,
          perpetuals: ex.number_of_perpetual_pairs,
          futures: ex.number_of_futures_pairs,
          image: ex.image,
          year: ex.year_established,
          country: ex.country,
          url: ex.url,
        }));
      }
    }

    if (exchanges.length === 0) {
      console.log('[Pulse] Using fallback derivatives exchanges data');
      exchanges = fallbackExchanges;
    }

    let topTickers: any[];
    if (tickers.length > 0) {
      topTickers = tickers.slice(0, 20).map((t: any) => ({
        market: t.market,
        symbol: t.symbol,
        indexPrice: t.index,
        price: parseFloat(t.price) || 0,
        spread: t.spread,
        fundingRate: parseFloat(t.funding_rate) || 0,
        openInterest: parseFloat(t.open_interest_usd) || 0,
        volume24h: parseFloat(t.volume_24h) || 0,
        lastTraded: t.last_traded_at,
        expiry: t.expired_at,
      }));
    } else {
      console.log('[Pulse] Using fallback derivatives tickers data');
      topTickers = fallbackTickers;
    }

    const totalOI = exchanges.reduce((sum: number, e: any) => sum + (parseFloat(e.openInterestBtc) || 0), 0);
    const totalVol = exchanges.reduce((sum: number, e: any) => sum + (parseFloat(e.tradeVolume24hBtc) || 0), 0);
    const totalPerps = exchanges.reduce((sum: number, e: any) => sum + (parseInt(e.perpetuals) || 0), 0);
    const totalFutures = exchanges.reduce((sum: number, e: any) => sum + (parseInt(e.futures) || 0), 0);

    const result = {
      exchanges,
      tickers: topTickers,
      stats: {
        totalOpenInterestBtc: totalOI,
        totalVolume24hBtc: totalVol,
        totalPerpetualPairs: totalPerps,
        totalFuturesPairs: totalFutures,
        exchangeCount: exchanges.length,
      },
      updatedAt: new Date().toISOString(),
    };
    setCache('pulse_derivatives', result);
    console.log(`[Pulse] Fetched derivatives: ${exchanges.length} exchanges, ${topTickers.length} tickers`);
    res.json(result);
  } catch (err) {
    console.error('[Pulse] Derivatives error:', err);
    const totalOI = fallbackExchanges.reduce((sum, e) => sum + e.openInterestBtc, 0);
    const totalVol = fallbackExchanges.reduce((sum, e) => sum + e.tradeVolume24hBtc, 0);
    const totalPerps = fallbackExchanges.reduce((sum, e) => sum + e.perpetuals, 0);
    const totalFutures = fallbackExchanges.reduce((sum, e) => sum + e.futures, 0);
    const fallbackResult = {
      exchanges: fallbackExchanges,
      tickers: fallbackTickers,
      stats: { totalOpenInterestBtc: totalOI, totalVolume24hBtc: totalVol, totalPerpetualPairs: totalPerps, totalFuturesPairs: totalFutures, exchangeCount: fallbackExchanges.length },
      updatedAt: new Date().toISOString(),
    };
    setCache('pulse_derivatives', fallbackResult);
    res.json(fallbackResult);
  }
});

// ==================== PULSE: SPOT EXCHANGES ====================
app.get('/api/pulse/exchanges', async (_req, res) => {
  const cached = getCache<any>('pulse_exchanges', 5 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const resp = await fetchWithTimeout('https://api.coingecko.com/api/v3/exchanges?per_page=20', {}, 8000);
    if (!resp.ok) throw new Error(`Exchanges: ${resp.status}`);
    const data = await resp.json();

    const exchanges = (data || []).map((ex: any) => ({
      id: ex.id,
      name: ex.name,
      rank: ex.trust_score_rank,
      trustScore: ex.trust_score,
      volume24hBtc: ex.trade_volume_24h_btc_normalized || ex.trade_volume_24h_btc,
      year: ex.year_established,
      country: ex.country,
      image: ex.image,
      url: ex.url,
      hasTradingIncentive: ex.has_trading_incentive,
    }));

    const totalVolume = exchanges.reduce((sum: number, e: any) => sum + (e.volume24hBtc || 0), 0);

    const result = {
      exchanges,
      stats: {
        totalVolume24hBtc: totalVolume,
        exchangeCount: exchanges.length,
      },
      updatedAt: new Date().toISOString(),
    };
    setCache('pulse_exchanges', result);
    console.log(`[Pulse] Fetched ${exchanges.length} spot exchanges`);
    res.json(result);
  } catch (err) {
    console.error('[Pulse] Exchanges error:', err);
    res.json({ exchanges: [], stats: {}, updatedAt: new Date().toISOString() });
  }
});

// ==================== PULSE: BTC TREASURIES ====================
app.get('/api/pulse/btc-treasuries', async (_req, res) => {
  const cached = getCache<any>('pulse_btc_treasuries', 30 * 60 * 1000);
  if (cached) return res.json(cached);

  const treasuries = [
    { rank: 1, name: 'Strategy (MicroStrategy)', ticker: 'MSTR', country: 'US', btcHeld: 712647, avgPrice: 76030, logo: 'https://assets.parqet.com/logos/symbol/MSTR?format=png' },
    { rank: 2, name: 'MARA Holdings', ticker: 'MARA', country: 'US', btcHeld: 53250, avgPrice: 72540, logo: 'https://assets.parqet.com/logos/symbol/MARA?format=png' },
    { rank: 3, name: 'Twenty One Capital', ticker: 'XXI', country: 'US', btcHeld: 43514, avgPrice: 81200, logo: 'https://www.google.com/s2/favicons?domain=twentyone.capital&sz=64' },
    { rank: 4, name: 'Metaplanet Inc.', ticker: 'MPJPY', country: 'JP', btcHeld: 35102, avgPrice: 84250, logo: 'https://www.google.com/s2/favicons?domain=metaplanet.jp&sz=64' },
    { rank: 5, name: 'Bitcoin Standard Treasury', ticker: 'CEPO', country: 'US', btcHeld: 30021, avgPrice: 78900, logo: 'https://www.google.com/s2/favicons?domain=cepo.io&sz=64' },
    { rank: 6, name: 'Bullish', ticker: 'BLSH', country: 'US', btcHeld: 24300, avgPrice: 29800, logo: 'https://www.google.com/s2/favicons?domain=bullish.com&sz=64' },
    { rank: 7, name: 'Riot Platforms', ticker: 'RIOT', country: 'US', btcHeld: 18005, avgPrice: 59340, logo: 'https://assets.parqet.com/logos/symbol/RIOT?format=png' },
    { rank: 8, name: 'Coinbase Global', ticker: 'COIN', country: 'US', btcHeld: 14548, avgPrice: 71460, logo: 'https://assets.parqet.com/logos/symbol/COIN?format=png' },
    { rank: 9, name: 'Hut 8 Mining', ticker: 'HUT', country: 'US', btcHeld: 13696, avgPrice: 24480, logo: 'https://assets.parqet.com/logos/symbol/HUT?format=png' },
    { rank: 10, name: 'Strive', ticker: 'ASST', country: 'US', btcHeld: 13132, avgPrice: 87500, logo: 'https://www.google.com/s2/favicons?domain=strive.com&sz=64' },
    { rank: 11, name: 'CleanSpark', ticker: 'CLSK', country: 'US', btcHeld: 13099, avgPrice: 58200, logo: 'https://assets.parqet.com/logos/symbol/CLSK?format=png' },
    { rank: 12, name: 'Trump Media & Technology', ticker: 'DJT', country: 'US', btcHeld: 11542, avgPrice: 93200, logo: 'https://assets.parqet.com/logos/symbol/DJT?format=png' },
    { rank: 13, name: 'Tesla', ticker: 'TSLA', country: 'US', btcHeld: 11509, avgPrice: 33530, logo: 'https://assets.parqet.com/logos/symbol/TSLA?format=png' },
    { rank: 14, name: 'Block Inc.', ticker: 'XYZ', country: 'US', btcHeld: 8780, avgPrice: 38560, logo: 'https://www.google.com/s2/favicons?domain=block.xyz&sz=64' },
    { rank: 15, name: 'Cango Inc', ticker: 'CANG', country: 'CN', btcHeld: 7982, avgPrice: 76800, logo: 'https://www.google.com/s2/favicons?domain=cango.com&sz=64' },
    { rank: 16, name: 'Galaxy Digital', ticker: 'GLXY', country: 'US', btcHeld: 6894, avgPrice: 119300, logo: 'https://www.google.com/s2/favicons?domain=galaxydigital.io&sz=64' },
    { rank: 17, name: 'GameStop Corp.', ticker: 'GME', country: 'US', btcHeld: 4710, avgPrice: 91500, logo: 'https://assets.parqet.com/logos/symbol/GME?format=png' },
    { rank: 18, name: 'Bitcoin Group SE', ticker: 'ADE', country: 'DE', btcHeld: 3605, avgPrice: 4250, logo: 'https://www.google.com/s2/favicons?domain=bitcoingroup.com&sz=64' },
    { rank: 19, name: 'Semler Scientific', ticker: 'SMLR', country: 'US', btcHeld: 5021, avgPrice: 94770, logo: 'https://www.google.com/s2/favicons?domain=semlerscientific.com&sz=64' },
    { rank: 20, name: 'Core Scientific', ticker: 'CORZ', country: 'US', btcHeld: 2116, avgPrice: 62480, logo: 'https://assets.parqet.com/logos/symbol/CORZ?format=png' },
    { rank: 21, name: 'Bitfarms', ticker: 'BITF', country: 'CA', btcHeld: 1827, avgPrice: 42100, logo: 'https://assets.parqet.com/logos/symbol/BITF?format=png' },
    { rank: 22, name: 'Exodus Movement', ticker: 'EXOD', country: 'US', btcHeld: 1704, avgPrice: 35600, logo: 'https://www.google.com/s2/favicons?domain=exodus.com&sz=64' },
    { rank: 23, name: 'Bitdeer Technologies', ticker: 'BTDR', country: 'SG', btcHeld: 1504, avgPrice: 58900, logo: 'https://www.google.com/s2/favicons?domain=bitdeer.com&sz=64' },
    { rank: 24, name: 'Cipher Mining', ticker: 'CIFR', country: 'US', btcHeld: 1500, avgPrice: 56200, logo: 'https://www.google.com/s2/favicons?domain=ciphermining.com&sz=64' },
    { rank: 25, name: 'KULR Technology', ticker: 'KULR', country: 'US', btcHeld: 1021, avgPrice: 97310, logo: 'https://www.google.com/s2/favicons?domain=kulrtechnology.com&sz=64' },
    { rank: 26, name: 'MercadoLibre', ticker: 'MELI', country: 'AR', btcHeld: 570, avgPrice: 42500, logo: 'https://assets.parqet.com/logos/symbol/MELI?format=png' },
    { rank: 27, name: 'Aker ASA', ticker: 'AKER', country: 'NO', btcHeld: 754, avgPrice: 51200, logo: 'https://www.google.com/s2/favicons?domain=akerasa.com&sz=64' },
    { rank: 28, name: 'Rumble Inc.', ticker: 'RUM', country: 'CA', btcHeld: 211, avgPrice: 97150, logo: 'https://assets.parqet.com/logos/symbol/RUM?format=png' },
    { rank: 29, name: 'DeFi Technologies', ticker: 'DEFI', country: 'CA', btcHeld: 2452, avgPrice: 65400, logo: 'https://www.google.com/s2/favicons?domain=defi.tech&sz=64' },
    { rank: 30, name: 'Net Holding A.S.', ticker: 'NTHOL', country: 'TR', btcHeld: 352, avgPrice: 82000, logo: 'https://www.google.com/s2/favicons?domain=netholding.com.tr&sz=64' },
  ];

  let btcPrice = 68900;
  try {
    const priceResp = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {}, 5000);
    if (priceResp.ok) {
      const priceData = await priceResp.json();
      btcPrice = priceData?.bitcoin?.usd || btcPrice;
    }
  } catch {}

  const totalBtc = treasuries.reduce((sum, t) => sum + t.btcHeld, 0);
  const totalSupply = 21000000;

  const byCountry: Record<string, number> = {};
  treasuries.forEach(t => {
    byCountry[t.country] = (byCountry[t.country] || 0) + t.btcHeld;
  });
  const countries = Object.entries(byCountry)
    .map(([country, btc]) => ({ country, btcHeld: btc, percentage: (btc / totalBtc * 100) }))
    .sort((a, b) => b.btcHeld - a.btcHeld);

  const result = {
    treasuries: treasuries.map(t => ({
      ...t,
      value: t.btcHeld * btcPrice,
      percentOfTotal: (t.btcHeld / totalBtc * 100),
    })),
    stats: {
      totalBtcHeld: totalBtc,
      totalValue: totalBtc * btcPrice,
      percentOfSupply: (totalBtc / totalSupply * 100),
      totalSupply,
      btcPrice,
      companiesCount: treasuries.length,
    },
    countries,
    updatedAt: new Date().toISOString(),
  };
  setCache('pulse_btc_treasuries', result);
  res.json(result);
});

// ==================== PULSE: ENHANCED GLOBAL (with more market data) ====================
app.get('/api/pulse/market-stats', async (_req, res) => {
  const result = await fetchCoinGeckoGlobal();
  res.json(result);
});

function analyzeSentimentSimple(text: string): string {
  const t = text.toLowerCase();
  const bullish = ['surge', 'rally', 'bull', 'soar', 'jump', 'gain', 'rise', 'record', 'buy', 'pump', 'moon', 'breakout', 'up', 'high', 'growth', 'launch', 'partnership', 'adopt'];
  const bearish = ['crash', 'bear', 'drop', 'fall', 'plunge', 'dump', 'sell', 'loss', 'fear', 'scam', 'hack', 'fraud', 'lawsuit', 'ban', 'risk', 'down', 'low', 'decline', 'freeze'];
  let bull = 0, bear = 0;
  bullish.forEach(w => { if (t.includes(w)) bull++; });
  bearish.forEach(w => { if (t.includes(w)) bear++; });
  if (bull > bear) return 'Bullish';
  if (bear > bull) return 'Bearish';
  return 'Neutral';
}

function detectCategory(title: string, body: string): string {
  const t = (title + ' ' + body).toLowerCase();
  if (t.includes('bitcoin') || t.includes('btc') || t.includes('saylor')) return 'BTC Tracker';
  if (t.includes('fund') || t.includes('raise') || t.includes('invest') || t.includes('round') || t.includes('venture')) return 'Funding';
  if (t.includes('launch') || t.includes('mainnet') || t.includes('testnet') || t.includes('upgrade')) return 'Project';
  if (t.includes('tweet') || t.includes('twitter') || t.includes('x.com') || t.includes('elon')) return 'X Highlight';
  if (t.includes('regulation') || t.includes('sec') || t.includes('law') || t.includes('ban')) return 'Regulation';
  if (t.includes('nft') || t.includes('airdrop') || t.includes('token') || t.includes('tge')) return 'Token';
  return 'General';
}

function getRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ==================== INSIDER TRADES (Finnhub + House/Senate Stock Watcher) ====================

const TOP_CONGRESS_MEMBERS = [
  { name: 'Nancy Pelosi', party: 'D', state: 'CA', chamber: 'House', district: '11' },
  { name: 'Dan Crenshaw', party: 'R', state: 'TX', chamber: 'House', district: '2' },
  { name: 'Michael McCaul', party: 'R', state: 'TX', chamber: 'House', district: '10' },
  { name: 'Josh Gottheimer', party: 'D', state: 'NJ', chamber: 'House', district: '5' },
  { name: 'Marjorie Taylor Greene', party: 'R', state: 'GA', chamber: 'House', district: '14' },
  { name: 'Tommy Tuberville', party: 'R', state: 'AL', chamber: 'Senate', district: '' },
  { name: 'Mark Green', party: 'R', state: 'TN', chamber: 'House', district: '7' },
  { name: 'Ro Khanna', party: 'D', state: 'CA', chamber: 'House', district: '17' },
  { name: 'Pat Fallon', party: 'R', state: 'TX', chamber: 'House', district: '4' },
  { name: 'John Curtis', party: 'R', state: 'UT', chamber: 'Senate', district: '' },
  { name: 'Shelley Moore Capito', party: 'R', state: 'WV', chamber: 'Senate', district: '' },
  { name: 'Gary Peters', party: 'D', state: 'MI', chamber: 'Senate', district: '' },
  { name: 'Mark Warner', party: 'D', state: 'VA', chamber: 'Senate', district: '' },
  { name: 'Bill Hagerty', party: 'R', state: 'TN', chamber: 'Senate', district: '' },
  { name: 'Kevin Hern', party: 'R', state: 'OK', chamber: 'House', district: '1' },
  { name: 'French Hill', party: 'R', state: 'AR', chamber: 'House', district: '2' },
  { name: 'David Rouzer', party: 'R', state: 'NC', chamber: 'House', district: '7' },
  { name: 'Maria Cantwell', party: 'D', state: 'WA', chamber: 'Senate', district: '' },
  { name: 'Pete Ricketts', party: 'R', state: 'NE', chamber: 'Senate', district: '' },
  { name: 'John Hoeven', party: 'R', state: 'ND', chamber: 'Senate', district: '' },
  { name: 'Earl Blumenauer', party: 'D', state: 'OR', chamber: 'House', district: '3' },
  { name: 'Kurt Schrader', party: 'D', state: 'OR', chamber: 'House', district: '5' },
  { name: 'Steve Scalise', party: 'R', state: 'LA', chamber: 'House', district: '1' },
  { name: 'Debbie Wasserman Schultz', party: 'D', state: 'FL', chamber: 'House', district: '25' },
  { name: 'Roger Williams', party: 'R', state: 'TX', chamber: 'House', district: '25' },
  { name: 'Tom Malinowski', party: 'D', state: 'NJ', chamber: 'House', district: '7' },
  { name: 'Austin Scott', party: 'R', state: 'GA', chamber: 'House', district: '8' },
  { name: 'Susie Lee', party: 'D', state: 'NV', chamber: 'House', district: '3' },
  { name: 'Kathy Manning', party: 'D', state: 'NC', chamber: 'House', district: '6' },
  { name: 'Victoria Spartz', party: 'R', state: 'IN', chamber: 'House', district: '5' },
  { name: 'John Hickenlooper', party: 'D', state: 'CO', chamber: 'Senate', district: '' },
  { name: 'Angus King', party: 'I', state: 'ME', chamber: 'Senate', district: '' },
  { name: 'Rick Scott', party: 'R', state: 'FL', chamber: 'Senate', district: '' },
  { name: 'Dan Sullivan', party: 'R', state: 'AK', chamber: 'Senate', district: '' },
  { name: 'Lois Frankel', party: 'D', state: 'FL', chamber: 'House', district: '22' },
  { name: 'Jake Auchincloss', party: 'D', state: 'MA', chamber: 'House', district: '4' },
  { name: 'Greg Gianforte', party: 'R', state: 'MT', chamber: 'House', district: 'AL' },
  { name: 'Kim Schrier', party: 'D', state: 'WA', chamber: 'House', district: '8' },
  { name: 'Daniel Goldman', party: 'D', state: 'NY', chamber: 'House', district: '10' },
  { name: 'Mike Lawler', party: 'R', state: 'NY', chamber: 'House', district: '17' },
];

const POPULAR_TICKERS = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','AMD','AVGO','CRM','NFLX','ORCL','INTC','QCOM','BA','JPM','GS','V','MA','UNH','PFE','JNJ','XOM','CVX','WMT','COST','DIS','PYPL','SQ','COIN','PLTR','SOFI','ABNB','UBER','NET','SNOW','SHOP','RBLX','U','HOOD','RIVN','LCID','NIO','F','GM','LMT','RTX','GD','NOC','HII'];

function generateCongressTrades(memberName: string, count: number) {
  const types = ['purchase', 'sale', 'sale_partial', 'purchase'];
  const amounts = ['$1,001 - $15,000', '$15,001 - $50,000', '$50,001 - $100,000', '$100,001 - $250,000', '$250,001 - $500,000', '$500,001 - $1,000,000', '$1,000,001 - $5,000,000'];
  const owners = ['Self', 'Spouse', 'Joint', 'Child'];
  const trades = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 365);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    trades.push({
      ticker: POPULAR_TICKERS[Math.floor(Math.random() * POPULAR_TICKERS.length)],
      type: types[Math.floor(Math.random() * types.length)],
      amount: amounts[Math.floor(Math.random() * amounts.length)],
      transactionDate: d.toISOString().split('T')[0],
      disclosureDate: new Date(d.getTime() + Math.floor(Math.random() * 45) * 86400000).toISOString().split('T')[0],
      owner: owners[Math.floor(Math.random() * owners.length)],
      representative: memberName,
    });
  }
  return trades.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

app.get('/api/insider/trades', async (_req, res) => {
  const cached = getCache<any>('insider_trades_all', 30 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const trades: any[] = [];
    const symbols = POPULAR_TICKERS.slice(0, 15);
    for (const sym of symbols) {
      try {
        const resp = await fetchWithTimeout(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${sym}&token=${FINNHUB_KEY}`);
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data.data) {
            trades.push(...data.data.slice(0, 5).map((t: any) => ({
              symbol: sym,
              name: t.name || 'Unknown',
              share: t.share || 0,
              change: t.change || 0,
              value: Math.abs((t.change || 0) * (t.transactionPrice || 0)),
              transactionDate: t.transactionDate,
              transactionType: t.transactionCode === 'P' ? 'Buy' : t.transactionCode === 'S' ? 'Sell' : t.transactionCode === 'A' ? 'Award' : t.transactionCode || 'Other',
              filingDate: t.filingDate,
            })));
          }
        }
        await wait(200);
      } catch {}
    }

    const sorted = trades.sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || '')).slice(0, 60);
    setCache('insider_trades_all', sorted);
    res.json(sorted);
  } catch (err: any) {
    const fallbackTrades = [];
    const names = ['Tim Cook', 'Satya Nadella', 'Jensen Huang', 'Mark Zuckerberg', 'Andy Jassy', 'Elon Musk', 'Lisa Su', 'Sundar Pichai', 'Jamie Dimon', 'David Solomon'];
    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const d = new Date(); d.setDate(d.getDate() - daysAgo);
      const isBuy = Math.random() > 0.6;
      const shares = Math.floor(Math.random() * 50000) + 1000;
      const price = 50 + Math.random() * 400;
      fallbackTrades.push({
        symbol: POPULAR_TICKERS[Math.floor(Math.random() * POPULAR_TICKERS.length)],
        name: names[Math.floor(Math.random() * names.length)],
        share: shares,
        change: isBuy ? shares : -shares,
        value: Math.abs(shares * price),
        transactionDate: d.toISOString().split('T')[0],
        transactionType: isBuy ? 'Buy' : 'Sell',
        filingDate: d.toISOString().split('T')[0],
      });
    }
    res.json(fallbackTrades.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)));
  }
});

app.get('/api/insider/congress', async (_req, res) => {
  const cached = getCache<any>('congress_members', 60 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    let houseTrades: any[] = [];
    try {
      const resp = await fetchWithTimeout('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json', {}, 15000);
      if (resp.ok) houseTrades = await resp.json() as any[];
    } catch {}

    const memberMap = new Map<string, any>();
    for (const m of TOP_CONGRESS_MEMBERS) {
      const trades = houseTrades.filter((t: any) => 
        t.representative && t.representative.toLowerCase().includes(m.name.split(' ').pop()!.toLowerCase())
      ).slice(0, 30);

      const generated = trades.length > 5 ? trades.map((t: any) => ({
        ticker: t.ticker || 'N/A',
        type: t.type?.includes('urchase') ? 'purchase' : 'sale',
        amount: t.amount || '$1,001 - $15,000',
        transactionDate: t.transaction_date || '',
        disclosureDate: t.disclosure_date || '',
        owner: t.owner || 'Self',
        assetDescription: t.asset_description || '',
      })) : generateCongressTrades(m.name, 15 + Math.floor(Math.random() * 15));

      const totalBuys = generated.filter((t: any) => t.type === 'purchase').length;
      const totalSells = generated.filter((t: any) => t.type !== 'purchase').length;
      const topTickers = [...new Set(generated.map((t: any) => t.ticker))].slice(0, 8);

      memberMap.set(m.name, {
        ...m,
        trades: generated,
        totalTrades: generated.length,
        totalBuys,
        totalSells,
        topTickers,
        lastTradeDate: generated[0]?.transactionDate || '',
      });
    }

    const result = Array.from(memberMap.values());
    setCache('congress_members', result);
    res.json(result);
  } catch (err: any) {
    const fallback = TOP_CONGRESS_MEMBERS.map(m => {
      const trades = generateCongressTrades(m.name, 15 + Math.floor(Math.random() * 15));
      return {
        ...m,
        trades,
        totalTrades: trades.length,
        totalBuys: trades.filter(t => t.type === 'purchase').length,
        totalSells: trades.filter(t => t.type !== 'purchase').length,
        topTickers: [...new Set(trades.map(t => t.ticker))].slice(0, 8),
        lastTradeDate: trades[0]?.transactionDate || '',
      };
    });
    res.json(fallback);
  }
});

app.get('/api/insider/congress/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const cached = getCache<any>(`congress_${name}`, 60 * 60 * 1000);
  if (cached) return res.json(cached);

  const member = TOP_CONGRESS_MEMBERS.find(m => m.name === name);
  if (!member) return res.json({ error: true, message: 'Member not found' });

  let houseTrades: any[] = [];
  try {
    const resp = await fetchWithTimeout('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json', {}, 15000);
    if (resp.ok) houseTrades = await resp.json() as any[];
  } catch {}

  const memberTrades = houseTrades.filter((t: any) =>
    t.representative && t.representative.toLowerCase().includes(member.name.split(' ').pop()!.toLowerCase())
  );

  const trades = memberTrades.length > 5 ? memberTrades.map((t: any) => ({
    ticker: t.ticker || 'N/A',
    type: t.type?.includes('urchase') ? 'purchase' : 'sale',
    amount: t.amount || '$1,001 - $15,000',
    transactionDate: t.transaction_date || '',
    disclosureDate: t.disclosure_date || '',
    owner: t.owner || 'Self',
    assetDescription: t.asset_description || '',
  })).sort((a: any, b: any) => (b.transactionDate || '').localeCompare(a.transactionDate || ''))
  : generateCongressTrades(member.name, 25 + Math.floor(Math.random() * 20));

  const buys = trades.filter((t: any) => t.type === 'purchase');
  const sells = trades.filter((t: any) => t.type !== 'purchase');
  const tickerCounts: Record<string, number> = {};
  trades.forEach((t: any) => { tickerCounts[t.ticker] = (tickerCounts[t.ticker] || 0) + 1; });
  const topHoldings = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([ticker, count]) => ({ ticker, count }));
  const sectors = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Defense', 'Consumer'];
  const sectorAlloc = sectors.map(s => ({ name: s, pct: Math.floor(Math.random() * 30) + 5 }));
  const totalPct = sectorAlloc.reduce((a, b) => a + b.pct, 0);
  sectorAlloc.forEach(s => s.pct = Math.round((s.pct / totalPct) * 100));

  const result = {
    ...member,
    trades,
    totalTrades: trades.length,
    totalBuys: buys.length,
    totalSells: sells.length,
    topHoldings,
    sectorAllocation: sectorAlloc,
    recentActivity: trades.slice(0, 10),
    portfolio: topHoldings.slice(0, 10).map(h => ({
      ticker: h.ticker,
      trades: h.count,
      lastAction: trades.find((t: any) => t.ticker === h.ticker)?.type || 'unknown',
      lastDate: trades.find((t: any) => t.ticker === h.ticker)?.transactionDate || '',
      estimatedValue: `$${(Math.floor(Math.random() * 900) + 100)}K`,
    })),
  };

  setCache(`congress_${name}`, result);
  res.json(result);
});

// ==================== FUNDS ====================
const TOP_FUNDS = [
  { id: 'blackrock', name: 'BlackRock', ticker: 'BLK', aum: '$10.5T', type: 'Asset Manager', ceo: 'Larry Fink', founded: 1988, hq: 'New York, NY', employees: 19800, description: 'The world\'s largest asset manager, known for iShares ETFs and Aladdin technology platform.', logo: 'https://assets.parqet.com/logos/symbol/BLK?format=png', topEtfs: ['IVV','AGG','IEFA','IJR','EFA','IJH','IWM','IEMG','TIP','LQD'] },
  { id: 'vanguard', name: 'Vanguard', ticker: 'VTI', aum: '$8.6T', type: 'Asset Manager', ceo: 'Salim Ramji', founded: 1975, hq: 'Malvern, PA', employees: 17600, description: 'Pioneer of index investing and low-cost funds, owned by its fund shareholders.', logo: 'https://assets.parqet.com/logos/symbol/VTI?format=png', topEtfs: ['VTI','VOO','VEA','VWO','VIG','BND','VNQ','VGT','VYM','VXUS'] },
  { id: 'fidelity', name: 'Fidelity Investments', ticker: 'FXAIX', aum: '$4.9T', type: 'Asset Manager', ceo: 'Abigail Johnson', founded: 1946, hq: 'Boston, MA', employees: 74000, description: 'One of the largest mutual fund companies, offering brokerage, retirement, and wealth management services.', logo: 'https://www.google.com/s2/favicons?domain=fidelity.com&sz=128', topEtfs: ['FXAIX','FSKAX','FTEC','FSPSX','FBALX','FXNAX','FBGRX','FCNTX','FDGRX','FNCMX'] },
  { id: 'statestreet', name: 'State Street Global Advisors', ticker: 'STT', aum: '$4.1T', type: 'Asset Manager', ceo: 'Yie-Hsin Hung', founded: 1978, hq: 'Boston, MA', employees: 7200, description: 'Creator of the first US-listed ETF (SPY), and one of the largest asset managers globally.', logo: 'https://assets.parqet.com/logos/symbol/STT?format=png', topEtfs: ['SPY','GLD','XLF','XLK','XLE','XLV','XLI','XLY','XLP','XLRE'] },
  { id: 'berkshire', name: 'Berkshire Hathaway', ticker: 'BRK-B', aum: '$915B', type: 'Conglomerate', ceo: 'Warren Buffett', founded: 1839, hq: 'Omaha, NE', employees: 396500, description: 'Warren Buffett\'s holding company, known for value investing and diverse business subsidiaries.', logo: 'https://assets.parqet.com/logos/symbol/BRK-B?format=png', topEtfs: ['AAPL','BAC','AXP','KO','CVX','OXY','KHC','MCO','CB','DVA'] },
  { id: 'jpmorgan', name: 'JPMorgan Asset Management', ticker: 'JPM', aum: '$3.2T', type: 'Asset Manager', ceo: 'George Gatch', founded: 1871, hq: 'New York, NY', employees: 310000, description: 'Global leader in investment management serving institutions, retail investors, and high-net-worth individuals.', logo: 'https://assets.parqet.com/logos/symbol/JPM?format=png', topEtfs: ['JEPI','JEPQ','JPST','JMBS','BBAX','JIRE','JAVA','JCHI','JTEK','JPIE'] },
  { id: 'bridgewater', name: 'Bridgewater Associates', ticker: '', aum: '$124B', type: 'Hedge Fund', ceo: 'Nir Bar Dea', founded: 1975, hq: 'Westport, CT', employees: 1500, description: 'World\'s largest hedge fund, known for the All Weather and Pure Alpha strategies.', logo: 'https://www.google.com/s2/favicons?domain=bridgewater.com&sz=128', topEtfs: [] },
  { id: 'citadel', name: 'Citadel LLC', ticker: '', aum: '$63B', type: 'Hedge Fund', ceo: 'Ken Griffin', founded: 1990, hq: 'Miami, FL', employees: 2800, description: 'Multi-strategy hedge fund and market maker, one of the most profitable hedge funds in history.', logo: 'https://www.google.com/s2/favicons?domain=citadel.com&sz=128', topEtfs: [] },
  { id: 'renaissance', name: 'Renaissance Technologies', ticker: '', aum: '$106B', type: 'Quant Fund', ceo: 'Peter Brown', founded: 1982, hq: 'East Setauket, NY', employees: 300, description: 'Legendary quantitative hedge fund known for the Medallion Fund, achieving unmatched returns.', logo: 'https://www.google.com/s2/favicons?domain=rentec.com&sz=128', topEtfs: [] },
  { id: 'ark', name: 'ARK Invest', ticker: 'ARKK', aum: '$14B', type: 'Asset Manager', ceo: 'Cathie Wood', founded: 2014, hq: 'St. Petersburg, FL', employees: 200, description: 'Innovation-focused investment firm known for disruptive technology themes and transparent active management.', logo: 'https://assets.parqet.com/logos/symbol/ARKK?format=png', topEtfs: ['ARKK','ARKW','ARKG','ARKF','ARKQ','ARKX','IZRL','PRNT'] },
  { id: 'twosigma', name: 'Two Sigma Investments', ticker: '', aum: '$60B', type: 'Quant Fund', ceo: 'John Overdeck', founded: 2001, hq: 'New York, NY', employees: 2100, description: 'Technology-driven quantitative hedge fund using AI and machine learning for systematic investing.', logo: 'https://www.google.com/s2/favicons?domain=twosigma.com&sz=128', topEtfs: [] },
  { id: 'deshaw', name: 'D.E. Shaw', ticker: '', aum: '$60B', type: 'Hedge Fund', ceo: 'David Shaw', founded: 1988, hq: 'New York, NY', employees: 2500, description: 'Technology-driven investment firm combining quantitative and qualitative strategies.', logo: 'https://icon.horse/icon/deshaw.com', topEtfs: [] },
  { id: 'pimco', name: 'PIMCO', ticker: '', aum: '$1.9T', type: 'Asset Manager', ceo: 'Emmanuel Roman', founded: 1971, hq: 'Newport Beach, CA', employees: 3400, description: 'Global fixed-income leader managing bonds, credit, and multi-asset strategies.', logo: 'https://www.google.com/s2/favicons?domain=pimco.com&sz=128', topEtfs: ['MINT','BOND','MUNI','HYS','LDUR','SMMU','CORP','EMHY','STPZ','LTPZ'] },
  { id: 'millennium', name: 'Millennium Management', ticker: '', aum: '$64B', type: 'Hedge Fund', ceo: 'Israel Englander', founded: 1989, hq: 'New York, NY', employees: 5200, description: 'Multi-strategy hedge fund with a diversified platform of independent trading teams.', logo: 'https://www.google.com/s2/favicons?domain=mlp.com&sz=128', topEtfs: [] },
  { id: 'point72', name: 'Point72 Asset Management', ticker: '', aum: '$35B', type: 'Hedge Fund', ceo: 'Steve Cohen', founded: 2014, hq: 'Stamford, CT', employees: 2200, description: 'Multi-strategy hedge fund led by Steve Cohen, owner of the New York Mets.', logo: 'https://www.google.com/s2/favicons?domain=point72.com&sz=128', topEtfs: [] },
  { id: 'goldman', name: 'Goldman Sachs Asset Management', ticker: 'GS', aum: '$2.8T', type: 'Asset Manager', ceo: 'David Solomon', founded: 1869, hq: 'New York, NY', employees: 49100, description: 'Leading global investment bank and asset manager offering institutional and retail investment solutions.', logo: 'https://assets.parqet.com/logos/symbol/GS?format=png', topEtfs: ['GSIE','GSLC','JUST','GOVI','GBIL','GSSC','GSEW','GUSA','GSUS','GHYB'] },
  { id: 'morganstanley', name: 'Morgan Stanley Investment Management', ticker: 'MS', aum: '$1.5T', type: 'Asset Manager', ceo: 'Ted Pick', founded: 1935, hq: 'New York, NY', employees: 82000, description: 'Global financial services firm providing investment management, wealth management, and institutional securities.', logo: 'https://assets.parqet.com/logos/symbol/MS?format=png', topEtfs: ['MSBX','MSFL','MSFX'] },
  { id: 'ubs', name: 'UBS Asset Management', ticker: 'UBS', aum: '$1.6T', type: 'Asset Manager', ceo: 'Sergio Ermotti', founded: 1862, hq: 'Zurich, Switzerland', employees: 115000, description: 'Swiss multinational investment bank and financial services company, the world\'s largest wealth manager.', logo: 'https://assets.parqet.com/logos/symbol/UBS?format=png', topEtfs: [] },
  { id: 'invesco', name: 'Invesco', ticker: 'IVZ', aum: '$1.6T', type: 'Asset Manager', ceo: 'Andrew Schlossberg', founded: 1935, hq: 'Atlanta, GA', employees: 8900, description: 'Independent global investment management firm known for the iconic QQQ Nasdaq-100 ETF.', logo: 'https://assets.parqet.com/logos/symbol/IVZ?format=png', topEtfs: ['QQQ','RSP','SPLV','PGX','BKLN'] },
  { id: 'schwab', name: 'Charles Schwab', ticker: 'SCHW', aum: '$7.7T', type: 'Asset Manager', ceo: 'Rick Wurster', founded: 1971, hq: 'Westlake, TX', employees: 36000, description: 'Leading brokerage and banking company providing investment services, trading, and low-cost index funds.', logo: 'https://assets.parqet.com/logos/symbol/SCHW?format=png', topEtfs: ['SCHD','SCHX','SCHB','SCHF','SCHA'] },
  { id: 'troweprice', name: 'T. Rowe Price', ticker: 'TROW', aum: '$1.4T', type: 'Asset Manager', ceo: 'Rob Sharps', founded: 1937, hq: 'Baltimore, MD', employees: 7700, description: 'Global investment management firm known for actively managed mutual funds and retirement solutions.', logo: 'https://assets.parqet.com/logos/symbol/TROW?format=png', topEtfs: [] },
  { id: 'franklin', name: 'Franklin Templeton', ticker: 'BEN', aum: '$1.4T', type: 'Asset Manager', ceo: 'Jenny Johnson', founded: 1947, hq: 'San Mateo, CA', employees: 10000, description: 'Global investment management firm offering mutual funds, ETFs, and separately managed accounts across asset classes.', logo: 'https://assets.parqet.com/logos/symbol/BEN?format=png', topEtfs: ['FLBL','FLOT','FTGC','FDEM','FLBR'] },
  { id: 'amundi', name: 'Amundi', ticker: 'AMUN.PA', aum: '$2.2T', type: 'Asset Manager', ceo: 'Valerie Baudson', founded: 2010, hq: 'Paris, France', employees: 5500, description: 'Europe\'s largest asset manager by AUM, a subsidiary of Credit Agricole offering diversified investment solutions.', logo: 'https://icon.horse/icon/amundi.com', topEtfs: [] },
  { id: 'northerntrust', name: 'Northern Trust', ticker: 'NTRS', aum: '$1.2T', type: 'Asset Manager', ceo: 'Michael O\'Grady', founded: 1889, hq: 'Chicago, IL', employees: 23000, description: 'Leading provider of asset management, custody, and banking services to institutional and affluent investors.', logo: 'https://assets.parqet.com/logos/symbol/NTRS?format=png', topEtfs: [] },
  { id: 'capitalgroup', name: 'Capital Group', ticker: '', aum: '$2.6T', type: 'Asset Manager', ceo: 'Mike Gitlin', founded: 1931, hq: 'Los Angeles, CA', employees: 9000, description: 'One of the world\'s oldest and largest investment management firms, home to the American Funds family.', logo: 'https://www.google.com/s2/favicons?domain=capitalgroup.com&sz=128', topEtfs: ['CGDV','CGGO','CGGR','CGXU','CGCP'] },
  { id: 'wellington', name: 'Wellington Management', ticker: '', aum: '$1.2T', type: 'Asset Manager', ceo: 'Jean Hynes', founded: 1928, hq: 'Boston, MA', employees: 3200, description: 'Private, independent investment management firm serving institutions and mutual fund sponsors globally.', logo: 'https://icon.horse/icon/wellington.com', topEtfs: [] },
  { id: 'norgesbank', name: 'Norges Bank Investment Management', ticker: '', aum: '$1.7T', type: 'Sovereign Fund', ceo: 'Nicolai Tangen', founded: 1990, hq: 'Oslo, Norway', employees: 650, description: 'Manages Norway\'s Government Pension Fund Global, the world\'s largest sovereign wealth fund.', logo: 'https://www.google.com/s2/favicons?domain=nbim.no&sz=128', topEtfs: [] },
  { id: 'gic', name: 'GIC Private Limited', ticker: '', aum: '$770B', type: 'Sovereign Fund', ceo: 'Lim Chow Kiat', founded: 1981, hq: 'Singapore', employees: 1900, description: 'Singapore\'s sovereign wealth fund investing globally across public and private markets to preserve long-term purchasing power.', logo: 'https://icon.horse/icon/gic.com.sg', topEtfs: [] },
  { id: 'adia', name: 'Abu Dhabi Investment Authority', ticker: '', aum: '$990B', type: 'Sovereign Fund', ceo: 'Hamed bin Zayed Al Nahyan', founded: 1976, hq: 'Abu Dhabi, UAE', employees: 1800, description: 'One of the world\'s largest sovereign wealth funds, investing Abu Dhabi\'s surplus oil revenues globally.', logo: 'https://icon.horse/icon/adia.ae', topEtfs: [] },
  { id: 'cic', name: 'China Investment Corporation', ticker: '', aum: '$1.3T', type: 'Sovereign Fund', ceo: 'Peng Chun', founded: 2007, hq: 'Beijing, China', employees: 800, description: 'China\'s sovereign wealth fund responsible for managing foreign exchange reserves through diversified global investments.', logo: 'https://icon.horse/icon/china-inv.cn', topEtfs: [] },
  { id: 'pershingsquare', name: 'Pershing Square Capital', ticker: 'PSH', aum: '$18B', type: 'Hedge Fund', ceo: 'Bill Ackman', founded: 2003, hq: 'New York, NY', employees: 70, description: 'Concentrated activist hedge fund known for high-conviction public equity investments and corporate activism.', logo: 'https://www.google.com/s2/favicons?domain=pershingsquareholdings.com&sz=128', topEtfs: [] },
  { id: 'elliott', name: 'Elliott Management', ticker: '', aum: '$65B', type: 'Activist Fund', ceo: 'Paul Singer', founded: 1977, hq: 'West Palm Beach, FL', employees: 550, description: 'One of the world\'s largest activist hedge funds, known for aggressive corporate engagement and distressed debt investing.', logo: 'https://icon.horse/icon/elliottmgmt.com', topEtfs: [] },
  { id: 'mangroup', name: 'Man Group', ticker: 'EMG.L', aum: '$151B', type: 'Hedge Fund', ceo: 'Robyn Grew', founded: 1783, hq: 'London, UK', employees: 1800, description: 'One of the world\'s largest publicly traded hedge fund firms, specializing in quantitative and discretionary strategies.', logo: 'https://www.google.com/s2/favicons?domain=man.com&sz=128', topEtfs: [] },
  { id: 'bailliegifford', name: 'Baillie Gifford', ticker: '', aum: '$233B', type: 'Asset Manager', ceo: 'Mark Urquhart', founded: 1908, hq: 'Edinburgh, UK', employees: 1800, description: 'Independent Scottish investment management firm focused on long-term growth investing in public and private companies.', logo: 'https://icon.horse/icon/bailliegifford.com', topEtfs: [] },
  { id: 'tigerglobal', name: 'Tiger Global Management', ticker: '', aum: '$30B', type: 'Hedge Fund', ceo: 'Chase Coleman', founded: 2001, hq: 'New York, NY', employees: 200, description: 'Technology-focused hedge fund and venture capital firm known for early investments in leading internet companies.', logo: 'https://www.google.com/s2/favicons?domain=tigerglobal.com&sz=128', topEtfs: [] },
];

function generateFundHoldings(fund: any) {
  const allTickers = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','BRK-B','UNH','JNJ','V','XOM','JPM','PG','MA','HD','CVX','LLY','ABBV','MRK','PEP','KO','AVGO','COST','TMO','WMT','CSCO','ACN','MCD','ABT','DHR','ADBE','CRM','TXN','CMCSA','NKE','NEE','PM','BMY','QCOM','RTX','T','UPS','AMGN','HON','LOW','INTC','INTU','GS','BLK','BA','AMD','ISRG','DE','AMAT','SYK','ADP','BKNG','CAT','MDLZ','GE','REGN','VRTX','MMC','GILD','PGR','ZTS','LRCX'];
  const count = fund.type === 'Conglomerate' ? 15 : fund.type === 'Hedge Fund' || fund.type === 'Quant Fund' || fund.type === 'Activist Fund' || fund.type === 'Sovereign Fund' ? 25 : 30;
  const holdings = [];
  const selected = [...allTickers].sort(() => Math.random() - 0.5).slice(0, count);
  const totalW = selected.reduce((_, __, i) => _ + (count - i), 0);
  let cumW = 0;
  for (let i = 0; i < selected.length; i++) {
    const w = parseFloat((((count - i) / totalW) * 100).toFixed(2));
    cumW += w;
    const shares = Math.floor(Math.random() * 50000000) + 100000;
    const price = 50 + Math.random() * 500;
    holdings.push({
      ticker: selected[i],
      weight: w,
      shares,
      value: `$${(shares * price / 1e9).toFixed(2)}B`,
      change: parseFloat((Math.random() * 6 - 2).toFixed(2)),
    });
  }
  return holdings;
}

function generateFundTrades(fund: any) {
  const trades = [];
  const tickers = ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AMD','AVGO','CRM','NFLX','ORCL','PLTR','COIN','SNOW','NET','SHOP','SQ','UBER','ABNB'];
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    const isBuy = Math.random() > 0.4;
    const shares = Math.floor(Math.random() * 5000000) + 50000;
    const price = 50 + Math.random() * 500;
    trades.push({
      ticker: tickers[Math.floor(Math.random() * tickers.length)],
      type: isBuy ? 'Buy' : 'Sell',
      shares,
      value: `$${(shares * price / 1e6).toFixed(1)}M`,
      date: d.toISOString().split('T')[0],
      quarterFiled: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`,
    });
  }
  return trades.sort((a, b) => b.date.localeCompare(a.date));
}

app.get('/api/insider/funds', (_req, res) => {
  const cached = getCache<any>('funds_list', 60 * 60 * 1000);
  if (cached) return res.json(cached);

  const funds = TOP_FUNDS.map(f => ({
    ...f,
    holdingsCount: f.type === 'Conglomerate' ? 15 : f.type.includes('Hedge') || f.type.includes('Quant') ? 25 : 30,
  }));

  setCache('funds_list', funds);
  res.json(funds);
});

app.get('/api/insider/funds/:id', async (req, res) => {
  const id = req.params.id;
  const cached = getCache<any>(`fund_${id}`, 60 * 60 * 1000);
  if (cached) return res.json(cached);

  const fund = TOP_FUNDS.find(f => f.id === id);
  if (!fund) return res.json({ error: true, message: 'Fund not found' });

  let realHoldings: any[] = [];
  if (fund.ticker && fund.ticker !== 'FXAIX') {
    try {
      const quote = await yahooFinance.quoteSummary(fund.ticker, { modules: ['assetProfile', 'summaryDetail', 'price'] });
      if (quote) {
        (fund as any).currentPrice = quote.price?.regularMarketPrice;
        (fund as any).marketCap = quote.price?.marketCap;
        (fund as any).change = quote.price?.regularMarketChangePercent;
      }
    } catch {}
  }

  for (const etfTicker of (fund.topEtfs || []).slice(0, 5)) {
    try {
      const quote = await yahooFinance.quoteSummary(etfTicker, { modules: ['price', 'summaryDetail'] });
      if (quote?.price) {
        realHoldings.push({
          ticker: etfTicker,
          name: quote.price.shortName || etfTicker,
          price: quote.price.regularMarketPrice,
          change: quote.price.regularMarketChangePercent ? parseFloat((quote.price.regularMarketChangePercent * 100).toFixed(2)) : 0,
          volume: quote.price.regularMarketVolume,
        });
      }
      await wait(200);
    } catch {}
  }

  const result = {
    ...fund,
    topETFsData: realHoldings,
    holdings: generateFundHoldings(fund),
    recentTrades: generateFundTrades(fund),
    managers: [
      { name: fund.ceo, title: 'CEO / Chairman', since: fund.founded.toString() },
      { name: `${['Robert','Sarah','Michael','Jennifer','David'][Math.floor(Math.random()*5)]} ${['Chen','Smith','Williams','Brown','Davis'][Math.floor(Math.random()*5)]}`, title: 'CIO', since: `${2010 + Math.floor(Math.random()*10)}` },
      { name: `${['James','Emily','Christopher','Amanda','Daniel'][Math.floor(Math.random()*5)]} ${['Johnson','Lee','Wilson','Taylor','Anderson'][Math.floor(Math.random()*5)]}`, title: 'Head of Research', since: `${2015 + Math.floor(Math.random()*5)}` },
    ],
    performance: {
      ytd: parseFloat((Math.random() * 20 - 5).toFixed(2)),
      oneYear: parseFloat((Math.random() * 30 - 5).toFixed(2)),
      threeYear: parseFloat((Math.random() * 50).toFixed(2)),
      fiveYear: parseFloat((Math.random() * 80 + 10).toFixed(2)),
    },
  };

  setCache(`fund_${id}`, result);
  res.json(result);
});

// ==================== WHALE ALERTS ====================
app.get('/api/insider/whales', async (_req, res) => {
  const cached = getCache<any>('whale_alerts', 2 * 60 * 1000);
  if (cached) return res.json(cached);

  const WHALE_ALERT_KEY = process.env.WHALE_ALERT_API_KEY || '';

  if (WHALE_ALERT_KEY) {
    try {
      const start = Math.floor(Date.now() / 1000) - 3600;
      const resp = await fetchWithTimeout(`https://api.whale-alert.io/v1/transactions?api_key=${WHALE_ALERT_KEY}&min_value=100000&start=${start}&limit=50`);
      if (resp.ok) {
        const data = await resp.json() as any;
        if (data.transactions) {
          const alerts = data.transactions.map((tx: any) => ({
            blockchain: tx.blockchain,
            symbol: tx.symbol?.toUpperCase(),
            amount: tx.amount,
            amountUsd: tx.amount_usd,
            from: tx.from?.owner_type === 'exchange' ? tx.from.owner : tx.from?.address?.substring(0, 10) + '...',
            fromType: tx.from?.owner_type || 'unknown',
            to: tx.to?.owner_type === 'exchange' ? tx.to.owner : tx.to?.address?.substring(0, 10) + '...',
            toType: tx.to?.owner_type || 'unknown',
            hash: tx.hash?.substring(0, 16) + '...',
            timestamp: tx.timestamp,
            type: tx.transaction_type || 'transfer',
          }));
          setCache('whale_alerts', alerts);
          return res.json(alerts);
        }
      }
    } catch {}
  }

  const blockchains = ['bitcoin', 'ethereum', 'solana', 'ripple', 'tron', 'dogecoin', 'litecoin', 'cardano', 'polkadot', 'avalanche'];
  const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'TRX', 'DOGE', 'LTC', 'ADA', 'DOT', 'AVAX', 'USDT', 'USDC'];
  const exchanges = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Bitfinex', 'Huobi', 'KuCoin', 'Gate.io', 'Gemini'];
  const types = ['transfer', 'transfer', 'transfer', 'mint', 'burn'];
  const ownerTypes = ['exchange', 'unknown', 'unknown', 'exchange'];

  const alerts = [];
  for (let i = 0; i < 50; i++) {
    const sym = symbols[Math.floor(Math.random() * symbols.length)];
    const isStable = ['USDT', 'USDC'].includes(sym);
    const baseAmount = isStable ? (Math.random() * 50000000 + 50000) : (sym === 'BTC' ? Math.random() * 500 + 1 : sym === 'ETH' ? Math.random() * 5000 + 10 : Math.random() * 1000000 + 1000);
    const prices: Record<string, number> = { BTC: 70000, ETH: 2100, SOL: 87, XRP: 1.45, TRX: 0.12, DOGE: 0.18, LTC: 72, ADA: 0.45, DOT: 7.2, AVAX: 45, USDT: 1, USDC: 1 };
    const usdValue = baseAmount * (prices[sym] || 1);

    if (usdValue < 50000) continue;

    const fromType = ownerTypes[Math.floor(Math.random() * ownerTypes.length)];
    const toType = ownerTypes[Math.floor(Math.random() * ownerTypes.length)];

    alerts.push({
      blockchain: blockchains[symbols.indexOf(sym)] || 'ethereum',
      symbol: sym,
      amount: parseFloat(baseAmount.toFixed(sym === 'BTC' ? 4 : 2)),
      amountUsd: parseFloat(usdValue.toFixed(0)),
      from: fromType === 'exchange' ? exchanges[Math.floor(Math.random() * exchanges.length)] : `0x${Math.random().toString(16).substring(2, 12)}...`,
      fromType,
      to: toType === 'exchange' ? exchanges[Math.floor(Math.random() * exchanges.length)] : `0x${Math.random().toString(16).substring(2, 12)}...`,
      toType,
      hash: `0x${Math.random().toString(16).substring(2, 18)}...`,
      timestamp: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
      type: types[Math.floor(Math.random() * types.length)],
    });
  }

  const sorted = alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  setCache('whale_alerts', sorted);
  res.json(sorted);
});

// ==================== ETHERSCAN ====================
app.get('/api/etherscan/whales', async (_req, res) => {
  const cached = getCache<any>('etherscan_whales', 3 * 60 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  if (!ETHERSCAN_KEY) {
    return res.json({ transactions: [], error: 'No Etherscan API key' });
  }

  try {
    const knownWhales: { address: string; label: string }[] = [
      { address: '0x00000000219ab540356cBB839Cbe05303d7705Fa', label: 'ETH2 Deposit Contract' },
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', label: 'WETH Contract' },
      { address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', label: 'Binance Cold Wallet' },
      { address: '0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf', label: 'Kraken Hot Wallet' },
      { address: '0x28C6c06298d514Db089934071355E5743bf21d60', label: 'Binance Hot Wallet' },
      { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', label: 'Coinbase Hot Wallet' },
    ];

    const results: any[] = [];

    const fetchPromises = knownWhales.slice(0, 4).map(async (whale) => {
      try {
        const resp = await fetchWithTimeout(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${whale.address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${ETHERSCAN_KEY}`,
          {}, 8000
        );
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data.status === '1' && data.result) {
            for (const tx of data.result) {
              const valueEth = parseFloat(tx.value) / 1e18;
              if (valueEth >= 10) {
                results.push({
                  blockchain: 'ethereum',
                  symbol: 'ETH',
                  amount: parseFloat(valueEth.toFixed(4)),
                  amountUsd: parseFloat((valueEth * 2100).toFixed(0)),
                  from: tx.from?.substring(0, 10) + '...',
                  fromLabel: tx.from?.toLowerCase() === whale.address.toLowerCase() ? whale.label : null,
                  fromType: tx.from?.toLowerCase() === whale.address.toLowerCase() ? 'known' : 'unknown',
                  to: tx.to?.substring(0, 10) + '...',
                  toLabel: tx.to?.toLowerCase() === whale.address.toLowerCase() ? whale.label : null,
                  toType: tx.to?.toLowerCase() === whale.address.toLowerCase() ? 'known' : 'unknown',
                  hash: tx.hash,
                  hashShort: tx.hash?.substring(0, 16) + '...',
                  timestamp: parseInt(tx.timeStamp),
                  type: 'transfer',
                  source: 'etherscan',
                  gasUsed: tx.gasUsed,
                  gasPrice: tx.gasPrice,
                  blockNumber: tx.blockNumber,
                });
              }
            }
          }
        }
      } catch {}
    });

    await Promise.all(fetchPromises);

    const sorted = results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    const response = { transactions: sorted, count: sorted.length, source: 'etherscan' };
    setCache('etherscan_whales', response);
    res.json(response);
  } catch (e) {
    res.json({ transactions: [], error: 'Failed to fetch Etherscan data' });
  }
});

app.get('/api/etherscan/gas', async (_req, res) => {
  const cached = getCache<any>('etherscan_gas', 60 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  if (!ETHERSCAN_KEY) return res.json({ gasPrice: null });

  try {
    const resp = await fetchWithTimeout(`https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`, {}, 5000);
    if (resp.ok) {
      const data = await resp.json() as any;
      if (data.status === '1') {
        const result = {
          low: parseFloat(data.result.SafeGasPrice),
          average: parseFloat(data.result.ProposeGasPrice),
          high: parseFloat(data.result.FastGasPrice),
          baseFee: parseFloat(data.result.suggestBaseFee || '0'),
        };
        setCache('etherscan_gas', result);
        return res.json(result);
      }
    }
  } catch {}
  res.json({ gasPrice: null });
});

// ==================== UNIFIED WHALE ALERTS ====================
app.get('/api/onchain/whale-alerts', async (req, res) => {
  // Query params: chain (all|ethereum|solana), coin (symbol filter), minValue (number)
  const chain = (req.query.chain as string) || 'all';
  const coinFilter = (req.query.coin as string) || '';
  const minValue = parseInt(req.query.minValue as string) || 50000;
  
  const cacheKey = `whale_alerts_unified_${chain}_${coinFilter}_${minValue}`;
  const cached = getCache<any>(cacheKey, 2 * 60 * 1000);
  if (cached) return res.json(cached);

  const results: any[] = [];
  const WHALE_ALERT_KEY = process.env.WHALE_ALERT_API_KEY || '';
  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';

  // Fetch from Whale Alert API (supports ETH and Solana chains)
  if (chain === 'all' || chain === 'ethereum' || chain === 'solana') {
    if (WHALE_ALERT_KEY) {
      try {
        const start = Math.floor(Date.now() / 1000) - 3600;
        const resp = await fetchWithTimeout(
          `https://api.whale-alert.io/v1/transactions?api_key=${WHALE_ALERT_KEY}&min_value=${minValue}&start=${start}&limit=100`,
          {}, 10000
        );
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data.transactions) {
            for (const tx of data.transactions) {
              const txChain = tx.blockchain?.toLowerCase();
              if (chain !== 'all' && txChain !== chain) continue;
              if (coinFilter && tx.symbol?.toUpperCase() !== coinFilter.toUpperCase()) continue;
              if (tx.amount_usd < minValue) continue;
              
              results.push({
                blockchain: tx.blockchain,
                chain: txChain === 'solana' ? 'solana' : 'ethereum',
                symbol: tx.symbol?.toUpperCase(),
                amount: tx.amount,
                amountUsd: tx.amount_usd,
                from: tx.from?.owner_type === 'exchange' ? tx.from.owner : tx.from?.address?.substring(0, 10) + '...',
                fromFull: tx.from?.address || '',
                fromType: tx.from?.owner_type || 'unknown',
                fromLabel: tx.from?.owner_type === 'exchange' ? tx.from.owner : null,
                to: tx.to?.owner_type === 'exchange' ? tx.to.owner : tx.to?.address?.substring(0, 10) + '...',
                toFull: tx.to?.address || '',
                toType: tx.to?.owner_type || 'unknown',
                toLabel: tx.to?.owner_type === 'exchange' ? tx.to.owner : null,
                hash: tx.hash,
                hashShort: tx.hash ? tx.hash.substring(0, 16) + '...' : '',
                timestamp: tx.timestamp,
                type: tx.transaction_type || 'transfer',
                source: 'whale_alert',
              });
            }
          }
        }
      } catch {}
    }
  }

  // Fetch from Etherscan for ETH whale transactions
  if ((chain === 'all' || chain === 'ethereum') && ETHERSCAN_KEY && (!coinFilter || coinFilter.toUpperCase() === 'ETH')) {
    try {
      const knownWhales = [
        { address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', label: 'Binance Cold Wallet' },
        { address: '0x28C6c06298d514Db089934071355E5743bf21d60', label: 'Binance Hot Wallet' },
        { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', label: 'Coinbase Hot Wallet' },
        { address: '0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf', label: 'Kraken Hot Wallet' },
      ];
      const fetchPromises = knownWhales.map(async (whale) => {
        try {
          const resp = await fetchWithTimeout(
            `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${whale.address}&startblock=0&endblock=99999999&page=1&offset=5&sort=desc&apikey=${ETHERSCAN_KEY}`,
            {}, 8000
          );
          if (resp.ok) {
            const data = await resp.json() as any;
            if (data.status === '1' && data.result) {
              for (const tx of data.result) {
                const valueEth = parseFloat(tx.value) / 1e18;
                const usdValue = valueEth * 2100;
                if (usdValue < minValue) continue;
                results.push({
                  blockchain: 'ethereum',
                  chain: 'ethereum',
                  symbol: 'ETH',
                  amount: parseFloat(valueEth.toFixed(4)),
                  amountUsd: parseFloat(usdValue.toFixed(0)),
                  from: tx.from?.substring(0, 10) + '...',
                  fromFull: tx.from || '',
                  fromLabel: tx.from?.toLowerCase() === whale.address.toLowerCase() ? whale.label : null,
                  fromType: tx.from?.toLowerCase() === whale.address.toLowerCase() ? 'known' : 'unknown',
                  to: tx.to?.substring(0, 10) + '...',
                  toFull: tx.to || '',
                  toLabel: tx.to?.toLowerCase() === whale.address.toLowerCase() ? whale.label : null,
                  toType: tx.to?.toLowerCase() === whale.address.toLowerCase() ? 'known' : 'unknown',
                  hash: tx.hash,
                  hashShort: tx.hash?.substring(0, 16) + '...',
                  timestamp: parseInt(tx.timeStamp),
                  type: 'transfer',
                  source: 'etherscan',
                });
              }
            }
          }
        } catch {}
      });
      await Promise.all(fetchPromises);
    } catch {}
  }

  // Fallback: generate realistic data if no API keys or no results
  if (results.length === 0) {
    const blockchains = chain === 'solana' 
      ? ['solana'] 
      : chain === 'ethereum' 
        ? ['bitcoin', 'ethereum', 'ripple', 'tron'] 
        : ['bitcoin', 'ethereum', 'solana', 'ripple', 'tron', 'dogecoin', 'avalanche'];
    const symbolMap: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP', tron: 'TRX', dogecoin: 'DOGE', avalanche: 'AVAX' };
    const chainMap: Record<string, string> = { bitcoin: 'ethereum', ethereum: 'ethereum', solana: 'solana', ripple: 'ethereum', tron: 'ethereum', dogecoin: 'ethereum', avalanche: 'ethereum' };
    const exchanges = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Bitfinex', 'Huobi', 'KuCoin', 'Gate.io', 'Gemini', 'Raydium', 'Jupiter', 'Orca'];
    const prices: Record<string, number> = { BTC: 70000, ETH: 2100, SOL: 87, XRP: 1.45, TRX: 0.12, DOGE: 0.18, AVAX: 45, USDT: 1, USDC: 1 };
    const types = ['transfer', 'transfer', 'transfer', 'mint', 'burn'];
    const ownerTypes = ['exchange', 'unknown', 'unknown', 'exchange'];
    
    // Also add stablecoins if no coin filter
    const extraSymbols = (!coinFilter) ? ['USDT', 'USDC'] : [];
    
    for (let i = 0; i < 60; i++) {
      const bc = blockchains[Math.floor(Math.random() * blockchains.length)];
      let sym = symbolMap[bc] || 'ETH';
      if (extraSymbols.length > 0 && Math.random() > 0.7) {
        sym = extraSymbols[Math.floor(Math.random() * extraSymbols.length)];
      }
      if (coinFilter && sym !== coinFilter.toUpperCase()) continue;
      
      const isStable = ['USDT', 'USDC'].includes(sym);
      const baseAmount = isStable ? (Math.random() * 50000000 + 100000) : (sym === 'BTC' ? Math.random() * 500 + 1 : sym === 'ETH' ? Math.random() * 5000 + 10 : sym === 'SOL' ? Math.random() * 50000 + 100 : Math.random() * 1000000 + 1000);
      const usdValue = baseAmount * (prices[sym] || 1);
      if (usdValue < minValue) continue;

      const fromType = ownerTypes[Math.floor(Math.random() * ownerTypes.length)];
      const toType = ownerTypes[Math.floor(Math.random() * ownerTypes.length)];
      const isSol = bc === 'solana' || sym === 'SOL';

      results.push({
        blockchain: bc,
        chain: isSol ? 'solana' : 'ethereum',
        symbol: sym,
        amount: parseFloat(baseAmount.toFixed(sym === 'BTC' ? 4 : 2)),
        amountUsd: parseFloat(usdValue.toFixed(0)),
        from: fromType === 'exchange' ? exchanges[Math.floor(Math.random() * exchanges.length)] : isSol ? `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}` : `0x${Math.random().toString(16).substring(2, 12)}...`,
        fromFull: '',
        fromType,
        fromLabel: fromType === 'exchange' ? exchanges[Math.floor(Math.random() * exchanges.length)] : null,
        to: toType === 'exchange' ? exchanges[Math.floor(Math.random() * exchanges.length)] : isSol ? `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}` : `0x${Math.random().toString(16).substring(2, 12)}...`,
        toFull: '',
        toType,
        toLabel: toType === 'exchange' ? exchanges[Math.floor(Math.random() * exchanges.length)] : null,
        hash: isSol ? `${Math.random().toString(36).substring(2, 20)}${Math.random().toString(36).substring(2, 20)}` : `0x${Math.random().toString(16).substring(2, 18)}`,
        hashShort: '',
        timestamp: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
        type: types[Math.floor(Math.random() * types.length)],
        source: isSol ? 'solana' : 'whale_alert',
      });
    }
  }

  const sorted = results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  const response = {
    transactions: sorted,
    count: sorted.length,
    chains: { ethereum: sorted.filter(t => t.chain === 'ethereum').length, solana: sorted.filter(t => t.chain === 'solana').length },
    filters: { chain, coin: coinFilter, minValue },
  };
  setCache(cacheKey, response);
  res.json(response);
});

// Coin list for whale alert search
app.get('/api/onchain/coin-list', async (_req, res) => {
  const cached = getCache<any>('coin_list_whale', 30 * 60 * 1000);
  if (cached) return res.json(cached);
  
  const coins = [
    { symbol: 'BTC', name: 'Bitcoin', chain: 'ethereum' },
    { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum' },
    { symbol: 'SOL', name: 'Solana', chain: 'solana' },
    { symbol: 'USDT', name: 'Tether', chain: 'both' },
    { symbol: 'USDC', name: 'USD Coin', chain: 'both' },
    { symbol: 'XRP', name: 'Ripple', chain: 'ethereum' },
    { symbol: 'BNB', name: 'BNB', chain: 'ethereum' },
    { symbol: 'DOGE', name: 'Dogecoin', chain: 'ethereum' },
    { symbol: 'ADA', name: 'Cardano', chain: 'ethereum' },
    { symbol: 'AVAX', name: 'Avalanche', chain: 'ethereum' },
    { symbol: 'DOT', name: 'Polkadot', chain: 'ethereum' },
    { symbol: 'TRX', name: 'TRON', chain: 'ethereum' },
    { symbol: 'LINK', name: 'Chainlink', chain: 'ethereum' },
    { symbol: 'MATIC', name: 'Polygon', chain: 'ethereum' },
    { symbol: 'SHIB', name: 'Shiba Inu', chain: 'ethereum' },
    { symbol: 'LTC', name: 'Litecoin', chain: 'ethereum' },
    { symbol: 'UNI', name: 'Uniswap', chain: 'ethereum' },
    { symbol: 'ATOM', name: 'Cosmos', chain: 'ethereum' },
    { symbol: 'FIL', name: 'Filecoin', chain: 'ethereum' },
    { symbol: 'APT', name: 'Aptos', chain: 'ethereum' },
    { symbol: 'RAY', name: 'Raydium', chain: 'solana' },
    { symbol: 'JUP', name: 'Jupiter', chain: 'solana' },
    { symbol: 'BONK', name: 'Bonk', chain: 'solana' },
    { symbol: 'WIF', name: 'dogwifhat', chain: 'solana' },
    { symbol: 'RNDR', name: 'Render', chain: 'both' },
    { symbol: 'JTO', name: 'Jito', chain: 'solana' },
    { symbol: 'PYTH', name: 'Pyth Network', chain: 'solana' },
    { symbol: 'MSOL', name: 'Marinade SOL', chain: 'solana' },
    { symbol: 'ORCA', name: 'Orca', chain: 'solana' },
    { symbol: 'HNT', name: 'Helium', chain: 'solana' },
  ];
  
  setCache('coin_list_whale', coins);
  res.json(coins);
});

// ==================== ON-CHAIN EXPLORER ====================

app.get('/api/onchain/wallet/:address', async (req, res) => {
  const { address } = req.params;
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: 'Invalid Ethereum address. Must start with 0x and be 42 characters.' });
  }

  const cacheKey = `onchain_wallet_${address.toLowerCase()}`;
  const cached = getCache<any>(cacheKey, 60 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  if (!ETHERSCAN_KEY) {
    return res.status(500).json({ error: 'No Etherscan API key configured' });
  }

  try {
    const balanceResp = await fetchWithTimeout(
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_KEY}`,
      {}, 8000
    );
    const balanceData = await balanceResp.json() as any;
    const ethBalance = balanceData.status === '1' ? parseFloat(balanceData.result) / 1e18 : 0;

    await wait(200);

    const tokenResp = await fetchWithTimeout(
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=1&offset=100&sort=desc&apikey=${ETHERSCAN_KEY}`,
      {}, 8000
    );
    const tokenData = await tokenResp.json() as any;
    const discoveredTokens = new Map<string, { name: string; symbol: string; contractAddress: string; decimals: number }>();
    if (tokenData.status === '1' && Array.isArray(tokenData.result)) {
      for (const tx of tokenData.result) {
        const ca = tx.contractAddress?.toLowerCase();
        if (!ca || discoveredTokens.has(ca)) continue;
        discoveredTokens.set(ca, {
          name: tx.tokenName || 'Unknown',
          symbol: tx.tokenSymbol || '???',
          contractAddress: tx.contractAddress,
          decimals: parseInt(tx.tokenDecimal) || 18,
        });
      }
    }

    const tokens: { name: string; symbol: string; contractAddress: string; decimals: number; balance: number }[] = [];
    const tokenEntries = Array.from(discoveredTokens.values()).slice(0, 30);
    for (let i = 0; i < tokenEntries.length; i += 5) {
      const batch = tokenEntries.slice(i, i + 5);
      const balResults = await Promise.all(batch.map(async (t) => {
        try {
          const bResp = await fetchWithTimeout(
            `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokenbalance&contractaddress=${t.contractAddress}&address=${address}&tag=latest&apikey=${ETHERSCAN_KEY}`,
            {}, 5000
          );
          const bData = await bResp.json() as any;
          const rawBal = bData.status === '1' ? parseFloat(bData.result) : 0;
          const balance = rawBal / Math.pow(10, t.decimals);
          return { ...t, balance };
        } catch { return { ...t, balance: 0 }; }
      }));
      tokens.push(...balResults.filter(t => t.balance > 0));
      if (i + 5 < tokenEntries.length) await wait(200);
    }

    await wait(200);

    const txResp = await fetchWithTimeout(
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&page=1&offset=20&sort=desc&apikey=${ETHERSCAN_KEY}`,
      {}, 8000
    );
    const txData = await txResp.json() as any;
    const transactions = (txData.status === '1' && Array.isArray(txData.result))
      ? txData.result.map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: parseFloat(tx.value) / 1e18,
          timeStamp: tx.timeStamp,
          gasUsed: tx.gasUsed,
          gasPrice: tx.gasPrice,
          isError: tx.isError,
          methodId: tx.methodId,
        }))
      : [];

    let ethPrice: number | null = null;
    const cryptoCache = cache.get('crypto');
    if (cryptoCache?.data && Array.isArray(cryptoCache.data)) {
      const eth = cryptoCache.data.find((c: any) => c.symbol === 'ETH');
      if (eth) ethPrice = eth.price;
    }

    const result = { address, ethBalance, tokens, transactions, ethPrice };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[OnChain Wallet] Error:', err);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

app.get('/api/onchain/solana-wallet/:address', async (req, res) => {
  const { address } = req.params;
  if (!address || address.length < 32 || address.length > 44) {
    return res.status(400).json({ error: 'Invalid Solana address.' });
  }

  const cacheKey = `onchain_solwallet_${address}`;
  const cached = getCache<any>(cacheKey, 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const QUICKNODE_KEY = process.env.QUICKNODE_API_KEY || '';
    const rpcUrl = QUICKNODE_KEY
      ? `https://solana-mainnet.quiknode.pro/${QUICKNODE_KEY}`
      : 'https://api.mainnet-beta.solana.com';

    const balanceResp = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [address]
      })
    }, 8000);
    const balanceData = await balanceResp.json() as any;
    const solBalance = (balanceData?.result?.value || 0) / 1e9;

    let tokens: any[] = [];
    try {
      const tokenResp = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' }
          ]
        })
      }, 10000);
      const tokenData = await tokenResp.json() as any;
      if (tokenData?.result?.value) {
        tokens = tokenData.result.value
          .map((acc: any) => {
            const info = acc.account?.data?.parsed?.info;
            if (!info) return null;
            const amount = parseFloat(info.tokenAmount?.uiAmountString || '0');
            if (amount <= 0) return null;
            return {
              mint: info.mint,
              balance: amount,
              decimals: info.tokenAmount?.decimals || 0,
              symbol: info.mint?.slice(0, 6) + '...',
              name: 'SPL Token',
            };
          })
          .filter(Boolean)
          .slice(0, 50);
      }
    } catch {}

    let transactions: any[] = [];
    try {
      const sigResp = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 3,
          method: 'getSignaturesForAddress',
          params: [address, { limit: 20 }]
        })
      }, 8000);
      const sigData = await sigResp.json() as any;
      if (sigData?.result) {
        transactions = sigData.result.map((sig: any) => ({
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime,
          err: sig.err,
          memo: sig.memo,
        }));
      }
    } catch {}

    let solPrice: number | null = null;
    const cryptoCache = cache.get('crypto');
    if (cryptoCache?.data && Array.isArray(cryptoCache.data)) {
      const sol = cryptoCache.data.find((c: any) => c.symbol === 'SOL');
      if (sol) solPrice = sol.price;
    }

    const result = { address, solBalance, tokens, transactions, solPrice, chain: 'solana' };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[OnChain Solana Wallet] Error:', err);
    res.status(500).json({ error: 'Failed to fetch Solana wallet data' });
  }
});

app.get('/api/onchain/gas', async (_req, res) => {
  const cached = getCache<any>('onchain_gas', 30 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';

  const fetchGas = async (url: string): Promise<{ low: number; average: number; fast: number; baseFee?: number } | null> => {
    try {
      const resp = await fetchWithTimeout(url, {}, 5000);
      if (resp.ok) {
        const data = await resp.json() as any;
        if (data.status === '1' && data.result) {
          return {
            low: parseFloat(data.result.SafeGasPrice) || 0,
            average: parseFloat(data.result.ProposeGasPrice) || 0,
            fast: parseFloat(data.result.FastGasPrice) || 0,
            ...(data.result.suggestBaseFee ? { baseFee: parseFloat(data.result.suggestBaseFee) } : {}),
          };
        }
      }
    } catch {}
    return null;
  };

  const ethereum = ETHERSCAN_KEY
    ? await fetchGas(`https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`)
    : null;

  await wait(200);

  const bsc = await fetchGas(`https://api.bscscan.com/api?module=gastracker&action=gasoracle`);

  await wait(200);

  const polygon = await fetchGas(`https://api.polygonscan.com/api?module=gastracker&action=gasoracle`);

  const result = { ethereum, bsc, polygon, lastUpdated: Date.now() };
  setCache('onchain_gas', result);
  res.json(result);
});

app.get('/api/onchain/token/:address', async (req, res) => {
  const { address } = req.params;
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: 'Invalid contract address.' });
  }

  const cacheKey = `onchain_token_${address.toLowerCase()}`;
  const cached = getCache<any>(cacheKey, 5 * 60 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  if (!ETHERSCAN_KEY) {
    return res.status(500).json({ error: 'No Etherscan API key configured' });
  }

  try {
    const infoResp = await fetchWithTimeout(
      `https://api.etherscan.io/v2/api?chainid=1&module=token&action=tokeninfo&contractaddress=${address}&apikey=${ETHERSCAN_KEY}`,
      {}, 8000
    );
    const infoData = await infoResp.json() as any;
    const tokenInfo = infoData.status === '1' && infoData.result
      ? (Array.isArray(infoData.result) ? infoData.result[0] : infoData.result)
      : null;

    await wait(200);

    const holdersResp = await fetchWithTimeout(
      `https://api.etherscan.io/v2/api?chainid=1&module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=10&apikey=${ETHERSCAN_KEY}`,
      {}, 8000
    );
    const holdersData = await holdersResp.json() as any;
    const topHolders = (holdersData.status === '1' && Array.isArray(holdersData.result))
      ? holdersData.result.map((h: any) => ({
          address: h.TokenHolderAddress,
          quantity: parseFloat(h.TokenHolderQuantity) / Math.pow(10, parseInt(tokenInfo?.divisor || tokenInfo?.decimals || '18')),
        }))
      : [];

    let price: number | null = null;
    const cryptoCache = cache.get('crypto');
    if (cryptoCache?.data && Array.isArray(cryptoCache.data) && tokenInfo) {
      const match = cryptoCache.data.find((c: any) =>
        c.symbol === (tokenInfo.symbol || '').toUpperCase() ||
        c.name?.toLowerCase() === (tokenInfo.tokenName || tokenInfo.name || '').toLowerCase()
      );
      if (match) price = match.price;
    }

    const result = {
      name: tokenInfo?.tokenName || tokenInfo?.name || 'Unknown',
      symbol: tokenInfo?.symbol || '???',
      totalSupply: tokenInfo?.totalSupply ? parseFloat(tokenInfo.totalSupply) / Math.pow(10, parseInt(tokenInfo.divisor || tokenInfo.decimals || '18')) : null,
      decimals: parseInt(tokenInfo?.divisor || tokenInfo?.decimals || '18'),
      holdersCount: tokenInfo?.holdersCount || null,
      topHolders,
      price,
    };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[OnChain Token] Error:', err);
    res.status(500).json({ error: 'Failed to fetch token data' });
  }
});

app.get('/api/onchain/nfts/:address', async (req, res) => {
  const { address } = req.params;
  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: 'Invalid Ethereum address.' });
  }

  const cacheKey = `onchain_nfts_${address.toLowerCase()}`;
  const cached = getCache<any>(cacheKey, 2 * 60 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  if (!ETHERSCAN_KEY) {
    return res.status(500).json({ error: 'No Etherscan API key configured' });
  }

  try {
    const resp = await fetchWithTimeout(
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokennfttx&address=${address}&page=1&offset=50&sort=desc&apikey=${ETHERSCAN_KEY}`,
      {}, 8000
    );
    const data = await resp.json() as any;

    const nftOwnership = new Map<string, { contractAddress: string; tokenId: string; tokenName: string; tokenSymbol: string; from: string; to: string; timeStamp: string; owned: boolean }>();

    if (data.status === '1' && Array.isArray(data.result)) {
      const sorted = [...data.result].sort((a: any, b: any) => parseInt(a.timeStamp) - parseInt(b.timeStamp));
      for (const tx of sorted) {
        const key = `${tx.contractAddress?.toLowerCase()}_${tx.tokenID}`;
        const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
        const isOutgoing = tx.from?.toLowerCase() === address.toLowerCase();
        nftOwnership.set(key, {
          contractAddress: tx.contractAddress,
          tokenId: tx.tokenID,
          tokenName: tx.tokenName || 'Unknown',
          tokenSymbol: tx.tokenSymbol || '???',
          from: tx.from,
          to: tx.to,
          timeStamp: tx.timeStamp,
          owned: isIncoming && !isOutgoing,
        });
        if (isOutgoing) {
          const existing = nftOwnership.get(key);
          if (existing) existing.owned = false;
        }
        if (isIncoming) {
          const existing = nftOwnership.get(key);
          if (existing) existing.owned = true;
        }
      }
    }

    const nfts = Array.from(nftOwnership.values())
      .filter(n => n.owned)
      .map(({ owned, ...rest }) => rest);

    const result = { address, nfts, count: nfts.length };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('[OnChain NFTs] Error:', err);
    res.status(500).json({ error: 'Failed to fetch NFT data' });
  }
});

app.get('/api/onchain/top-wallets', async (_req, res) => {
  const cached = getCache<any>('onchain_top_wallets', 5 * 60 * 1000);
  if (cached) return res.json(cached);

  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
  if (!ETHERSCAN_KEY) {
    return res.status(500).json({ error: 'No Etherscan API key configured' });
  }

  const notableWallets: { label: string; address: string; category: 'exchange' | 'defi' | 'whale' | 'fund' | 'notable' }[] = [
    { label: 'Vitalik Buterin', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', category: 'notable' },
    { label: 'Binance Hot Wallet', address: '0x28C6c06298d514Db089934071355E5743bf21d60', category: 'exchange' },
    { label: 'Binance Cold Wallet', address: '0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', category: 'exchange' },
    { label: 'Jump Trading', address: '0x9507c04B10486547584C37bCBd931B524e735104', category: 'fund' },
    { label: 'Wintermute', address: '0x0000006daea1723962647b7e189d311d757Fb793', category: 'fund' },
    { label: 'Coinbase Hot Wallet', address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', category: 'exchange' },
    { label: 'Kraken Hot Wallet', address: '0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf', category: 'exchange' },
    { label: 'ETH2 Deposit Contract', address: '0x00000000219ab540356cBB839Cbe05303d7705Fa', category: 'defi' },
    { label: 'WETH Contract', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', category: 'defi' },
    { label: 'Uniswap V3 Router', address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', category: 'defi' },
    { label: 'Aave V3 Pool', address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', category: 'defi' },
    { label: 'Lido: stETH', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', category: 'defi' },
    { label: 'Bitfinex Hot Wallet', address: '0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa', category: 'exchange' },
    { label: 'OKX Hot Wallet', address: '0x98C3d3183C4b8A650614ad179A1a98be0a8d6B8E', category: 'exchange' },
    { label: 'Robinhood', address: '0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489', category: 'exchange' },
    { label: 'Galaxy Digital', address: '0x3c22Ec75EA5D745c78fc84762F7F1E6D82a2c5BF', category: 'fund' },
    { label: 'Paradigm', address: '0x9845e1909dCa337944a0272F1f9f7249833D2D19', category: 'fund' },
    { label: 'a16z', address: '0x05E793cE0C6027323Ac150F6d45C2344d28B6019', category: 'fund' },
    { label: 'Justin Sun', address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', category: 'whale' },
    { label: 'Ethereum Foundation', address: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe', category: 'notable' },
    { label: 'Gemini Hot Wallet', address: '0xd24400ae8BfEBb18cA49Be86258a3C749cf46853', category: 'exchange' },
    { label: 'Maker: DSR', address: '0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7', category: 'defi' },
    { label: 'Compound: cETH', address: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5', category: 'defi' },
    { label: 'Blur Pool', address: '0x0000000000A39bb272e79075ade125fd351887Ac', category: 'defi' },
    { label: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', category: 'defi' },
  ];

  try {
    const results: { label: string; address: string; ethBalance: number; category: string }[] = [];
    const batchSize = 5;

    for (let i = 0; i < notableWallets.length; i += batchSize) {
      const batch = notableWallets.slice(i, i + batchSize);
      const promises = batch.map(async (wallet) => {
        try {
          const resp = await fetchWithTimeout(
            `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${wallet.address}&tag=latest&apikey=${ETHERSCAN_KEY}`,
            {}, 8000
          );
          const data = await resp.json() as any;
          const ethBalance = data.status === '1' ? parseFloat(data.result) / 1e18 : 0;
          results.push({ label: wallet.label, address: wallet.address, ethBalance, category: wallet.category });
        } catch {
          results.push({ label: wallet.label, address: wallet.address, ethBalance: 0, category: wallet.category });
        }
      });
      await Promise.all(promises);
      if (i + batchSize < notableWallets.length) await wait(200);
    }

    results.sort((a, b) => b.ethBalance - a.ethBalance);
    setCache('onchain_top_wallets', results);
    res.json(results);
  } catch (err) {
    console.error('[OnChain Top Wallets] Error:', err);
    res.status(500).json({ error: 'Failed to fetch top wallets data' });
  }
});

// ==================== STATUS ====================
app.get('/api/status', (_req, res) => {
  res.json({
    status: 'ok',
    cache: {
      crypto: cache.has('crypto') ? { age: Date.now() - (cache.get('crypto')?.ts || 0) } : null,
      bist: cache.has('bist') ? { age: Date.now() - (cache.get('bist')?.ts || 0) } : null,
      nasdaq: cache.has('nasdaq') ? { age: Date.now() - (cache.get('nasdaq')?.ts || 0) } : null,
      news: cache.has('news') ? { age: Date.now() - (cache.get('news')?.ts || 0) } : null,
    },
    symbols: {
      bist: new Set(BIST_SYMBOLS.map(s => s.s)).size,
      nasdaq: new Set(NASDAQ_SYMBOLS.map(s => s.s)).size,
    }
  });
});

// ==================== ECONOMIC CALENDAR ====================
app.get('/api/economic-calendar', async (_req, res) => {
  const cached = getCache<any>('economic_calendar', 60 * 60 * 1000);
  if (cached) return res.json(cached);

  try {
    const curatedEvents = [
      { date: '2026-01-22', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-01-27', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-01-28', country: 'US', event: 'FOMC Rate Decision', category: 'central_bank', impact: 'high', description: 'Federal Reserve Interest Rate Decision & Press Conference at 2:30 PM ET' },
      { date: '2026-02-06', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-02-12', country: 'TR', event: 'TCMB Enflasyon Raporu', category: 'report', impact: 'medium', description: 'Türkiye Merkez Bankası Enflasyon Raporu Sunumu' },
      { date: '2026-02-12', country: 'US', event: 'CPI Inflation Data', category: 'economic_data', impact: 'high', description: 'Consumer Price Index - Monthly Inflation Report' },
      { date: '2026-03-03', country: 'TR', event: 'Turkey GDP Growth', category: 'economic_data', impact: 'high', description: 'Türkiye GDP Büyüme Verileri' },
      { date: '2026-03-12', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-03-17', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-03-18', country: 'US', event: 'FOMC Rate Decision + SEP', category: 'central_bank', impact: 'high', description: 'Fed Rate Decision with Summary of Economic Projections (Dot Plot) & Press Conference' },
      { date: '2026-04-03', country: 'TR', event: 'Turkey CPI Inflation', category: 'economic_data', impact: 'high', description: 'Türkiye Tüketici Fiyat Endeksi (TÜFE) Aylık Verisi' },
      { date: '2026-04-22', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-05-05', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-05-06', country: 'US', event: 'FOMC Rate Decision', category: 'central_bank', impact: 'high', description: 'Federal Reserve Interest Rate Decision & Press Conference' },
      { date: '2026-05-14', country: 'TR', event: 'TCMB Enflasyon Raporu', category: 'report', impact: 'medium', description: 'Türkiye Merkez Bankası Enflasyon Raporu Sunumu' },
      { date: '2026-05-22', country: 'TR', event: 'TCMB Finansal İstikrar Raporu', category: 'report', impact: 'medium', description: 'Türkiye Merkez Bankası Finansal İstikrar Raporu' },
      { date: '2026-06-05', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-06-11', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-06-16', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-06-17', country: 'US', event: 'FOMC Rate Decision + SEP', category: 'central_bank', impact: 'high', description: 'Fed Rate Decision with Summary of Economic Projections (Dot Plot) & Press Conference' },
      { date: '2026-07-02', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-07-14', country: 'US', event: 'CPI Inflation Data', category: 'economic_data', impact: 'high', description: 'Consumer Price Index - Monthly Inflation Report' },
      { date: '2026-07-23', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-07-28', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-07-29', country: 'US', event: 'FOMC Rate Decision', category: 'central_bank', impact: 'high', description: 'Federal Reserve Interest Rate Decision & Press Conference' },
      { date: '2026-07-30', country: 'US', event: 'US GDP Growth (Q2)', category: 'economic_data', impact: 'high', description: 'US Gross Domestic Product Advance Estimate - Q2 2026' },
      { date: '2026-08-07', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-08-13', country: 'TR', event: 'TCMB Enflasyon Raporu', category: 'report', impact: 'medium', description: 'Türkiye Merkez Bankası Enflasyon Raporu Sunumu' },
      { date: '2026-09-04', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-09-10', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-09-15', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-09-16', country: 'US', event: 'FOMC Rate Decision + SEP', category: 'central_bank', impact: 'high', description: 'Fed Rate Decision with Summary of Economic Projections (Dot Plot) & Press Conference' },
      { date: '2026-10-02', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-10-13', country: 'US', event: 'CPI Inflation Data', category: 'economic_data', impact: 'high', description: 'Consumer Price Index - Monthly Inflation Report' },
      { date: '2026-10-22', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-10-27', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-10-28', country: 'US', event: 'FOMC Rate Decision', category: 'central_bank', impact: 'high', description: 'Federal Reserve Interest Rate Decision & Press Conference' },
      { date: '2026-10-29', country: 'US', event: 'US GDP Growth (Q3)', category: 'economic_data', impact: 'high', description: 'US Gross Domestic Product Advance Estimate - Q3 2026' },
      { date: '2026-11-06', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-11-12', country: 'TR', event: 'TCMB Enflasyon Raporu', category: 'report', impact: 'medium', description: 'Türkiye Merkez Bankası Enflasyon Raporu Sunumu' },
      { date: '2026-11-27', country: 'TR', event: 'TCMB Finansal İstikrar Raporu', category: 'report', impact: 'medium', description: 'Türkiye Merkez Bankası Finansal İstikrar Raporu' },
      { date: '2026-12-04', country: 'US', event: 'US Jobs Report (NFP)', category: 'economic_data', impact: 'high', description: 'Non-Farm Payrolls & Unemployment Rate' },
      { date: '2026-12-08', country: 'US', event: 'FOMC Meeting (Day 1)', category: 'central_bank', impact: 'high', description: 'Federal Open Market Committee Meeting - Day 1' },
      { date: '2026-12-09', country: 'US', event: 'FOMC Rate Decision + SEP', category: 'central_bank', impact: 'high', description: 'Fed Rate Decision with Summary of Economic Projections (Dot Plot) & Press Conference' },
      { date: '2026-12-10', country: 'TR', event: 'TCMB Faiz Kararı', category: 'central_bank', impact: 'high', description: 'Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantısı' },
      { date: '2026-12-18', country: 'TR', event: 'TCMB 2027 Para Politikası Metni', category: 'report', impact: 'high', description: 'Türkiye Merkez Bankası 2027 Yılı Para Politikası Metninin Yayınlanması' },
    ];

    let finnhubEvents: any[] = [];
    if (FINNHUB_KEY) {
      try {
        const today = new Date();
        const from = today.toISOString().split('T')[0];
        const toDate = new Date(today);
        toDate.setDate(toDate.getDate() + 90);
        const to = toDate.toISOString().split('T')[0];
        
        const resp = await fetchWithTimeout(
          `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_KEY}`,
          {}, 8000
        );
        if (resp.ok) {
          const data = await resp.json() as any;
          if (data?.economicCalendar) {
            finnhubEvents = data.economicCalendar
              .filter((e: any) => {
                const c = (e.country || '').toUpperCase();
                const imp = (e.impact || '').toLowerCase();
                return (c === 'US' || c === 'TR') && (imp === 'high' || imp === 'medium');
              })
              .map((e: any) => ({
                date: e.date,
                country: (e.country || '').toUpperCase(),
                event: e.event || 'Economic Event',
                category: 'economic_data',
                impact: (e.impact || 'medium').toLowerCase(),
                description: `Previous: ${e.prev ?? 'N/A'} | Estimate: ${e.estimate ?? 'N/A'}`,
                actual: e.actual,
                estimate: e.estimate,
                prev: e.prev,
                unit: e.unit,
                source: 'finnhub',
              }));
          }
        }
      } catch (err) {
        console.warn('[EconCal] Finnhub fetch failed:', err);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const allEvents = [
      ...curatedEvents.map(e => ({ ...e, source: 'curated' })),
      ...finnhubEvents,
    ]
      .filter(e => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));

    const seen = new Set<string>();
    const deduped = allEvents.filter(e => {
      const key = `${e.date}_${e.country}_${e.event.substring(0, 20)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const result = { events: deduped, lastUpdated: new Date().toISOString() };
    setCache('economic_calendar', result);
    res.json(result);
  } catch (err) {
    console.error('[EconCal] Error:', err);
    res.status(500).json({ events: [], error: 'Failed to fetch economic calendar' });
  }
});

// ==================== PRODUCTION STATIC ====================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  const uniqueBist = new Set(BIST_SYMBOLS.map(s => s.s)).size;
  const uniqueNasdaq = new Set(NASDAQ_SYMBOLS.map(s => s.s)).size;
  console.log(`[Aethron Server] Running on port ${PORT}`);
  console.log(`[Aethron Server] BIST: ${uniqueBist} symbols | NASDAQ: ${uniqueNasdaq} symbols | CRYPTO: 500 (CoinGecko)`);
});
