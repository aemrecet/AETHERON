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

const MOCK_INSIDER_TRADES = [
  { symbol: 'AAPL', transactionType: 'Buy', name: 'Tim Cook (CEO)', share: 50000, value: 9250000, transactionDate: '2026-02-28' },
  { symbol: 'NVDA', transactionType: 'Sale', name: 'Jensen Huang (CEO)', share: 120000, value: 107400000, transactionDate: '2026-02-27' },
  { symbol: 'MSFT', transactionType: 'Buy', name: 'Satya Nadella (CEO)', share: 25000, value: 10500000, transactionDate: '2026-02-26' },
  { symbol: 'TSLA', transactionType: 'Sale', name: 'Elon Musk (CEO)', share: 500000, value: 87500000, transactionDate: '2026-02-25' },
  { symbol: 'META', transactionType: 'Buy', name: 'Mark Zuckerberg (CEO)', share: 30000, value: 14550000, transactionDate: '2026-02-24' },
  { symbol: 'GOOGL', transactionType: 'Sale', name: 'Sundar Pichai (CEO)', share: 10000, value: 1750000, transactionDate: '2026-02-23' },
  { symbol: 'AMZN', transactionType: 'Buy', name: 'Andy Jassy (CEO)', share: 15000, value: 2700000, transactionDate: '2026-02-22' },
];

const MOCK_CONGRESS = [
  { name: 'Nancy Pelosi', party: 'D', state: 'CA', chamber: 'House', totalBuys: 42, totalSells: 18, totalTrades: 60, topTickers: ['NVDA', 'AAPL', 'MSFT', 'CRM'] },
  { name: 'Dan Crenshaw', party: 'R', state: 'TX', chamber: 'House', totalBuys: 25, totalSells: 12, totalTrades: 37, topTickers: ['TSLA', 'MSFT', 'GOOGL'] },
  { name: 'Tommy Tuberville', party: 'R', state: 'AL', chamber: 'Senate', totalBuys: 55, totalSells: 30, totalTrades: 85, topTickers: ['AAPL', 'NVDA', 'META', 'AMZN'] },
  { name: 'Mark Green', party: 'R', state: 'TN', chamber: 'House', totalBuys: 18, totalSells: 8, totalTrades: 26, topTickers: ['LMT', 'RTX', 'BA'] },
  { name: 'Josh Gottheimer', party: 'D', state: 'NJ', chamber: 'House', totalBuys: 32, totalSells: 15, totalTrades: 47, topTickers: ['MSFT', 'GOOGL', 'AMZN'] },
  { name: 'Michael McCaul', party: 'R', state: 'TX', chamber: 'House', totalBuys: 20, totalSells: 22, totalTrades: 42, topTickers: ['NVDA', 'AMD', 'TSM'] },
];

const MOCK_FUNDS = [
  { id: 'ark-innovation', name: 'ARK Innovation ETF', ticker: 'ARKK', type: 'ETF', aum: 7800000000, topHoldings: ['TSLA', 'COIN', 'SQ', 'ROKU', 'ZM'], manager: 'Cathie Wood', ytdReturn: 12.5, expenseRatio: 0.75 },
  { id: 'berkshire', name: 'Berkshire Hathaway', ticker: 'BRK.B', type: 'Holding', aum: 780000000000, topHoldings: ['AAPL', 'BAC', 'KO', 'CVX', 'AXP'], manager: 'Warren Buffett', ytdReturn: 8.2, expenseRatio: 0 },
  { id: 'spy', name: 'SPDR S&P 500 ETF', ticker: 'SPY', type: 'ETF', aum: 450000000000, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], manager: 'State Street', ytdReturn: 15.3, expenseRatio: 0.09 },
  { id: 'qqq', name: 'Invesco QQQ Trust', ticker: 'QQQ', type: 'ETF', aum: 250000000000, topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], manager: 'Invesco', ytdReturn: 18.7, expenseRatio: 0.20 },
  { id: 'bridgewater', name: 'Bridgewater Pure Alpha', ticker: 'N/A', type: 'Hedge Fund', aum: 125000000000, topHoldings: ['SPY', 'TLT', 'GLD', 'EEM'], manager: 'Ray Dalio', ytdReturn: 5.1, expenseRatio: 2.0 },
];

app.get('/api/insider/trades', (_req, res) => {
  res.json(MOCK_INSIDER_TRADES);
});

app.get('/api/insider/congress', (_req, res) => {
  res.json(MOCK_CONGRESS);
});

app.get('/api/insider/congress/:name', (req, res) => {
  const member = MOCK_CONGRESS.find(m => m.name === decodeURIComponent(req.params.name));
  if (!member) return res.json(null);
  res.json({
    ...member,
    trades: [
      { symbol: member.topTickers[0] || 'AAPL', type: 'purchase', amount: '$100K - $250K', date: '2026-02-15', assetType: 'Stock' },
      { symbol: member.topTickers[1] || 'MSFT', type: 'sale', amount: '$50K - $100K', date: '2026-02-10', assetType: 'Stock' },
      { symbol: member.topTickers[2] || 'NVDA', type: 'purchase', amount: '$250K - $500K', date: '2026-01-28', assetType: 'Stock' },
    ],
    bio: `${member.name} is a ${member.party === 'D' ? 'Democratic' : 'Republican'} member of the ${member.chamber} representing ${member.state}.`,
  });
});

app.get('/api/insider/funds', (_req, res) => {
  res.json(MOCK_FUNDS);
});

app.get('/api/insider/funds/:id', (req, res) => {
  const fund = MOCK_FUNDS.find(f => f.id === req.params.id);
  if (!fund) return res.json(null);
  res.json({
    ...fund,
    recentTrades: [
      { symbol: fund.topHoldings[0], action: 'Increased', shares: 500000, value: 25000000, date: '2026-02-20' },
      { symbol: fund.topHoldings[1], action: 'New Position', shares: 200000, value: 10000000, date: '2026-02-18' },
      { symbol: fund.topHoldings[2], action: 'Decreased', shares: 100000, value: 8000000, date: '2026-02-15' },
    ],
    sectorAllocation: [
      { sector: 'Technology', weight: 45 },
      { sector: 'Healthcare', weight: 15 },
      { sector: 'Financials', weight: 12 },
      { sector: 'Consumer', weight: 10 },
      { sector: 'Energy', weight: 8 },
      { sector: 'Other', weight: 10 },
    ],
  });
});

app.get('/api/onchain/coin-list', (_req, res) => {
  res.json([
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'BNB', name: 'Binance Coin' },
    { symbol: 'XRP', name: 'Ripple' },
    { symbol: 'ADA', name: 'Cardano' },
    { symbol: 'DOGE', name: 'Dogecoin' },
    { symbol: 'AVAX', name: 'Avalanche' },
    { symbol: 'DOT', name: 'Polkadot' },
    { symbol: 'LINK', name: 'Chainlink' },
    { symbol: 'UNI', name: 'Uniswap' },
    { symbol: 'AAVE', name: 'Aave' },
  ]);
});

app.get('/api/onchain/gas', (_req, res) => {
  res.json({
    ethereum: { low: 12, standard: 18, fast: 25, instant: 35, baseFee: 15.2 },
    bsc: { low: 3, standard: 5, fast: 7, instant: 10, baseFee: 3.5 },
    polygon: { low: 30, standard: 50, fast: 80, instant: 120, baseFee: 35 },
    solana: { low: 0.000005, standard: 0.000005, fast: 0.00001, instant: 0.00005, baseFee: 0.000005 },
  });
});

app.get('/api/onchain/top-wallets', (_req, res) => {
  res.json([
    { address: '0x28C6...9e2B', label: 'Binance Cold Wallet', chain: 'ethereum', balance: 1248500, symbol: 'ETH', balanceUsd: 4307675000, lastActive: '2 min ago' },
    { address: 'bc1q...k8pm', label: 'Bitcoin Whale #1', chain: 'bitcoin', balance: 12450, symbol: 'BTC', balanceUsd: 839837500, lastActive: '15 min ago' },
    { address: '0x21a3...7fC1', label: 'Ethereum Foundation', chain: 'ethereum', balance: 398200, symbol: 'ETH', balanceUsd: 1373789000, lastActive: '1 hr ago' },
    { address: '5yNm...X3pR', label: 'SOL Whale', chain: 'solana', balance: 5200000, symbol: 'SOL', balanceUsd: 755040000, lastActive: '5 min ago' },
    { address: '0x47ac...E3d9', label: 'Jump Trading', chain: 'ethereum', balance: 285000, symbol: 'ETH', balanceUsd: 983250000, lastActive: '30 min ago' },
    { address: '0xdAC1...1ec7', label: 'Tether Treasury', chain: 'ethereum', balance: 5400000000, symbol: 'USDT', balanceUsd: 5400000000, lastActive: '3 min ago' },
  ]);
});

app.get('/api/onchain/whale-alerts', (req, res) => {
  const minValue = parseInt(req.query.minValue as string) || 100000;
  const chain = req.query.chain as string || 'all';
  const txs = [
    { hash: '0xabc1', blockchain: 'ethereum', symbol: 'ETH', amount: 15000, amountUsd: 51750000, from: '0x28C6...9e2B', to: '0x7a25...3fD1', fromLabel: 'Binance', toLabel: 'Unknown Wallet', timestamp: Date.now() - 120000 },
    { hash: '0xabc2', blockchain: 'bitcoin', symbol: 'BTC', amount: 500, amountUsd: 33725000, from: 'bc1q...k8pm', to: '3FZb...qR7K', fromLabel: 'Unknown Whale', toLabel: 'Coinbase', timestamp: Date.now() - 300000 },
    { hash: '0xabc3', blockchain: 'ethereum', symbol: 'USDT', amount: 25000000, amountUsd: 25000000, from: '0xdAC1...1ec7', to: '0x47ac...E3d9', fromLabel: 'Tether Treasury', toLabel: 'Jump Trading', timestamp: Date.now() - 600000 },
    { hash: '0xabc4', blockchain: 'solana', symbol: 'SOL', amount: 200000, amountUsd: 29040000, from: '5yNm...X3pR', to: '7kLp...m9Qz', fromLabel: 'SOL Whale', toLabel: 'Kraken', timestamp: Date.now() - 900000 },
  ].filter(tx => tx.amountUsd >= minValue && (chain === 'all' || tx.blockchain === chain));
  res.json({ transactions: txs });
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
