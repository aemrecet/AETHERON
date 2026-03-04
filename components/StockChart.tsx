import React, { useRef, useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Stock } from '../types';

interface StockChartProps {
  data: Stock['data'];
  color?: string;
  showGrid?: boolean;
  range?: string;
}

const CustomTooltip = ({ active, payload, label, color, range, dataMin, dataMax }: any) => {
  if (active && payload && payload.length) {
    let displayDate = label || '';
    if (label) {
      try {
        const d = new Date(label);
        if (!isNaN(d.getTime())) {
          if (range === '1D') {
            displayDate = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          } else {
            displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
        }
      } catch {}
    }
    const currentVal = payload[0].value;
    return (
      <div className="px-3 py-2 rounded-md" style={{ background: 'rgba(9,15,24,0.96)', border: `1px solid ${color}33`, boxShadow: `0 0 20px ${color}15, 0 4px 12px rgba(0,0,0,0.6)` }}>
        <p className="text-[9px] font-mono mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>{displayDate}</p>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Low</p>
            <p className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: '#ef4444' }}>
              ${dataMin?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>High</p>
            <p className="text-[11px] font-mono font-semibold tabular-nums" style={{ color: '#10b981' }}>
              ${dataMax?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Current</p>
            <p className="text-[12px] font-mono font-bold tabular-nums" style={{ color }}>
              ${currentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const StockChart: React.FC<StockChartProps> = ({ data, color = '#10b981', showGrid = true, range = '1D' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf: number;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        setDimensions(prev => (prev.width === w && prev.height === h) ? prev : { width: w, height: h });
      }
    };
    raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [data]);

  const { values, min, max, padding } = useMemo(() => {
    if (!data || data.length === 0) return { values: [], min: 0, max: 0, padding: 0 };
    const vals = data.map(d => d.value);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pd = (mx - mn) * 0.08;
    return { values: vals, min: mn, max: mx, padding: pd };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ minHeight: '160px' }}>
        <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>No chart data</p>
      </div>
    );
  }

  const showYAxis = dimensions.width > 300;
  const gradientId = `glow-${color.replace('#', '')}`;
  const glowFilterId = `line-glow-${color.replace('#', '')}`;

  const formatXTick = (value: string) => {
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '';
      if (range === '1D') {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full select-none" style={{ minHeight: '160px', minWidth: '100px' }}>
      {dimensions.width > 10 && dimensions.height > 10 && (
        <AreaChart width={dimensions.width} height={dimensions.height} data={data} margin={{ top: 10, right: showYAxis ? 2 : 10, left: 10, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="40%" stopColor={color} stopOpacity={0.10} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id={glowFilterId}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="none" 
            stroke="rgba(152, 181, 223, 0.20)"
            vertical={true}
            horizontal={true}
          />
          
          <XAxis 
            dataKey="time" 
            axisLine={{ stroke: 'rgba(152, 181, 223, 0.28)' }}
            tickLine={false}
            tick={{ fill: '#90add1', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
            tickFormatter={formatXTick}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          
          <YAxis 
            domain={[min - padding, max + padding]} 
            tick={{ fill: '#90add1', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(val) => `$${val.toFixed(2)}`}
            orientation="right"
            hide={!showYAxis}
          />
          
          <Tooltip
            content={<CustomTooltip color={color} range={range} dataMin={min} dataMax={max} />}
            cursor={{ stroke: `${color}55`, strokeWidth: 1, strokeDasharray: '4 4' }}
            isAnimationActive={true}
            animationDuration={80}
            animationEasing="ease-out"
          />
          
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            animationDuration={800}
            style={{ filter: `url(#${glowFilterId})` }}
            activeDot={{ 
              r: 4, 
              strokeWidth: 2, 
              stroke: color, 
              fill: '#08111d',
              style: { filter: `drop-shadow(0 0 6px ${color})` }
            }}
          />
        </AreaChart>
      )}
    </div>
  );
};
