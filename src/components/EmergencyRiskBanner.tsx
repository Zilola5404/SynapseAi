import React from 'react';
import { ShieldAlert, AlertTriangle, Power, RefreshCw, CheckCircle2 } from 'lucide-react';
import { RiskSettings } from '../types';

interface EmergencyRiskBannerProps {
  risk: RiskSettings;
  realizedPnL24h: number;
  totalEquityUsdt: number;
  initialEquityUsdt?: number;
  onResetKillSwitch: () => void;
}

export const EmergencyRiskBanner: React.FC<EmergencyRiskBannerProps> = ({
  risk,
  realizedPnL24h,
  totalEquityUsdt,
  initialEquityUsdt = 10000,
  onResetKillSwitch,
}) => {
  const maxDailyLossUsdt = (totalEquityUsdt * (risk.maxDailyLossPct / 100));
  const isDailyLossBreached = realizedPnL24h < 0 && Math.abs(realizedPnL24h) >= maxDailyLossUsdt;

  const currentDrawdownPct = initialEquityUsdt > totalEquityUsdt
    ? ((initialEquityUsdt - totalEquityUsdt) / initialEquityUsdt) * 100
    : 0;
  const isDrawdownBreached = currentDrawdownPct >= risk.maxDrawdownPct;

  const isKillSwitchActive = risk.emergencyKillSwitch;

  if (!isKillSwitchActive && !isDailyLossBreached && !isDrawdownBreached) {
    return null;
  }

  return (
    <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-rose-900/60 to-red-950/80 border border-red-500/40 shadow-2xl backdrop-blur-md animate-pulse-subtle text-red-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>АВАРИЙНЫЙ ЗАЩИТНЫЙ РЕЖИМ (STAGE 3 SAFEGUARD)</span>
              <span className="px-2 py-0.5 rounded-full bg-red-500/30 text-red-300 text-[10px] font-mono border border-red-500/50 font-bold">
                ТОРГОВЛЯ ЗАБЛОКИРОВАНА
              </span>
            </h3>
            <p className="text-xs text-red-200/90 leading-relaxed">
              {isKillSwitchActive && "Активирована кнопка аварийной остановки KILL SWITCH. Все AI-агенты остановлены."}
              {!isKillSwitchActive && isDailyLossBreached && `Достигнут дневной лимит убытка (-$${Math.abs(realizedPnL24h).toFixed(2)} / макс. -$${maxDailyLossUsdt.toFixed(2)}).`}
              {!isKillSwitchActive && !isDailyLossBreached && isDrawdownBreached && `Превышен порог просадки портфеля (${currentDrawdownPct.toFixed(1)}% / макс. ${risk.maxDrawdownPct}%).`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onResetKillSwitch();
            }}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-emerald-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4 text-black" />
            <span>Разблокировать & Возобновить</span>
          </button>
        </div>
      </div>
    </div>
  );
};
