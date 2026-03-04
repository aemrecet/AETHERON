import React from 'react';
import { Stock } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  stock: Stock;
  onClick?: (stock: Stock) => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({ stock, onClick }) => {
  const isPositive = stock.changePercent >= 0;
  const chartColor = isPositive ? '#00c076' : '#ff3b3b';
  const chartGradientId = `gradient-${stock.symbol}`;

  return (
    <div
      className="card card-interactive px-4 py-3 flex items-center gap-3"
      onClick={() => onClick?.(stock)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {stock.logo ? (
          <div className="w-8 h-8 rounded-[3px] overflow-hidden shrink-0 flex items-center justify-center bg-[#111] border border-[#1e1e1e]">
            <img src={stock.logo} alt={stock.symbol} className="w-5 h-5 object-contain" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-[3px] flex items-center justify-center shrink-0 text-[10px] font-bold text-[#555] bg-[#111] border border-[#1e1e1e] font-mono">
            {stock.symbol.slice(0, 2)}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white truncate font-mono">{stock.symbol}</p>
          <p className="text-[10px] text-[#555] truncate">{stock.name}</p>
        </div>
      </div>

      <div className="w-[64px] h-[28px] opacity-60 hover:opacity-100 transition-opacity shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stock.data}>
            <defs>
              <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.15} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={1.2} fill={`url(#${chartGradientId})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-right shrink-0 min-w-[80px]">
        <p className="text-[12px] font-semibold text-white tabular-nums font-mono">
          ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <span className={`inline-block text-[11px] font-semibold tabular-nums font-mono mt-0.5 ${isPositive ? 'text-[#00c076]' : 'text-[#ff3b3b]'}`}>
          {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};
