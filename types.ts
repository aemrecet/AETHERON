export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  marketCap: string;
  sector: string;
  market: 'BIST' | 'NASDAQ' | 'CRYPTO';
  dayHigh: number;
  dayLow: number;
  logo?: string;
  coinId?: string;
  data: { time: string; value: number }[];
}

export enum TabView {
  ASK = 'ASK',
  MARKETS = 'MARKETS',
  PULSE = 'PULSE',
  ONCHAIN = 'ONCHAIN',
  INSIDER = 'INSIDER',
  NEWS = 'NEWS',
  STOCK_DETAIL = 'STOCK_DETAIL',
  CONGRESS_DETAIL = 'CONGRESS_DETAIL',
  FUND_DETAIL = 'FUND_DETAIL',
}

export interface NewsItem {
  id: number;
  title: string;
  source: string;
  time: string;
  category: string;
  sentiment?: 'Bullish' | 'Bearish' | 'Neutral';
  confidence?: number;
  url: string;
  imageUrl?: string;
  datetime?: number;
}