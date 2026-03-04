import express from 'express';
import cors from 'cors';
import yahooFinance from 'yahoo-finance2';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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
];

const NASDAQ_SYMBOLS = [
  { yahoo: 'AAPL', name: 'Apple' },
  { yahoo: 'MSFT', name: 'Microsoft' },
  { yahoo: 'NVDA', name: 'NVIDIA' },
  { yahoo: 'GOOGL', name: 'Alphabet' },
  { yahoo: 'AMZN', name: 'Amazon' },
  { yahoo: 'META', name: 'Meta' },
  { yahoo: 'TSLA', name: 'Tesla' },
];

const BIST_SYMBOLS = [
  { yahoo: 'THYAO.IS', symbol: 'THYAO', name: 'Turk Hava Yollari' },
  { yahoo: 'GARAN.IS', symbol: 'GARAN', name: 'Garanti BBVA' },
  { yahoo: 'ASELS.IS', symbol: 'ASELS', name: 'Aselsan' },
  { yahoo: 'AKBNK.IS', symbol: 'AKBNK', name: 'Akbank' },
  { yahoo: 'KCHOL.IS', symbol: 'KCHOL', name: 'Koc Holding' },
];

async function fetchQuotes(symbols: string[]) {
  const results: any[] = [];
  for (const sym of symbols) {
    try {
      const quote = await yahooFinance.quote(sym);
      if (quote) results.push(quote);
    } catch {
      // skip failed
    }
  }
  return results;
}

app.get('/api/crypto', async (_req, res) => {
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

app.get('/api/nasdaq', async (_req, res) => {
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

app.get('/api/bist', async (_req, res) => {
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

app.get('/api/news', async (_req, res) => {
  try {
    const symbols = ['AAPL', 'TSLA', 'NVDA', 'BTC-USD', 'ETH-USD'];
    const allNews: any[] = [];

    for (const sym of symbols.slice(0, 3)) {
      try {
        const result = await yahooFinance.search(sym, { newsCount: 3 });
        if (result.news) {
          result.news.forEach((n: any) => {
            allNews.push({
              id: n.uuid || `${Date.now()}-${Math.random()}`,
              title: n.title,
              source: n.publisher || 'Market',
              time: n.providerPublishTime
                ? new Date(n.providerPublishTime * 1000).toLocaleString()
                : 'Recent',
              category: sym.includes('-USD') ? 'Crypto' : 'Stocks',
              sentiment: 'Neutral',
              url: n.link || '',
            });
          });
        }
      } catch {
        // skip
      }
    }

    res.json(allNews);
  } catch (err) {
    console.error('[news]', err);
    res.json([]);
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, marketContext } = req.body;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return res.json({ reply: 'AI service is not configured. Please add a GEMINI_API_KEY.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const lastMessage = messages?.[messages.length - 1]?.content || '';
    const systemPrompt = `You are Aethron, an elite financial markets AI analyst. You have access to live market data. Be concise, data-driven, and actionable. Use bullet points. Always include specific price levels and percentages when relevant.\n\nCurrent market context: ${marketContext || 'No live data available.'}`;

    const contents = [
      { role: 'user' as const, parts: [{ text: systemPrompt }] },
      { role: 'model' as const, parts: [{ text: 'Understood. I am Aethron, ready to provide market intelligence.' }] },
    ];

    if (messages && messages.length > 1) {
      for (const msg of messages.slice(0, -1)) {
        contents.push({
          role: msg.role === 'user' ? 'user' as const : 'model' as const,
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({ role: 'user' as const, parts: [{ text: lastMessage }] });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents,
    });

    const reply = response.text || 'No response generated.';
    res.json({ reply });
  } catch (err) {
    console.error('[ai/chat]', err);
    res.json({ reply: 'AI service encountered an error. Please try again.' });
  }
});

app.get('/api/economic-calendar', (_req, res) => {
  const events = [
    { date: new Date().toISOString(), title: 'Fed Interest Rate Decision', country: 'US', impact: 'High', category: 'Central Bank', actual: '-', estimate: '5.50%', previous: '5.50%' },
    { date: new Date().toISOString(), title: 'Non-Farm Payrolls', country: 'US', impact: 'High', category: 'Data', actual: '-', estimate: '175K', previous: '199K' },
    { date: new Date().toISOString(), title: 'CPI YoY', country: 'US', impact: 'High', category: 'Data', actual: '-', estimate: '3.1%', previous: '3.2%' },
    { date: new Date().toISOString(), title: 'TCMB Rate Decision', country: 'TR', impact: 'High', category: 'Central Bank', actual: '-', estimate: '45.00%', previous: '45.00%' },
  ];
  res.json({ events });
});

app.get('/api/insider-trades', (_req, res) => {
  res.json([]);
});

app.get('/api/memecoins/:chain', (_req, res) => {
  res.json([]);
});

app.get('/api/market-intelligence', (_req, res) => {
  res.json({ topGainers: [], topLosers: [], sectors: [], whaleActivity: [], aiPicks: [] });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Running on port ${PORT}`);
});
