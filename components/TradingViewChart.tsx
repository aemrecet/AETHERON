import React, { useEffect, useRef } from 'react';
import { Stock } from '../types';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartProps {
  stock: Stock;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ stock }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let tvSymbol = stock.symbol;
    if (stock.market === 'CRYPTO') {
        tvSymbol = `BINANCE:${stock.symbol}USDT`;
    } else if (stock.market === 'BIST') {
        tvSymbol = `BIST:${stock.symbol}`;
    } else {
        tvSymbol = `${stock.market}:${stock.symbol}`;
    }

    let script = document.getElementById('tv-widget-script') as HTMLScriptElement | null;
    
    const initWidget = () => {
       if (window.TradingView && containerRef.current) {
           new window.TradingView.widget({
               "autosize": true,
               "symbol": tvSymbol,
               "interval": "D",
               "timezone": "Etc/UTC",
               "theme": "light",
               "style": "1",
               "locale": "en",
               "enable_publishing": false,
               "backgroundColor": "rgba(255, 255, 255, 1)",
               "gridColor": "rgba(0, 0, 0, 0.04)",
               "hide_top_toolbar": false,
               "hide_legend": false,
               "save_image": false,
               "container_id": containerRef.current.id,
               "toolbar_bg": "#ffffff",
               "allow_symbol_change": true,
               "details": true,
               "hotlist": true,
               "calendar": true,
           });
       }
    };

    if (!script) {
        script = document.createElement('script');
        script.id = 'tv-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = initWidget;
        document.head.appendChild(script);
    } else {
        initWidget();
    }

  }, [stock]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-[#e2e5ea]">
       <div id={`tradingview_${stock.symbol}`} ref={containerRef} className="w-full h-full min-h-[500px]" />
    </div>
  );
};
