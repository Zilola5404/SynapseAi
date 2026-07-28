import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { CryptoAsset, Candlestick } from '../types';
import { TrendingUp, TrendingDown, Layers, Activity, RefreshCw } from 'lucide-react';

interface TradingChartProps {
  assets: CryptoAsset[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onScanAI: () => void;
  isScanning: boolean;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  assets,
  selectedSymbol,
  onSelectSymbol,
  onScanAI,
  isScanning,
}) => {
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h'>('15m');
  const [showRsi, setShowRsi] = useState(true);
  const [showMacd, setShowMacd] = useState(true);

  const currentAsset = assets.find((a) => a.symbol === selectedSymbol) || assets[0];

  // Generate responsive candle & indicator history based on asset price & volatility
  const chartData = useMemo(() => {
    if (!currentAsset) return [];
    const basePrice = currentAsset.price;
    const count = 30;
    const items: Candlestick[] = [];

    let curClose = basePrice * (1 - (currentAsset.change24h / 100) * 0.8);

    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const changePct = (Math.sin(i * 0.7) * 0.012) + ((Math.random() - 0.48) * 0.008);
      const open = curClose;
      const close = isLast ? currentAsset.price : open * (1 + changePct);
      const high = Math.max(open, close) * (1 + Math.random() * 0.004);
      const low = Math.min(open, close) * (1 - Math.random() * 0.004);
      const volume = Math.round(100000 + Math.random() * 500000);

      // RSI approximation
      const rsiVal = Number((50 + Math.sin(i * 0.5) * 20 + (currentAsset.change24h * 2)).toFixed(1));
      const macdVal = Number((Math.sin(i * 0.4) * (basePrice * 0.003)).toFixed(2));

      // AI Signals simulation on specific candles
      let signal: 'BUY' | 'SELL' | null = null;
      if (i === count - 6 && rsiVal < 42) signal = 'BUY';
      if (i === count - 18 && rsiVal > 68) signal = 'SELL';
      if (isLast && currentAsset.rsi < 40) signal = 'BUY';

      const d = new Date(Date.now() - (count - i) * (timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : 900000));
      const timeLabel = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      items.push({
        timestamp: d.toISOString(),
        timeLabel,
        open: Number(open.toFixed(basePrice > 100 ? 2 : 4)),
        high: Number(high.toFixed(basePrice > 100 ? 2 : 4)),
        low: Number(low.toFixed(basePrice > 100 ? 2 : 4)),
        close: Number(close.toFixed(basePrice > 100 ? 2 : 4)),
        volume,
        rsi: rsiVal,
        macd: macdVal,
        signal,
      });

      curClose = close;
    }

    return items;
  }, [currentAsset, timeframe]);

  const isPositive = (currentAsset?.change24h || 0) >= 0;

  return (
    <div className="glass-card rounded-2xl p-5 shadow-2xl mb-6">
      {/* Top Asset Selector & Timeframe Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4">
        {/* Asset Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
          {assets.map((asset) => {
            const isSelected = asset.symbol === selectedSymbol;
            const pos = asset.change24h >= 0;
            return (
              <button
                key={asset.symbol}
                onClick={() => onSelectSymbol(asset.symbol)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? 'bg-green-500 text-black font-bold shadow-lg shadow-green-500/20'
                    : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <span>{asset.symbol}</span>
                <span className={`font-mono text-[11px] ${isSelected ? 'text-black/80 font-bold' : pos ? 'text-green-400' : 'text-red-400'}`}>
                  {pos ? '+' : ''}{asset.change24h.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Timeframe & Action Bar */}
        <div className="flex items-center gap-2">
          <div className="flex bg-black/60 rounded-xl p-0.5 border border-white/10">
            {(['1m', '5m', '15m', '1h', '4h'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition ${
                  timeframe === tf ? 'bg-green-500 text-black shadow' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            onClick={onScanAI}
            disabled={isScanning}
            className="px-3.5 py-1.5 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black font-bold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Анализ AI...' : 'AI Сканирование'}</span>
          </button>
        </div>
      </div>

      {/* Ticker Live Info Header */}
      {currentAsset && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-black/50 rounded-xl p-3.5 mb-4 border border-white/10">
          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">Пара / Название</div>
            <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{currentAsset.symbol}</span>
              <span className="text-xs font-normal text-neutral-400">({currentAsset.name})</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">Текущая цена</div>
            <div className={`text-xl font-bold font-mono mt-0.5 ${isPositive ? 'text-green-400 neon-glow' : 'text-red-400'}`}>
              ${currentAsset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">24ч High / Low</div>
            <div className="text-xs font-mono text-neutral-300 mt-1">
              ${currentAsset.high24h} / ${currentAsset.low24h}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">Индикатор RSI (14)</div>
            <div className={`text-sm font-bold font-mono mt-0.5 ${currentAsset.rsi > 70 ? 'text-red-400' : currentAsset.rsi < 35 ? 'text-green-400' : 'text-neutral-200'}`}>
              {currentAsset.rsi} {currentAsset.rsi > 70 ? '(Перекуплен)' : currentAsset.rsi < 35 ? '(Перепродан)' : ''}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">Стакан покупателей</div>
            <div className="text-sm font-bold font-mono text-green-400 mt-0.5">
              {currentAsset.orderBookImbalance > 0 ? `+${currentAsset.orderBookImbalance}% Buy Wall` : `${currentAsset.orderBookImbalance}% Sell Wall`}
            </div>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="timeLabel" stroke="#737373" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="price"
              domain={['dataMin - 5', 'dataMax + 5']}
              orientation="right"
              stroke="#737373"
              tick={{ fontSize: 11 }}
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0e0e0e', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', fontSize: '12px', color: '#e5e5e5' }}
              formatter={(value: any, name: string) => [
                typeof value === 'number' ? `$${value.toFixed(2)}` : value,
                name === 'close' ? 'Цена закрытия' : name === 'rsi' ? 'RSI (14)' : name
              ]}
            />

            {/* Volume bars */}
            <Bar dataKey="volume" yAxisId="price" fill="#262626" opacity={0.6} barSize={6} />

            {/* Price Line */}
            <Line
              type="monotone"
              dataKey="close"
              yAxisId="price"
              stroke={isPositive ? '#22c55e' : '#ef4444'}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload?.signal === 'BUY') {
                  return (
                    <g key={`buy-${cx}`}>
                      <circle cx={cx} cy={cy} r={6} fill="#22c55e" stroke="#ffffff" strokeWidth={1.5} />
                      <text x={cx} y={cy - 12} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight="bold">
                        AI BUY
                      </text>
                    </g>
                  );
                }
                if (payload?.signal === 'SELL') {
                  return (
                    <g key={`sell-${cx}`}>
                      <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                      <text x={cx} y={cy + 18} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight="bold">
                        AI SELL
                      </text>
                    </g>
                  );
                }
                return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={0} />;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Sub-Chart Indicators Toggle Bar */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-2 text-xs text-neutral-400">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showRsi}
              onChange={(e) => setShowRsi(e.target.checked)}
              className="rounded bg-black border-white/20 text-green-500 focus:ring-0"
            />
            <span>RSI (14)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showMacd}
              onChange={(e) => setShowMacd(e.target.checked)}
              className="rounded bg-black border-white/20 text-green-500 focus:ring-0"
            />
            <span>MACD (12, 26, 9)</span>
          </label>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]"></span>
          <span>Зеленые метки = Сигналы входа Synapse AI</span>
        </div>
      </div>
    </div>
  );
};
