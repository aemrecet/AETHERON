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
    const FINNHUB_KEY = await getApiKey('FINNHUB');
    const symbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'GOOGL'];
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);

    const allTrades: any[] = [];
    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${sym}&from=${from.toISOString().split('T')[0]}&to=${now.toISOString().split('T')[0]}&token=${FINNHUB_KEY}`;
        const r = await fetch(url);
        if (!r.ok) return [];
        const data = await r.json();
        return (data?.data || []).slice(0, 10).map((t: any) => ({
          symbol: sym,
          transactionType: t.transactionType || (t.change > 0 ? 'Buy' : 'Sale'),
          name: t.name || '',
          share: Math.abs(t.share || t.change || 0),
          value: Math.abs((t.share || t.change || 0) * (t.transactionPrice || 0)),
          transactionDate: t.transactionDate || t.filingDate || '',
          title: t.name || '',
          transactionPrice: t.transactionPrice || 0,
          source: 'Finnhub',
        }));
      })
    );

    results.forEach((r) => {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) allTrades.push(...r.value);
    });

    if (allTrades.length > 0) {
      allTrades.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
      return res.json(allTrades.slice(0, 50));
    }

    const qqData = await qqFetch('/live/insiders?page_size=30');
    const trades = (Array.isArray(qqData) ? qqData : []).map((t: any) => ({
      symbol: t.Ticker || t.ticker || '',
      transactionType: (t.TransactionType || t.transaction_type || '').includes('P') ? 'Buy' : 'Sale',
      name: t.Name || t.insider_name || '',
      share: t.Shares || t.shares || 0,
      value: t.Value || t.value || 0,
      transactionDate: t.Date || t.date || '',
      title: t.Title || t.insider_title || '',
      source: 'QuiverQuant',
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
        source: 'QuiverQuant',
      }));
      res.json(trades);
    } catch {
      res.json([]);
    }
  }
});

router.get('/congress', async (_req, res) => {
  try {
    let raw: any[] = [];
    let source = 'HouseStockWatcher';

    try {
      const hswRes = await fetch('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json');
      if (hswRes.ok) {
        const hswData = await hswRes.json();
        raw = Array.isArray(hswData) ? hswData.slice(-200) : [];
      }
    } catch {
      source = 'QuiverQuant';
    }

    if (raw.length === 0) {
      const qqData = await qqFetch('/live/congresstrading?page_size=50');
      raw = Array.isArray(qqData) ? qqData : [];
      source = 'QuiverQuant';
    }

    const memberMap = new Map<string, any>();

    if (source === 'HouseStockWatcher') {
      raw.forEach((t: any) => {
        const name = t.representative || '';
        if (!name) return;
        if (!memberMap.has(name)) {
          memberMap.set(name, {
            name,
            party: t.party || '',
            state: t.state || '',
            chamber: t.type === 'Senator' ? 'Senate' : 'House',
            totalBuys: 0,
            totalSells: 0,
            totalTrades: 0,
            topTickers: new Set<string>(),
            trades: [],
          });
        }
        const member = memberMap.get(name)!;
        const type = (t.type_of_transaction || t.transaction_type || '').toLowerCase();
        if (type.includes('purchase') || type.includes('buy')) member.totalBuys++;
        else if (type.includes('sale') || type.includes('sell')) member.totalSells++;
        member.totalTrades++;
        if (t.ticker) member.topTickers.add(t.ticker);
        member.trades.push({
          symbol: t.ticker || '',
          type: type.includes('purchase') || type.includes('buy') ? 'purchase' : 'sale',
          amount: t.amount || '',
          date: t.transaction_date || '',
          assetType: t.asset_description || 'Stock',
          source: 'HouseStockWatcher',
        });
      });
    } else {
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
          source: 'QuiverQuant',
        });
      });
    }

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
    res.json([]);
  }
});

router.get('/congress/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    let raw: any[] = [];
    let source = 'HouseStockWatcher';

    try {
      const hswRes = await fetch('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json');
      if (hswRes.ok) {
        const hswData = await hswRes.json();
        raw = (Array.isArray(hswData) ? hswData : []).filter((t: any) => t.representative === name);
      }
    } catch {}

    if (raw.length === 0) {
      const qqData = await qqFetch('/live/congresstrading?page_size=100');
      raw = (Array.isArray(qqData) ? qqData : []).filter((t: any) => (t.Representative || t.representative) === name);
      source = 'QuiverQuant';
    }

    if (raw.length === 0) return res.json(null);

    const first = raw[0];
    const topTickers = new Set<string>();
    let totalBuys = 0, totalSells = 0;

    const trades = raw.map((t: any) => {
      let type: string;
      if (source === 'HouseStockWatcher') {
        type = (t.type_of_transaction || t.transaction_type || '').toLowerCase();
      } else {
        type = (t.Transaction || t.transaction || '').toLowerCase();
      }

      if (type.includes('purchase') || type.includes('buy')) totalBuys++;
      else totalSells++;

      const ticker = source === 'HouseStockWatcher'
        ? (t.ticker || '')
        : (t.Ticker || t.ticker || '');
      if (ticker) topTickers.add(ticker);

      return {
        symbol: ticker,
        type: type.includes('purchase') || type.includes('buy') ? 'purchase' : 'sale',
        amount: source === 'HouseStockWatcher' ? (t.amount || '') : (t.Range || t.amount || ''),
        date: source === 'HouseStockWatcher' ? (t.transaction_date || '') : (t.TransactionDate || t.transaction_date || ''),
        assetType: source === 'HouseStockWatcher' ? (t.asset_description || 'Stock') : (t.AssetType || 'Stock'),
      };
    });

    const party = source === 'HouseStockWatcher' ? (first.party || '') : (first.Party || first.party || '');
    const state = source === 'HouseStockWatcher' ? (first.state || '') : (first.State || first.state || '');
    const chamber = source === 'HouseStockWatcher'
      ? (first.type === 'Senator' ? 'Senate' : 'House')
      : (first.Chamber || first.chamber || 'House');

    res.json({
      name,
      party,
      state,
      chamber,
      totalBuys,
      totalSells,
      totalTrades: raw.length,
      topTickers: Array.from(topTickers).slice(0, 6),
      trades: trades.slice(0, 20),
      bio: `${name} is a ${party === 'D' ? 'Democratic' : 'Republican'} member of the ${chamber} representing ${state}.`,
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
