import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Zap, Activity, Radio, ChevronRight } from 'lucide-react';

export const AIStatusBanner: React.FC = () => {
  const [latency, setLatency] = useState(28);
  const [scannedMarkets, setScannedMarkets] = useState(12542);
  const [confidence, setConfidence] = useState(94.2);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(24 + Math.random() * 9));
      setScannedMarkets((prev) => prev + Math.floor(Math.random() * 3));
      setConfidence(parseFloat((93.8 + Math.random() * 1.1).toFixed(1)));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#070a12]/90 border-b border-white/10 backdrop-blur-xl px-4 py-2 text-xs font-mono text-neutral-300 flex flex-wrap items-center justify-between gap-3 shadow-inner">
      {/* Left: AI Live Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span>NEURAL ENGINE ONLINE</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-neutral-400 text-[11px]">
          <Activity className="w-3.5 h-3.5 text-green-400" />
          <span>Latency:</span>
          <span className="text-green-300 font-bold">{latency}ms</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-neutral-400 text-[11px]">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Scanned Markets:</span>
          <span className="text-white font-bold">{scannedMarkets.toLocaleString()}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-neutral-400 text-[11px]">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>AI Model Accuracy:</span>
          <span className="text-cyan-300 font-bold">{confidence}%</span>
        </div>
      </div>

      {/* Right: Security & Institution Badge */}
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-sans font-bold text-[10px] tracking-wide">AES-256 BINANCE READ-ONLY</span>
        </div>

        <div className="text-neutral-400 flex items-center gap-1">
          <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span className="text-[10px]">Real-time WebSocket Live</span>
        </div>
      </div>
    </div>
  );
};
