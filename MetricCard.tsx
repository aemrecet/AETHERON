import React from 'react';
import { Stock } from '../types';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  stock: Stock;
  onSelect: (stock: Stock) => void;
  selected: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ stock, onSelect, selected }) => {
  const isPositive = stock.change >= 0;
  const color = isPositive ? '#059669' : '#dc2626';
  const hasData = stock.data && stock.data.length > 0;

  return (
    <div 
        onClick={() => onSelect(stock)}
        className={`relative rounded-lg p-5 md:p-6 cursor-pointer group overflow-hidden card-interactive ${
          selected ? 'ring-2 ring-[#4c8bf5]/20' : ''
        }`}
        style={{
          background: 'var(--color-surface)',
          border: `1px solid ${selected ? '#1e3a6e' : 'var(--color-border)'}`,
          boxShadow: 'var(--shadow-xs)',
        }}
    >
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 min-w-0">
                {stock.logo ? (
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center overflow-hidden shrink-0 p-1.5" style={{ background: '#16171c', border: '1px solid var(--color-border-subtle)' }}>
                    <img src={stock.logo} alt={stock.symbol} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-lg flex items-center justify-center font-semibold text-[12px] shrink-0" style={{ background: '#16171c', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-tertiary)' }}>
                      {stock.symbol.substring(0,2)}
                  </div>
                )}
                <div className="overflow-hidden min-w-0">
                    <span className="font-semibold text-[15px] block tracking-[-0.01em] truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>{stock.symbol}</span>
                    <span className="text-[11px] truncate block mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{stock.name}</span>
                </div>
            </div>
        </div>

        <div className="flex items-end justify-between">
          <span className="text-[20px] md:text-[22px] font-mono font-semibold tracking-[-0.02em] tabular-nums leading-none" style={{ color: 'var(--color-text-primary)' }}>${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span className={`badge text-[12px] font-mono font-semibold tabular-nums ${isPositive ? 'badge-positive' : 'badge-negative'}`}>
              {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>
      
      {hasData && (
        <div className="absolute bottom-0 left-0 right-0 opacity-8 group-hover:opacity-15 transition-opacity duration-500" style={{ height: '50px' }}>
            <ResponsiveContainer width="100%" height={50}>
                <AreaChart data={stock.data}>
                    <defs>
                        <linearGradient id={`mini-grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={color} 
                        strokeWidth={1.5} 
                        fill={`url(#mini-grad-${stock.symbol})`} 
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
