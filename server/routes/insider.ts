import { Router } from 'express';
import { getApiKey } from '../apiKeys.js';

const router = Router();

const qqFetch = async (path: string) => {
  const qqKey = await getApiKey('QUIVERQUANT');
  const res = await fetch(`https://api.quiverquant.com/beta${path}`, {
    headers: { Authorization: `Bearer ${qqKey}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`QQ ${res.status}`);
  return res.json();
};

router.get('/trades', async (_req, res) => {
  try {
    const data = await qqFetch('/live/insiders?page_size=30');
    const trades = (Array.isArray(data) ? data : []).map((t: any) => ({
      symbol: t.Ticker || t.ticker || '',
      transactionType: (t.TransactionType || t.transaction_type || '').includes('P') ? 'Buy' : 'Sale',
      name: t.Name || t.insider_name || '',
      share: t.Shares || t.shares || 0,
      value: t.Value || t.value || 0,
      transactionDate: t.Date || t.date || '',
      title: t.Title || t.insider_title || '',
    }));
    res.json(trades);
  } catch (err) {
    console.error('[insider/trades]', err);
    try {
      const data = await qqFetch('/bulk/insiders');
      const trades = (Array.isArray(data) ? data.slice(0, 30) : []).map((t: any) => ({
        symbol: t.Ticker || t.ticker || '',
        transactionType: (t.TransactionType || t.transaction_type || '').includes('P') ? 'Buy' : 'Sale',
        name: t.Name || t.insider_name || '',
        share: t.Shares || t.shares || 0,
        value: t.Value || t.value || 0,
        transactionDate: t.Date || t.date || '',
        title: t.Title || t.insider_title || '',
      }));
      res.json(trades);
    } catch {
      res.json([]);
    }
  }
});

router.get('/congress', async (_req, res) => {
  try {
    const data = await qqFetch('/live/congresstrading?page_size=50');
    const raw = Array.isArray(data) ? data : [];

    const memberMap = new Map<string, any>();
    raw.forEach((t: any) => {
      const name = t.Representative || t.representative || '';
      if (!name) return;
      if (!memberMap.has(name)) {
        memberMap.set(name, {
          name,
          party: t.Party || t.party || '',
          state: t.State || t.state || '',
          chamber: t.Chamber || t.chamber || t.House || 'House',
          totalBuys: 0,
          totalSells: 0,
          totalTrades: 0,
          topTickers: new Set<string>(),
          trades: [],
        });
      }
      const member = memberMap.get(name)!;
      const type = (t.Transaction || t.transaction || '').toLowerCase();
      if (type.includes('purchase') || type.includes('buy')) member.totalBuys++;
      else if (type.includes('sale') || type.includes('sell')) member.totalSells++;
      member.totalTrades++;
      if (t.Ticker || t.ticker) member.topTickers.add(t.Ticker || t.ticker);
      member.trades.push({
        symbol: t.Ticker || t.ticker || '',
        type: type.includes('purchase') || type.includes('buy') ? 'purchase' : 'sale',
        amount: t.Range || t.amount || '',
        date: t.TransactionDate || t.transaction_date || '',
        assetType: t.AssetType || 'Stock',
      });
    });

    const members = Array.from(memberMap.values())
      .map((m) => ({
        ...m,
        topTickers: Array.from(m.topTickers).slice(0, 6),
      }))
      .sort((a, b) => b.totalTrades - a.totalTrades)
      .slice(0, 30);

    res.json(members);
  } catch (err) {
    console.error('[insider/congress]', err);
    try {
      const data = await qqFetch('/bulk/congresstrading');
      const raw = Array.isArray(data) ? data.slice(0, 100) : [];
      const memberMap = new Map<string, any>();
      raw.forEach((t: any) => {
        const name = t.Representative || t.representative || '';
        if (!name) return;
        if (!memberMap.has(name)) {
          memberMap.set(name, {
            name,
            party: t.Party || t.party || '',
            state: t.State || t.state || '',
            chamber: t.Chamber || t.chamber || 'House',
            totalBuys: 0,
            totalSells: 0,
            totalTrades: 0,
            topTickers: new Set<string>(),
          });
        }
        const member = memberMap.get(name)!;
        const type = (t.Transaction || t.transaction || '').toLowerCase();
        if (type.includes('purchase')) member.totalBuys++;
        else member.totalSells++;
        member.totalTrades++;
        if (t.Ticker || t.ticker) member.topTickers.add(t.Ticker || t.ticker);
      });
      const members = Array.from(memberMap.values())
        .map((m) => ({ ...m, topTickers: Array.from(m.topTickers).slice(0, 6) }))
        .sort((a, b) => b.totalTrades - a.totalTrades)
        .slice(0, 30);
      res.json(members);
    } catch {
      res.json([]);
    }
  }
});

router.get('/congress/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const data = await qqFetch('/live/congresstrading?page_size=100');
    const raw = Array.isArray(data) ? data : [];
    const memberTrades = raw.filter((t: any) => (t.Representative || t.representative) === name);

    if (memberTrades.length === 0) return res.json(null);

    const first = memberTrades[0];
    const topTickers = new Set<string>();
    let totalBuys = 0, totalSells = 0;

    const trades = memberTrades.map((t: any) => {
      const type = (t.Transaction || t.transaction || '').toLowerCase();
      if (type.includes('purchase') || type.includes('buy')) totalBuys++;
      else totalSells++;
      if (t.Ticker || t.ticker) topTickers.add(t.Ticker || t.ticker);
      return {
        symbol: t.Ticker || t.ticker || '',
        type: type.includes('purchase') || type.includes('buy') ? 'purchase' : 'sale',
        amount: t.Range || t.amount || '',
        date: t.TransactionDate || t.transaction_date || '',
        assetType: t.AssetType || 'Stock',
      };
    });

    res.json({
      name,
      party: first.Party || first.party || '',
      state: first.State || first.state || '',
      chamber: first.Chamber || first.chamber || 'House',
      totalBuys,
      totalSells,
      totalTrades: memberTrades.length,
      topTickers: Array.from(topTickers).slice(0, 6),
      trades: trades.slice(0, 20),
      bio: `${name} is a ${(first.Party || '') === 'D' ? 'Democratic' : 'Republican'} member of the ${first.Chamber || 'House'} representing ${first.State || first.state || ''}.`,
    });
  } catch (err) {
    console.error('[insider/congress/:name]', err);
    res.json(null);
  }
});

router.get('/funds', async (_req, res) => {
  try {
    const data = await qqFetch('/live/ark');
    const raw = Array.isArray(data) ? data : [];

    const fundMap = new Map<string, any>();
    raw.forEach((t: any) => {
      const fund = t.fund || t.Fund || '';
      if (!fund) return;
      if (!fundMap.has(fund)) {
        fundMap.set(fund, {
          id: fund.toLowerCase().replace(/\s+/g, '-'),
          name: `ARK ${fund} ETF`,
          ticker: fund,
          type: 'ETF',
          aum: '-',
          topHoldings: new Set<string>(),
          manager: 'Cathie Wood',
          recentTrades: [],
        });
      }
      const f = fundMap.get(fund)!;
      if (t.ticker || t.Ticker) f.topHoldings.add(t.ticker || t.Ticker);
      f.recentTrades.push({
        symbol: t.ticker || t.Ticker || '',
        action: (t.direction || t.Direction || '').includes('Buy') ? 'Buy' : 'Sell',
        shares: t.shares || t.Shares || 0,
        date: t.date || t.Date || '',
      });
    });

    const funds = Array.from(fundMap.values()).map((f) => ({
      ...f,
      topHoldings: Array.from(f.topHoldings).slice(0, 6),
      topEtfs: Array.from(f.topHoldings).slice(0, 4),
      recentTrades: f.recentTrades.slice(0, 10),
    }));

    if (funds.length === 0) {
      res.json([
        { id: 'arkk', name: 'ARK Innovation ETF', ticker: 'ARKK', type: 'ETF', aum: '$7.8B', topHoldings: ['TSLA', 'COIN', 'SQ', 'ROKU', 'ZM'], manager: 'Cathie Wood', topEtfs: ['TSLA', 'COIN', 'SQ', 'ROKU'] },
        { id: 'spy', name: 'SPDR S&P 500 ETF', ticker: 'SPY', type: 'ETF', aum: '$450B', topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], manager: 'State Street', topEtfs: ['AAPL', 'MSFT', 'NVDA', 'AMZN'] },
        { id: 'qqq', name: 'Invesco QQQ Trust', ticker: 'QQQ', type: 'ETF', aum: '$250B', topHoldings: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], manager: 'Invesco', topEtfs: ['AAPL', 'MSFT', 'NVDA', 'AMZN'] },
      ]);
      return;
    }

    res.json(funds);
  } catch (err) {
    console.error('[insider/funds]', err);
    res.json([]);
  }
});

router.get('/funds/:id', async (req, res) => {
  try {
    const fundId = req.params.id;
    const data = await qqFetch('/live/ark');
    const raw = Array.isArray(data) ? data : [];

    const fundTrades = raw.filter(
      (t: any) => (t.fund || t.Fund || '').toLowerCase().replace(/\s+/g, '-') === fundId
    );

    if (fundTrades.length === 0) return res.json(null);

    const topHoldings = new Set<string>();
    const recentTrades = fundTrades.slice(0, 15).map((t: any) => {
      const ticker = t.ticker || t.Ticker || '';
      topHoldings.add(ticker);
      return {
        symbol: ticker,
        action: (t.direction || t.Direction || '').includes('Buy') ? 'Increased' : 'Decreased',
        shares: t.shares || t.Shares || 0,
        date: t.date || t.Date || '',
      };
    });

    res.json({
      id: fundId,
      name: `ARK ${fundTrades[0]?.fund || fundId} ETF`,
      ticker: fundTrades[0]?.fund || fundId.toUpperCase(),
      type: 'ETF',
      manager: 'Cathie Wood',
      topHoldings: Array.from(topHoldings).slice(0, 10),
      recentTrades,
      sectorAllocation: [
        { sector: 'Technology', weight: 45 },
        { sector: 'Healthcare', weight: 15 },
        { sector: 'Financials', weight: 12 },
        { sector: 'Consumer', weight: 10 },
        { sector: 'Energy', weight: 8 },
        { sector: 'Other', weight: 10 },
      ],
    });
  } catch (err) {
    console.error('[insider/funds/:id]', err);
    res.json(null);
  }
});

export default router;
