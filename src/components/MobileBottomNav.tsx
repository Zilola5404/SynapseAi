import React from 'react';
import { Home, Bot, Wallet, Zap, User } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: 'landing' | 'dashboard';
  activeTab?: string;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onOpenAIProfile: () => void;
  onOpenManualTrade: () => void;
  onOpenProfile: () => void;
  isScanning?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigateHome,
  onNavigateDashboard,
  onOpenAIProfile,
  onOpenManualTrade,
  onOpenProfile,
  isScanning = false,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#070a12]/95 border-t border-white/10 backdrop-blur-2xl px-2 py-2 text-xs font-mono shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
      <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
        {/* 1. Home / Landing */}
        <button
          onClick={onNavigateHome}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
            currentView === 'landing'
              ? 'text-cyan-400 bg-cyan-500/10 font-bold border border-cyan-500/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          <span className="text-[10px] mt-1 tracking-tight">Home</span>
        </button>

        {/* 2. AI Intelligence */}
        <button
          onClick={onOpenAIProfile}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-400 hover:text-cyan-400 transition relative"
        >
          <div className="relative">
            <Bot className="w-4 h-4 text-cyan-400" />
            {isScanning && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">AI Agent</span>
        </button>

        {/* 3. Dashboard / Portfolio */}
        <button
          onClick={onNavigateDashboard}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
            currentView === 'dashboard'
              ? 'text-emerald-400 bg-emerald-500/10 font-bold border border-emerald-500/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[10px] mt-1 tracking-tight">Portfolio</span>
        </button>

        {/* 4. Signals / Trade */}
        <button
          onClick={onOpenManualTrade}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-400 hover:text-amber-400 transition"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] mt-1 tracking-tight">Trade</span>
        </button>

        {/* 5. User Cabinet */}
        <button
          onClick={onOpenProfile}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-neutral-400 hover:text-white transition"
        >
          <User className="w-4 h-4 text-neutral-300" />
          <span className="text-[10px] mt-1 tracking-tight">Profile</span>
        </button>
      </div>
    </div>
  );
};
