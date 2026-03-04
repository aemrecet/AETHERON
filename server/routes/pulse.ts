import { Router } from 'express';
import { getApiKey } from '../apiKeys.js';

const router = Router();

const cmcFetch = async (path: string, params: Record<string, string> = {}) => {
  const cmcKey = await getApiKey('COINMARKETCAP');
  const url = new URL(`https://pro-api.coinmarketcap.com${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { 'X-CMC_PRO_API_KEY': cmcKey, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CMC ${res.status}`);
  return res.json();
};

const cgFetch = async (path: string, params: Record<string, string> = {}) => {
  const cgKey = await getApiKey('COINGECKO');
  const url = new URL(`https://api.coingecko.com/api/v3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (cgKey) url.searchParams.set('x_cg_demo_api_key', cgKey);
  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CG ${res.status}`);
  return res.json();
};

router.get('/market-stats', async (_req, res) => {
  try {
    const [cmcGlobal, cgGlobal] = await Promise.allSettled([
      cmcFetch('/v1/global-metrics/quotes/latest'),
      cgFetch('/global'),
    ]);

    let totalMarketCap = 0, totalVolume24h = 0, btcDominance = 0, ethDominance = 0;
    let activeCryptos = 0, activeExchanges = 0, marketCapChange24h = 0;
    const dominanceBreakdown: any[] = [];

    if (cmcGlobal.status === 'fulfilled') {
      const d = cmcGlobal.value?.data;
      if (d) {
        totalMarketCap = d.quote?.USD?.total_market_cap || 0;
        totalVolume24h = d.quote?.USD?.total_volume_24h || 0;
        btcDominance = d.btc_dominance || 0;
        ethDominance = d.eth_dominance || 0;
        activeCryptos = d.active_cryptocurrencies || 0;
        activeExchanges = d.active_exchanges || 0;
        marketCapChange24h = d.quote?.USD?.total_market_cap_yesterday_percentage_change || 0;
      }
    }

    if (cgGlobal.status === 'fulfilled') {
      const d = cgGlobal.value?.data;
      if (d) {
        if (!totalMarketCap) totalMarketCap = d.total_market_cap?.usd || 0;
        if (!totalVolume24h) totalVolume24h = d.total_volume?.usd || 0;
        if (!btcDominance) btcDominance = d.market_cap_percentage?.btc || 0;
        if (!ethDominance) ethDominance = d.market_cap_percentage?.eth || 0;
        if (!activeCryptos) activeCryptos = d.active_cryptocurrencies || 0;

        if (d.market_cap_percentage) {
          Object.entries(d.market_cap_percentage)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 10)
            .forEach(([symbol, percentage]) => {
              dominanceBreakdown.push({ symbol: symbol.toUpperCase(), percentage });
            });
        }
      }
    }

    res.json({
      totalMarketCap,
      totalVolume24h,
      btcDominance,
      ethDominance,
      activeCryptos,
      activeExchanges,
      marketCapChange24h,
      dominanceBreakdown,
    });
  } catch (err) {
    console.error('[pulse/market-stats]', err);
    res.json({
      totalMarketCap: 0, totalVolume24h: 0, btcDominance: 0,
      ethDominance: 0, activeCryptos: 0, activeExchanges: 0,
      marketCapChange24h: 0, dominanceBreakdown: [],
    });
  }
});

router.get('/fear-greed', async (_req, res) => {
  try {
    const fgRes = await fetch('https://api.alternative.me/fng/?limit=31');
    const fgData = await fgRes.json();
    const entries = fgData?.data || [];
    const current = entries[0]
      ? { value: parseInt(entries[0].value), label: entries[0].value_classification }
      : { value: 50, label: 'Neutral' };
    const history = entries.map((e: any) => ({
      value: parseInt(e.value),
      timestamp: parseInt(e.timestamp) * 1000,
    })).reverse();

    res.json({ current, history });
  } catch (err) {
    console.error('[pulse/fear-greed]', err);
    res.json({ current: { value: 50, label: 'Neutral' }, history: [] });
  }
});

router.get('/trending', async (_req, res) => {
  try {
    const [trendingRes, categoriesRes] = await Promise.allSettled([
      cgFetch('/search/trending'),
      cgFetch('/coins/markets', {
        vs_currency: 'usd',
        order: 'volume_desc',
        per_page: '15',
        page: '1',
        sparkline: 'false',
        price_change_percentage: '24h',
      }),
    ]);

    let coins: any[] = [];
    if (trendingRes.status === 'fulfilled' && trendingRes.value?.coins) {
      coins = trendingRes.value.coins.map((c: any) => ({
        id: c.item?.id,
        name: c.item?.name,
        symbol: c.item?.symbol?.toUpperCase(),
        logo: c.item?.large || c.item?.thumb,
        price: c.item?.data?.price,
        marketCap: c.item?.data?.market_cap,
        priceChange24h: c.item?.data?.price_change_percentage_24h?.usd,
      }));
    }

    if (coins.length === 0 && categoriesRes.status === 'fulfilled') {
      coins = (categoriesRes.value || []).slice(0, 15).map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol?.toUpperCase(),
        logo: c.image,
        price: c.current_price,
        marketCap: c.market_cap,
        priceChange24h: c.price_change_percentage_24h,
      }));
    }

    let categories: any[] = [];
    if (trendingRes.status === 'fulfilled' && trendingRes.value?.categories) {
      categories = trendingRes.value.categories.slice(0, 8).map((c: any) => ({
        id: c.id,
        name: c.name,
        marketCapChange24h: c.data?.market_cap_change_percentage_24h?.usd,
      }));
    }

    res.json({ coins, categories });
  } catch (err) {
    console.error('[pulse/trending]', err);
    res.json({ coins: [], categories: [] });
  }
});

router.get('/feed', async (_req, res) => {
  try {
    const cmcRes = await cmcFetch('/v1/content/latest', { start: '1', limit: '30' });
    const items = (cmcRes?.data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      summary: item.subtitle || item.description || '',
      source: item.source_name || 'CoinMarketCap',
      url: item.source_url || item.url || '',
      image: item.cover || '',
      category: item.type === 'news' ? 'General' : item.type || 'General',
      sentiment: 'Neutral',
      relativeTime: item.released_at
        ? getRelativeTime(new Date(item.released_at).getTime())
        : 'Recent',
    }));
    res.json(items);
  } catch (err) {
    console.error('[pulse/feed]', err);
    res.json([]);
  }
});

router.get('/exchanges', async (_req, res) => {
  try {
    const data = await cgFetch('/exchanges', { per_page: '20', page: '1' });
    const exchanges = (data || []).map((ex: any, i: number) => ({
      rank: i + 1,
      name: ex.name,
      image: ex.image,
      trustScore: ex.trust_score,
      volume24hBtc: ex.trade_volume_24h_btc,
      country: ex.country || '--',
      year: ex.year_established || '--',
    }));
    const totalVolBtc = exchanges.reduce((s: number, e: any) => s + (e.volume24hBtc || 0), 0);
    res.json({ exchanges, stats: { totalVolume24hBtc: totalVolBtc } });
  } catch (err) {
    console.error('[pulse/exchanges]', err);
    res.json({ exchanges: [], stats: {} });
  }
});

router.get('/derivatives', async (_req, res) => {
  try {
    const [exchRes, tickerRes] = await Promise.allSettled([
      cgFetch('/derivatives/exchanges', { per_page: '15' }),
      cgFetch('/derivatives'),
    ]);

    const exchanges = exchRes.status === 'fulfilled'
      ? (exchRes.value || []).map((ex: any) => ({
          name: ex.name,
          image: ex.image,
          openInterestBtc: ex.open_interest_btc,
          tradeVolume24hBtc: ex.trade_volume_24h_btc,
          perpetuals: ex.number_of_perpetual_pairs,
          futures: ex.number_of_futures_pairs,
        }))
      : [];

    const tickers = tickerRes.status === 'fulfilled'
      ? (tickerRes.value || []).slice(0, 25).map((t: any) => ({
          market: t.market,
          symbol: t.symbol,
          price: t.price,
          fundingRate: t.funding_rate,
          openInterest: t.open_interest,
          volume24h: t.volume_24h,
        }))
      : [];

    const stats = {
      totalOpenInterestBtc: exchanges.reduce((s: number, e: any) => s + (e.openInterestBtc || 0), 0),
      totalVolume24hBtc: exchanges.reduce((s: number, e: any) => s + (e.tradeVolume24hBtc || 0), 0),
      totalPerpetualPairs: exchanges.reduce((s: number, e: any) => s + (e.perpetuals || 0), 0),
      totalFuturesPairs: exchanges.reduce((s: number, e: any) => s + (e.futures || 0), 0),
    };

    res.json({ exchanges, tickers, stats });
  } catch (err) {
    console.error('[pulse/derivatives]', err);
    res.json({ exchanges: [], tickers: [], stats: {} });
  }
});

router.get('/btc-treasuries', async (_req, res) => {
  try {
    const [companiesRes, btcQuote] = await Promise.allSettled([
      cgFetch('/companies/public_treasury/bitcoin'),
      cgFetch('/simple/price', { ids: 'bitcoin', vs_currencies: 'usd' }),
    ]);

    const btcPrice = btcQuote.status === 'fulfilled' ? btcQuote.value?.bitcoin?.usd || 68000 : 68000;
    let treasuries: any[] = [];
    let totalBtcHeld = 0;
    let totalValue = 0;
    const countries: any[] = [];

    if (companiesRes.status === 'fulfilled') {
      const data = companiesRes.value;
      totalBtcHeld = data?.total_holdings || 0;
      totalValue = data?.total_value_usd || 0;

      const companies = data?.companies || [];
      const countryMap: Record<string, number> = {};

      treasuries = companies.map((c: any, i: number) => {
        const country = c.country || '--';
        countryMap[country] = (countryMap[country] || 0) + (c.total_holdings || 0);
        return {
          rank: i + 1,
          name: c.name,
          ticker: c.symbol || '',
          country,
          btcHeld: c.total_holdings || 0,
          avgPrice: c.total_entry_value_usd && c.total_holdings
            ? c.total_entry_value_usd / c.total_holdings
            : 0,
          value: (c.total_holdings || 0) * btcPrice,
          percentOfTotal: totalBtcHeld > 0 ? ((c.total_holdings || 0) / totalBtcHeld) * 100 : 0,
        };
      });

      Object.entries(countryMap)
        .sort(([, a], [, b]) => b - a)
        .forEach(([country, btcHeld]) => {
          countries.push({
            country,
            btcHeld,
            percentage: totalBtcHeld > 0 ? (btcHeld / totalBtcHeld) * 100 : 0,
          });
        });
    }

    res.json({
      treasuries,
      stats: {
        totalBtcHeld,
        totalValue,
        percentOfSupply: (totalBtcHeld / 21000000) * 100,
        btcPrice,
        companiesCount: treasuries.length,
      },
      countries,
    });
  } catch (err) {
    console.error('[pulse/btc-treasuries]', err);
    res.json({ treasuries: [], stats: {}, countries: [] });
  }
});

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

export default router;
