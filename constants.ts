import { Stock, NewsItem } from './types';

// Helper to generate realistic-looking monthly data (approx 45 points for smoothness)
export const generateMonthlyData = (basePrice: number, volatility: number) => {
  let currentPrice = basePrice;
  const days = 45;
  const data = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));
    
    // Random walk
    const change = (Math.random() - 0.5) * volatility;
    currentPrice += change;
    
    // Format: "Nov 12"
    const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    data.push({
      time: timeStr,
      value: Math.max(0.1, currentPrice)
    });
  }
  // Ensure the last point is exactly the current price? 
  // In a real app we'd append the real price, but for this mock generator 
  // we just let it flow to the basePrice approximately.
  return data;
};

export const INITIAL_STOCKS: Stock[] = [
  // NASDAQ
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 185.92,
    change: 1.25,
    changePercent: 0.68,
    volume: '45.2M',
    marketCap: '2.95T',
    sector: 'Technology',
    market: 'NASDAQ',
    dayHigh: 187.00,
    dayLow: 184.50,
    data: generateMonthlyData(180, 4)
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    price: 242.50,
    change: -3.40,
    changePercent: -1.38,
    volume: '98.1M',
    marketCap: '780B',
    sector: 'Automotive',
    market: 'NASDAQ',
    dayHigh: 248.00,
    dayLow: 239.10,
    data: generateMonthlyData(240, 8)
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corp.',
    price: 890.15,
    change: 12.45,
    changePercent: 1.42,
    volume: '32.5M',
    marketCap: '2.2T',
    sector: 'Semiconductors',
    market: 'NASDAQ',
    dayHigh: 895.50,
    dayLow: 882.00,
    data: generateMonthlyData(850, 15)
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    price: 420.50,
    change: 2.10,
    changePercent: 0.50,
    volume: '22.1M',
    marketCap: '3.1T',
    sector: 'Technology',
    market: 'NASDAQ',
    dayHigh: 422.00,
    dayLow: 418.00,
    data: generateMonthlyData(410, 5)
  },
  
  // CRYPTO
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 68500.00,
    change: 1200.00,
    changePercent: 1.78,
    volume: '28.4B',
    marketCap: '1.35T',
    sector: 'Crypto',
    market: 'CRYPTO',
    dayHigh: 69000.00,
    dayLow: 67200.00,
    data: generateMonthlyData(65000, 1200)
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3500.20,
    change: -45.00,
    changePercent: -1.27,
    volume: '12.1B',
    marketCap: '420B',
    sector: 'Crypto',
    market: 'CRYPTO',
    dayHigh: 3580.00,
    dayLow: 3450.00,
    data: generateMonthlyData(3400, 80)
  },

  // BIST (New)
  {
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    price: 305.50,
    change: 4.50,
    changePercent: 1.49,
    volume: '12.5B',
    marketCap: '420B TRY',
    sector: 'Transportation',
    market: 'BIST',
    dayHigh: 308.00,
    dayLow: 299.50,
    data: generateMonthlyData(290, 6)
  },
  {
    symbol: 'ASELS',
    name: 'Aselsan',
    price: 62.40,
    change: -0.80,
    changePercent: -1.26,
    volume: '4.2B',
    marketCap: '280B TRY',
    sector: 'Defense',
    market: 'BIST',
    dayHigh: 63.50,
    dayLow: 61.80,
    data: generateMonthlyData(60, 1.5)
  },
  {
    symbol: 'GARAN',
    name: 'Garanti BBVA',
    price: 84.15,
    change: 1.15,
    changePercent: 1.38,
    volume: '8.1B',
    marketCap: '350B TRY',
    sector: 'Finance',
    market: 'BIST',
    dayHigh: 85.00,
    dayLow: 82.50,
    data: generateMonthlyData(80, 2)
  },
  {
    symbol: 'KCHOL',
    name: 'Koç Holding',
    price: 212.00,
    change: 0.00,
    changePercent: 0.00,
    volume: '3.5B',
    marketCap: '530B TRY',
    sector: 'Holding',
    market: 'BIST',
    dayHigh: 214.50,
    dayLow: 210.00,
    data: generateMonthlyData(205, 4)
  }
];

export const MOCK_NEWS: NewsItem[] = [
  { id: 1, title: "AI Analysis: Bullish divergence detected on NVDA hourly chart.", source: "Aethron AI", time: "Just now", category: "AI Analysis", sentiment: "Bullish", url: "#" },
  { id: 2, title: "BIST 100 breaks historical record led by banking sector rally.", source: "ForexNews", time: "1h ago", category: "Stocks", sentiment: "Bullish", url: "#" },
  { id: 3, title: "Fed signals potential rate cuts later this year as inflation cools.", source: "Bloomberg", time: "2h ago", category: "Macro", sentiment: "Bullish", url: "#" },
  { id: 4, title: "Bitcoin surges past $68k as ETF inflows hit record highs.", source: "CoinDesk", time: "4h ago", category: "Crypto", sentiment: "Bullish", url: "#" },
];