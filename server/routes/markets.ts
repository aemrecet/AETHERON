import { Router } from 'express';
import yahooFinance from 'yahoo-finance2';

const router = Router();

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

const CRYPTO_SYMBOLS = [
  { yahoo: 'BTC-USD', symbol: 'BTC', name: 'Bitcoin' },
  { yahoo: 'ETH-USD', symbol: 'ETH', name: 'Ethereum' },
  { yahoo: 'SOL-USD', symbol: 'SOL', name: 'Solana' },
  { yahoo: 'BNB-USD', symbol: 'BNB', name: 'Binance Coin' },
  { yahoo: 'XRP-USD', symbol: 'XRP', name: 'Ripple' },
  { yahoo: 'ADA-USD', symbol: 'ADA', name: 'Cardano' },
  { yahoo: 'AVAX-USD', symbol: 'AVAX', name: 'Avalanche' },
  { yahoo: 'DOGE-USD', symbol: 'DOGE', name: 'Dogecoin' },
  { yahoo: 'DOT-USD', symbol: 'DOT', name: 'Polkadot' },
  { yahoo: 'LINK-USD', symbol: 'LINK', name: 'Chainlink' },
  { yahoo: 'MATIC-USD', symbol: 'MATIC', name: 'Polygon' },
  { yahoo: 'UNI-USD', symbol: 'UNI', name: 'Uniswap' },
  { yahoo: 'SHIB-USD', symbol: 'SHIB', name: 'Shiba Inu' },
  { yahoo: 'LTC-USD', symbol: 'LTC', name: 'Litecoin' },
  { yahoo: 'ATOM-USD', symbol: 'ATOM', name: 'Cosmos' },
  { yahoo: 'FIL-USD', symbol: 'FIL', name: 'Filecoin' },
  { yahoo: 'NEAR-USD', symbol: 'NEAR', name: 'NEAR Protocol' },
  { yahoo: 'APT-USD', symbol: 'APT', name: 'Aptos' },
  { yahoo: 'ARB11841-USD', symbol: 'ARB', name: 'Arbitrum' },
  { yahoo: 'OP-USD', symbol: 'OP', name: 'Optimism' },
  { yahoo: 'AAVE-USD', symbol: 'AAVE', name: 'Aave' },
  { yahoo: 'MKR-USD', symbol: 'MKR', name: 'Maker' },
  { yahoo: 'GRT-USD', symbol: 'GRT', name: 'The Graph' },
  { yahoo: 'INJ-USD', symbol: 'INJ', name: 'Injective' },
  { yahoo: 'TIA-USD', symbol: 'TIA', name: 'Celestia' },
  { yahoo: 'SUI20947-USD', symbol: 'SUI', name: 'Sui' },
  { yahoo: 'SEI-USD', symbol: 'SEI', name: 'Sei' },
  { yahoo: 'RENDER-USD', symbol: 'RNDR', name: 'Render' },
  { yahoo: 'FET-USD', symbol: 'FET', name: 'Fetch.ai' },
  { yahoo: 'PEPE24478-USD', symbol: 'PEPE', name: 'Pepe' },
];

const NASDAQ_SYMBOLS = [
  { yahoo: 'AAPL', name: 'Apple' },
  { yahoo: 'MSFT', name: 'Microsoft' },
  { yahoo: 'NVDA', name: 'NVIDIA' },
  { yahoo: 'GOOGL', name: 'Alphabet' },
  { yahoo: 'AMZN', name: 'Amazon' },
  { yahoo: 'META', name: 'Meta' },
  { yahoo: 'TSLA', name: 'Tesla' },
  { yahoo: 'AVGO', name: 'Broadcom' },
  { yahoo: 'COST', name: 'Costco' },
  { yahoo: 'NFLX', name: 'Netflix' },
  { yahoo: 'AMD', name: 'AMD' },
  { yahoo: 'ADBE', name: 'Adobe' },
  { yahoo: 'CRM', name: 'Salesforce' },
  { yahoo: 'INTC', name: 'Intel' },
  { yahoo: 'QCOM', name: 'Qualcomm' },
  { yahoo: 'TXN', name: 'Texas Instruments' },
  { yahoo: 'AMAT', name: 'Applied Materials' },
  { yahoo: 'PANW', name: 'Palo Alto Networks' },
  { yahoo: 'MU', name: 'Micron' },
  { yahoo: 'LRCX', name: 'Lam Research' },
  { yahoo: 'ISRG', name: 'Intuitive Surgical' },
  { yahoo: 'BKNG', name: 'Booking Holdings' },
  { yahoo: 'KLAC', name: 'KLA Corporation' },
  { yahoo: 'SNPS', name: 'Synopsys' },
  { yahoo: 'CDNS', name: 'Cadence Design' },
  { yahoo: 'MRVL', name: 'Marvell Technology' },
  { yahoo: 'PYPL', name: 'PayPal' },
  { yahoo: 'ABNB', name: 'Airbnb' },
  { yahoo: 'COIN', name: 'Coinbase' },
  { yahoo: 'PLTR', name: 'Palantir' },
  { yahoo: 'SMCI', name: 'Super Micro' },
  { yahoo: 'ARM', name: 'ARM Holdings' },
  { yahoo: 'UBER', name: 'Uber' },
  { yahoo: 'SQ', name: 'Block' },
  { yahoo: 'SHOP', name: 'Shopify' },
  { yahoo: 'SNOW', name: 'Snowflake' },
  { yahoo: 'DDOG', name: 'Datadog' },
  { yahoo: 'NET', name: 'Cloudflare' },
  { yahoo: 'CRWD', name: 'CrowdStrike' },
  { yahoo: 'ZS', name: 'Zscaler' },
];

const BIST_SYMBOLS = [
  { yahoo: 'THYAO.IS', symbol: 'THYAO', name: 'Turk Hava Yollari' },
  { yahoo: 'GARAN.IS', symbol: 'GARAN', name: 'Garanti BBVA' },
  { yahoo: 'ASELS.IS', symbol: 'ASELS', name: 'Aselsan' },
  { yahoo: 'AKBNK.IS', symbol: 'AKBNK', name: 'Akbank' },
  { yahoo: 'KCHOL.IS', symbol: 'KCHOL', name: 'Koc Holding' },
  { yahoo: 'SAHOL.IS', symbol: 'SAHOL', name: 'Sabanci Holding' },
  { yahoo: 'EREGL.IS', symbol: 'EREGL', name: 'Eregli Demir Celik' },
  { yahoo: 'SISE.IS', symbol: 'SISE', name: 'Turkiye Sise' },
  { yahoo: 'TUPRS.IS', symbol: 'TUPRS', name: 'Tupras' },
  { yahoo: 'YKBNK.IS', symbol: 'YKBNK', name: 'Yapi Kredi' },
  { yahoo: 'PGSUS.IS', symbol: 'PGSUS', name: 'Pegasus' },
  { yahoo: 'BIMAS.IS', symbol: 'BIMAS', name: 'BIM Magazalar' },
  { yahoo: 'FROTO.IS', symbol: 'FROTO', name: 'Ford Otosan' },
  { yahoo: 'TOASO.IS', symbol: 'TOASO', name: 'Tofas Oto' },
  { yahoo: 'SASA.IS', symbol: 'SASA', name: 'SASA Polyester' },
  { yahoo: 'TCELL.IS', symbol: 'TCELL', name: 'Turkcell' },
  { yahoo: 'TAVHL.IS', symbol: 'TAVHL', name: 'TAV Havalimanlari' },
  { yahoo: 'EKGYO.IS', symbol: 'EKGYO', name: 'Emlak Konut GYO' },
  { yahoo: 'HALKB.IS', symbol: 'HALKB', name: 'Halkbank' },
  { yahoo: 'VAKBN.IS', symbol: 'VAKBN', name: 'Vakifbank' },
  { yahoo: 'ISCTR.IS', symbol: 'ISCTR', name: 'Is Bankasi C' },
  { yahoo: 'KOZAL.IS', symbol: 'KOZAL', name: 'Koza Altin' },
  { yahoo: 'KOZAA.IS', symbol: 'KOZAA', name: 'Koza Anadolu Metal' },
  { yahoo: 'PETKM.IS', symbol: 'PETKM', name: 'Petkim' },
  { yahoo: 'ARCLK.IS', symbol: 'ARCLK', name: 'Arcelik' },
  { yahoo: 'VESTL.IS', symbol: 'VESTL', name: 'Vestel Elektronik' },
  { yahoo: 'MGROS.IS', symbol: 'MGROS', name: 'Migros' },
  { yahoo: 'TTKOM.IS', symbol: 'TTKOM', name: 'Turk Telekom' },
  { yahoo: 'ENKAI.IS', symbol: 'ENKAI', name: 'Enka Insaat' },
  { yahoo: 'DOHOL.IS', symbol: 'DOHOL', name: 'Dogan Holding' },
];

async function fetchQuotes(symbols: string[]) {
  const results: any[] = [];
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (sym) => {
      try {
        const quote = await yahooFinance.quote(sym);
        if (quote) return quote;
      } catch {}
      return null;
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
  }
  return results;
}

router.get('/crypto', async (_req, res) => {
  try {
    const quotes = await fetchQuotes(CRYPTO_SYMBOLS.map((s) => s.yahoo));
    const stocks = quotes.map((q) => {
      const meta = CRYPTO_SYMBOLS.find((s) => s.yahoo === q.symbol);
      const price = q.regularMarketPrice || 0;
      const change = q.regularMarketChange || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const high = q.regularMarketDayHigh || price * 1.02;
      const low = q.regularMarketDayLow || price * 0.98;
      return {
        symbol: meta?.symbol || q.symbol.replace('-USD', ''),
        name: meta?.name || q.shortName || '',
        price,
        change,
        changePercent: changePct,
        volume: q.regularMarketVolume ? `$${(q.regularMarketVolume / 1e9).toFixed(1)}B` : '-',
        marketCap: q.marketCap ? `$${(q.marketCap / 1e9).toFixed(0)}B` : '-',
        sector: 'Crypto',
        market: 'CRYPTO',
        dayHigh: high,
        dayLow: low,
        logo: `https://assets.coincap.io/assets/icons/${(meta?.symbol || '').toLowerCase()}@2x.png`,
        data: generateIntradayCurve(price, high, low),
      };
    });
    res.json(stocks);
  } catch (err) {
    console.error('[crypto]', err);
    res.json([]);
  }
});

router.get('/nasdaq', async (_req, res) => {
  try {
    const quotes = await fetchQuotes(NASDAQ_SYMBOLS.map((s) => s.yahoo));
    const stocks = quotes.map((q) => {
      const meta = NASDAQ_SYMBOLS.find((s) => s.yahoo === q.symbol);
      const price = q.regularMarketPrice || 0;
      const change = q.regularMarketChange || 0;
      const changePct = q.regularMarketChangePercent || 0;
      const high = q.regularMarketDayHigh || price * 1.02;
      const low = q.regularMarketDayLow || price * 0.98;
      return {
        symbol: q.symbol,
        name: meta?.name || q.shortName || '',
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
    res.json(stocks);
  } catch (err) {
    console.error('[nasdaq]', err);
    res.json([]);
  }
});

router.get('/bist', async (_req, res) => {
  try {
    const quotes = await fetchQuotes(BIST_SYMBOLS.map((s) => s.yahoo));
    const stocks = quotes.map((q) => {
      const meta = BIST_SYMBOLS.find((s) => s.yahoo === q.symbol);
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
    res.json(stocks);
  } catch (err) {
    console.error('[bist]', err);
    res.json([]);
  }
});

export default router;
