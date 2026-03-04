import React from 'react';
import { Stock } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  stock: Stock;
  onClick?: (stock: Stock) => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({ stock, onClick }) => {
  const isPositive = stock.changePercent >= 0;
  const chartColor = isPositive ? '#22c990' : '#f06570';
  const chartGradientId = `gradient-${stock.symbol}`;

  return (
    <div
      className="card card-interactive px-4 py-3.5 flex items-center gap-3"
      onClick={() => onClick?.(stock)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {stock.logo ? (
          <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'rgba(14, 24, 42, 0.6)', border: '1px solid rgba(120, 160, 220, 0.1)' }}>
            <img src={stock.logo} alt={stock.symbol} className="w-6 h-6 object-contain" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold text-[#9cb4d4]" style={{ background: 'rgba(14, 24, 42, 0.6)', border: '1px solid rgba(120, 160, 220, 0.1)' }}>
            {stock.symbol.slice(0, 2)}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[#eaf2ff] truncate">{stock.symbol}</p>
          <p className="text-[10px] text-[#6b84a8] truncate">{stock.name}</p>
        </div>
      </div>

      <div className="w-[72px] h-[32px] opacity-70 hover:opacity-100 transition-opacity shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stock.data}>
            <defs>
              <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={1.5} fill={`url(#${chartGradientId})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="text-right shrink-0 min-w-[80px]">
        <p className="text-[13px] font-semibold text-[#eaf2ff] tabular-nums font-mono">
          ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <span
          className={`inline-block text-[11px] font-semibold tabular-nums font-mono mt-0.5 px-1.5 py-0.5 rounded ${isPositive ? 'text-[#34e8a8] bg-[rgba(34,201,144,0.1)]' : 'text-[#ff8b93] bg-[rgba(240,101,112,0.1)]'}`}
        >
          {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};
