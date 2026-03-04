import { Router } from 'express';
import yahooFinance from 'yahoo-finance2';
import { getApiKey } from '../apiKeys.js';
import { NASDAQ_SYMBOLS } from '../data/nasdaqSymbols.js';
import { BIST_SYMBOLS } from '../data/bistSymbols.js';

const router = Router();

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

const generateIntradayCurve = (current: number, high: number, low: number) => {
  const points = 48;
  const data: { time: string; value: number }[] = [];
  const now = new Date();
  let virtualPrice = (high + low) / 2;
  for (let i = 0; i < points; i++) {
    const date = new Date(now);
    date.setMinutes(date.getMinutes() - (points - i) * 30);
    const change = (Math.random() - 0.5) * (high - low) * 0.2;
    virtualPrice += change;
    if (virtualPrice > high) virtualPrice = high;
    if (virtualPrice < low) virtualPrice = low;
    if (i === points - 1) virtualPrice = current;
    data.push({
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: virtualPrice,
    });
  }
  return data;
};

router.get('/crypto', async (req, res) => {
  try {
    const CG_KEY = await getApiKey('COINGECKO');
    const requestedPage = parseInt(req.query.page as string) || 0;
    const perPage = Math.min(parseInt(req.query.per_page as string) || 250, 250);

    if (requestedPage > 0) {
      const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
      url.searchParams.set('vs_currency', 'usd');
      url.searchParams.set('order', 'market_cap_desc');
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(requestedPage));
      url.searchParams.set('sparkline', 'true');
      url.searchParams.set('price_change_percentage', '24h,7d');
      if (CG_KEY) url.searchParams.set('x_cg_demo_api_key', CG_KEY);
      const cgRes = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!cgRes.ok) throw new Error(`CoinGecko ${cgRes.status}`);
      const coins = await cgRes.json();
      return res.json(mapCoins(coins));
    }

    const pages = [1, 2, 3, 4];
    const results = await Promise.allSettled(
      pages.map(async (page) => {
        const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
        url.searchParams.set('vs_currency', 'usd');
        url.searchParams.set('order', 'market_cap_desc');
        url.searchParams.set('per_page', '250');
        url.searchParams.set('page', String(page));
        url.searchParams.set('sparkline', 'true');
        url.searchParams.set('price_change_percentage', '24h,7d');
        if (CG_KEY) url.searchParams.set('x_cg_demo_api_key', CG_KEY);
        const cgRes = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        if (!cgRes.ok) throw new Error(`CoinGecko page ${page}: ${cgRes.status}`);
        return cgRes.json();
      })
    );

    const allCoins: any[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) allCoins.push(...r.value);
    });

    const mapped = mapCoins(allCoins);
    if (mapped.length > 0) setCache('crypto', mapped);
    res.json(mapped);
  } catch (err) {
    console.error('[crypto]', err);
    const cached = getCached('crypto');
    res.json(cached || []);
  }
});

function mapCoins(coins: any[]) {
  return (coins || []).map((c: any) => {
    const price = c.current_price || 0;
    const high = c.high_24h || price * 1.02;
    const low = c.low_24h || price * 0.98;
    return {
      symbol: c.symbol?.toUpperCase() || '',
      name: c.name || '',
      price,
      change: c.price_change_24h || 0,
      changePercent: c.price_change_percentage_24h || 0,
      changePercent7d: c.price_change_percentage_7d_in_currency || 0,
      volume: c.total_volume ? `$${(c.total_volume / 1e9).toFixed(1)}B` : '-',
      volumeRaw: c.total_volume || 0,
      marketCap: c.market_cap ? `$${(c.market_cap / 1e9).toFixed(0)}B` : '-',
      marketCapRaw: c.market_cap || 0,
      sector: 'Crypto',
      market: 'CRYPTO',
      dayHigh: high,
      dayLow: low,
      logo: c.image || `https://assets.coincap.io/assets/icons/${(c.symbol || '').toLowerCase()}@2x.png`,
      sparkline: c.sparkline_in_7d?.price || [],
      rank: c.market_cap_rank || 0,
      ath: c.ath || 0,
      athChangePercentage: c.ath_change_percentage || 0,
      circulatingSupply: c.circulating_supply || 0,
      totalSupply: c.total_supply || 0,
      data: generateIntradayCurve(price, high, low),
    };
  });
}


async function fetchQuotes(symbols: string[]) {
  const results: any[] = [];
  const batchSize = 100;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    try {
      const quotes = await yahooFinance.quote(batch);
      if (Array.isArray(quotes)) {
        results.push(...quotes.filter(Boolean));
      } else if (quotes) {
        results.push(quotes);
      }
    } catch (err) {
      console.warn(`[fetchQuotes] batch ${i}-${i + batchSize} failed, trying individually`);
      const fallbackPromises = batch.map(async (sym) => {
        try {
          const q = await yahooFinance.quote(sym);
          return q || null;
        } catch { return null; }
      });
      const fallbackResults = await Promise.all(fallbackPromises);
      results.push(...fallbackResults.filter(Boolean));
    }
  }
  return results;
}

const nasdaqLookup = new Map(NASDAQ_SYMBOLS.map((s) => [s.yahoo, s.name]));

router.get('/nasdaq', async (_req, res) => {
  try {
    const cached = getCached('nasdaq');
    if (cached) return res.json(cached);

    console.log(`[nasdaq] Fetching ${NASDAQ_SYMBOLS.length} symbols...`);
    const quotes = await fetchQuotes(NASDAQ_SYMBOLS.map((s) => s.yahoo));
    console.log(`[nasdaq] Got ${quotes.length} quotes`);
    const stocks = quotes.map((q: any) => {
      const price = q.regularMarketPrice || 0;
      const change = q.regularMarketChange || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const high = q.regularMarketDayHigh || price * 1.02;
      const low = q.regularMarketDayLow || price * 0.98;
      return {
        symbol: q.symbol,
        name: nasdaqLookup.get(q.symbol) || q.shortName || '',
        price,
        change,
        changePercent: changePct,
        volume: q.regularMarketVolume ? `${(q.regularMarketVolume / 1e6).toFixed(0)}M` : '-',
        marketCap: q.marketCap ? `$${(q.marketCap / 1e12).toFixed(2)}T` : '-',
        sector: 'US Market',
        market: 'NASDAQ',
        dayHigh: high,
        dayLow: low,
        logo: `https://assets.parqet.com/logos/symbol/${q.symbol}?format=png`,
        data: generateIntradayCurve(price, high, low),
      };
    });
    if (stocks.length > 0) setCache('nasdaq', stocks);
    res.json(stocks);
  } catch (err) {
    console.error('[nasdaq]', err);
    const cached = getCached('nasdaq');
    res.json(cached || []);
  }
});

const bistLookup = new Map(BIST_SYMBOLS.map((s) => [s.yahoo, { symbol: s.symbol, name: s.name }]));

router.get('/bist', async (_req, res) => {
  try {
    const cached = getCached('bist');
    if (cached) return res.json(cached);

    console.log(`[bist] Fetching ${BIST_SYMBOLS.length} symbols...`);
    const quotes = await fetchQuotes(BIST_SYMBOLS.map((s) => s.yahoo));
    console.log(`[bist] Got ${quotes.length} quotes`);
    const stocks = quotes.map((q: any) => {
      const meta = bistLookup.get(q.symbol);
      const price = q.regularMarketPrice || 0;
      const change = q.regularMarketChange || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const high = q.regularMarketDayHigh || price * 1.02;
      const low = q.regularMarketDayLow || price * 0.98;
      return {
        symbol: meta?.symbol || q.symbol.replace('.IS', ''),
        name: meta?.name || q.shortName || '',
        price,
        change,
        changePercent: changePct,
        volume: q.regularMarketVolume ? `${(q.regularMarketVolume / 1e6).toFixed(0)}M` : '-',
        marketCap: q.marketCap ? `${(q.marketCap / 1e9).toFixed(0)}B TRY` : '-',
        sector: 'BIST',
        market: 'BIST',
        dayHigh: high,
        dayLow: low,
        data: generateIntradayCurve(price, high, low),
      };
    });
    if (stocks.length > 0) setCache('bist', stocks);
    res.json(stocks);
  } catch (err) {
    console.error('[bist]', err);
    const cached = getCached('bist');
    res.json(cached || []);
  }
});

router.get('/stock-detail/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const [quote, summary] = await Promise.allSettled([
      yahooFinance.quote(symbol),
      yahooFinance.quoteSummary(symbol, {
        modules: ['price', 'summaryDetail', 'summaryProfile', 'financialData', 'defaultKeyStatistics', 'earningsHistory', 'recommendationTrend'],
      }),
    ]);

    const q = quote.status === 'fulfilled' ? quote.value : null;
    const s = summary.status === 'fulfilled' ? summary.value : null;

    if (!q) return res.json({ error: 'Symbol not found' });

    const price = q.regularMarketPrice || 0;
    const summaryDetail = s?.summaryDetail || {};
    const profile = s?.summaryProfile || {};
    const financialData = s?.financialData || {};
    const keyStats = s?.defaultKeyStatistics || {};

    res.json({
      symbol,
      name: q.shortName || q.longName || '',
      price,
      change: q.regularMarketChange || 0,
      changePercent: q.regularMarketChangePercent || 0,
      dayHigh: q.regularMarketDayHigh || 0,
      dayLow: q.regularMarketDayLow || 0,
      open: q.regularMarketOpen || 0,
      previousClose: q.regularMarketPreviousClose || 0,
      volume: q.regularMarketVolume || 0,
      marketCap: q.marketCap || 0,
      fiftyTwoWeekHigh: (summaryDetail as any).fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: (summaryDetail as any).fiftyTwoWeekLow || 0,
      peRatio: (summaryDetail as any).trailingPE || 0,
      forwardPE: (summaryDetail as any).forwardPE || 0,
      dividendYield: (summaryDetail as any).dividendYield || 0,
      beta: (summaryDetail as any).beta || 0,
      eps: (keyStats as any).trailingEps || 0,
      targetPrice: (financialData as any).targetMeanPrice || 0,
      recommendation: (financialData as any).recommendationKey || '',
      sector: (profile as any).sector || '',
      industry: (profile as any).industry || '',
      description: (profile as any).longBusinessSummary || '',
      website: (profile as any).website || '',
      employees: (profile as any).fullTimeEmployees || 0,
      country: (profile as any).country || '',
      revenue: (financialData as any).totalRevenue || 0,
      grossProfit: (financialData as any).grossProfits || 0,
      operatingMargin: (financialData as any).operatingMargins || 0,
      profitMargin: (financialData as any).profitMargins || 0,
      returnOnEquity: (financialData as any).returnOnEquity || 0,
      debtToEquity: (financialData as any).debtToEquity || 0,
      recommendationTrend: s?.recommendationTrend?.trend || [],
      earningsHistory: s?.earningsHistory?.history || [],
      data: generateIntradayCurve(price, q.regularMarketDayHigh || price * 1.02, q.regularMarketDayLow || price * 0.98),
    });
  } catch (err) {
    console.error('[stock-detail]', err);
    res.json({ error: 'Failed to fetch stock detail' });
  }
});

router.get('/memecoins/:chain', async (req, res) => {
  try {
    const chain = req.params.chain.toLowerCase();
    const chainMap: Record<string, string> = {
      solana: 'solana',
      ethereum: 'ethereum',
      bsc: 'bsc',
    };
    const dexChain = chainMap[chain] || 'solana';

    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=meme&chain=${dexChain}`);
    if (!dexRes.ok) throw new Error(`DexScreener ${dexRes.status}`);
    const dexData = await dexRes.json();

    const pairs = (dexData?.pairs || []).slice(0, 50).map((p: any) => ({
      name: p.baseToken?.name || '',
      symbol: p.baseToken?.symbol || '',
      address: p.baseToken?.address || '',
      pairAddress: p.pairAddress || '',
      chain: p.chainId || dexChain,
      dex: p.dexId || '',
      price: parseFloat(p.priceUsd || '0'),
      priceNative: parseFloat(p.priceNative || '0'),
      change5m: p.priceChange?.m5 || 0,
      change1h: p.priceChange?.h1 || 0,
      change6h: p.priceChange?.h6 || 0,
      change24h: p.priceChange?.h24 || 0,
      volume24h: p.volume?.h24 || 0,
      volume6h: p.volume?.h6 || 0,
      volume1h: p.volume?.h1 || 0,
      liquidity: p.liquidity?.usd || 0,
      fdv: p.fdv || 0,
      marketCap: p.marketCap || p.fdv || 0,
      pairCreatedAt: p.pairCreatedAt || '',
      txns24h: {
        buys: p.txns?.h24?.buys || 0,
        sells: p.txns?.h24?.sells || 0,
      },
      logo: p.info?.imageUrl || '',
      url: p.url || '',
    }));

    res.json(pairs);
  } catch (err) {
    console.error('[memecoins]', err);
    res.json([]);
  }
});

router.get('/market-intelligence', async (_req, res) => {
  try {
    const CG_KEY = await getApiKey('COINGECKO');
    const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
    url.searchParams.set('vs_currency', 'usd');
    url.searchParams.set('order', 'market_cap_desc');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', '1');
    url.searchParams.set('price_change_percentage', '24h,7d');
    if (CG_KEY) url.searchParams.set('x_cg_demo_api_key', CG_KEY);

    const cgRes = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    const coins = cgRes.ok ? await cgRes.json() : [];

    let nasdaqQuotes: any[] = [];
    try {
      nasdaqQuotes = await fetchQuotes(['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA']);
    } catch {}

    const allAssets = [
      ...(coins || []).map((c: any) => ({
        symbol: c.symbol?.toUpperCase(),
        name: c.name,
        price: c.current_price || 0,
        changePercent: c.price_change_percentage_24h || 0,
        marketCap: c.market_cap || 0,
        volume: c.total_volume || 0,
        sector: 'Crypto',
      })),
      ...nasdaqQuotes.map((q: any) => ({
        symbol: q.symbol,
        name: q.shortName || '',
        price: q.regularMarketPrice || 0,
        changePercent: q.regularMarketChangePercent || 0,
        marketCap: q.marketCap || 0,
        volume: q.regularMarketVolume || 0,
        sector: 'Stocks',
      })),
    ];

    const sorted = [...allAssets].sort((a, b) => b.changePercent - a.changePercent);
    const topGainers = sorted.slice(0, 10);
    const topLosers = sorted.slice(-10).reverse();

    const sectorMap = new Map<string, { totalCap: number; avgChange: number; count: number }>();
    allAssets.forEach((a) => {
      const sec = a.sector;
      if (!sectorMap.has(sec)) sectorMap.set(sec, { totalCap: 0, avgChange: 0, count: 0 });
      const s = sectorMap.get(sec)!;
      s.totalCap += a.marketCap;
      s.avgChange += a.changePercent;
      s.count++;
    });

    const sectorAnalysis = Array.from(sectorMap.entries()).map(([name, data]) => ({
      name,
      totalMarketCap: data.totalCap,
      avgChange24h: data.count > 0 ? data.avgChange / data.count : 0,
      assetCount: data.count,
    }));

    const totalVolume = allAssets.reduce((s, a) => s + a.volume, 0);
    const avgChange = allAssets.length > 0
      ? allAssets.reduce((s, a) => s + a.changePercent, 0) / allAssets.length
      : 0;

    res.json({
      topGainers,
      topLosers,
      sectorAnalysis,
      summary: {
        totalAssets: allAssets.length,
        totalVolume24h: totalVolume,
        avgChange24h: avgChange,
        marketSentiment: avgChange > 1 ? 'Bullish' : avgChange < -1 ? 'Bearish' : 'Neutral',
      },
    });
  } catch (err) {
    console.error('[market-intelligence]', err);
    res.json({ topGainers: [], topLosers: [], sectorAnalysis: [], summary: {} });
  }
});

export default router;
