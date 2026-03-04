import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { AskView } from './components/AskView';
import { MarketsView } from './components/MarketsView';
import { NewsView } from './components/NewsView';
import { CryptoPulseView } from './components/CryptoPulseView';
import { StockDetailView } from './components/StockDetailView';
import { InsiderView } from './components/InsiderView';
import { CongressDetailView } from './components/CongressDetailView';
import { FundDetailView } from './components/FundDetailView';
import { OnChainView } from './components/OnChainView';
import { TabView, Stock, NewsItem } from './types';
import { INITIAL_STOCKS, MOCK_NEWS } from './constants';
import { fetchAllMarketData, fetchNews } from './services/marketDataService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>(TabView.ASK);
  const [stocks, setStocks] = useState<Stock[]>(INITIAL_STOCKS);
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [selectedStock, setSelectedStock] = useState<Stock>(INITIAL_STOCKS[0]);
  const [loading, setLoading] = useState(true);
  const [selectedCongressMember, setSelectedCongressMember] = useState('');
  const [selectedFundId, setSelectedFundId] = useState('');

  useEffect(() => {
    const initData = async () => {
      try {
        const { stocks: realStocks, news: realNews } = await fetchAllMarketData();
        if (realStocks.length > 0) {
          setStocks(realStocks);
          const currentSelected = realStocks.find(s => s.symbol === selectedStock.symbol);
          setSelectedStock(currentSelected || realStocks[0]);
        }
        if (realNews.length > 0) setNews(realNews);
      } catch (e) {
        console.error("Fatal data fetch error", e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const refreshNews = useCallback(async () => {
    try {
      const freshNews = await fetchNews();
      if (freshNews.length > 0) setNews(freshNews);
    } catch (e) { console.warn('[News] Refresh failed', e); }
  }, []);

  useEffect(() => {
    if (loading) return;
    const newsInterval = setInterval(refreshNews, 5 * 60 * 1000);
    return () => clearInterval(newsInterval);
  }, [loading, refreshNews]);

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      setStocks(currentStocks =>
        currentStocks.map(stock => {
          const volatility = stock.price * 0.0002;
          const change = (Math.random() - 0.5) * volatility;
          return { ...stock, price: stock.price + change };
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const updated = stocks.find(s => s.symbol === selectedStock.symbol);
    if (updated) setSelectedStock(updated);
  }, [stocks, selectedStock.symbol]);

  const handleStockClick = (stock: Stock) => { setSelectedStock(stock); setActiveTab(TabView.STOCK_DETAIL); };
  const handleBackToMarkets = () => setActiveTab(TabView.MARKETS);
  const handleAnalyzeStock = () => { setActiveTab(TabView.ASK); };
  const handleCongressMemberClick = (name: string) => { setSelectedCongressMember(name); setActiveTab(TabView.CONGRESS_DETAIL); };
  const handleFundClick = (id: string) => { setSelectedFundId(id); setActiveTab(TabView.FUND_DETAIL); };
  const handleBackToInsider = () => setActiveTab(TabView.INSIDER);

  const renderContent = () => {
    switch (activeTab) {
      case TabView.ASK: return <AskView stocks={stocks} />;
      case TabView.MARKETS: return <MarketsView stocks={stocks} onStockSelect={handleStockClick} />;
      case TabView.PULSE: return <CryptoPulseView />;
      case TabView.ONCHAIN: return <OnChainView />;
      case TabView.INSIDER: return <InsiderView onCongressMemberClick={handleCongressMemberClick} onFundClick={handleFundClick} />;
      case TabView.CONGRESS_DETAIL: if (!selectedCongressMember) { setActiveTab(TabView.INSIDER); return null; } return <CongressDetailView memberName={selectedCongressMember} onBack={handleBackToInsider} />;
      case TabView.FUND_DETAIL: if (!selectedFundId) { setActiveTab(TabView.INSIDER); return null; } return <FundDetailView fundId={selectedFundId} onBack={handleBackToInsider} />;
      case TabView.NEWS: return <NewsView news={news} onRefresh={refreshNews} />;
      case TabView.STOCK_DETAIL: return <StockDetailView stock={selectedStock} news={news} onBack={handleBackToMarkets} onAnalyze={handleAnalyzeStock} />;
      default: return <AskView stocks={stocks} />;
    }
  };

  return (
    <div className="min-h-screen font-sans text-[var(--color-text-primary)] relative">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="relative z-10 w-full pb-16 md:pt-[48px] md:pb-0 min-h-screen flex flex-col">
        <div className={`flex-1 ${activeTab !== TabView.ASK ? 'px-3 sm:px-4 lg:px-6 pt-4 pb-6 w-full mx-auto' : ''}`}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
