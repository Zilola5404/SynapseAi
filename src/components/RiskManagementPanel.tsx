import React from 'react';
import { RiskSettings } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle2, Lock, Sliders, X, ShieldCheck } from 'lucide-react';

interface RiskManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  risk: RiskSettings;
  onSaveRisk: (newRisk: RiskSettings) => void;
  onTriggerKillSwitch: () => void;
  accountEquity: number;
}

export const RiskManagementPanel: React.FC<RiskManagementPanelProps> = ({
  isOpen,
  onClose,
  risk,
  onSaveRisk,
  onTriggerKillSwitch,
  accountEquity,
}) => {
  const [formRisk, setFormRisk] = React.useState<RiskSettings>(risk);

  React.useEffect(() => {
    setFormRisk(risk);
  }, [risk]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRisk(formRisk);
    onClose();
  };

  const maxPositionUsdt = (accountEquity * (formRisk.maxPositionSizePct / 100)).toFixed(2);
  const maxDailyLossUsdt = (accountEquity * (formRisk.maxDailyLossPct / 100)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card-3d border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Система Риск-Менеджмента</h2>
              <p className="text-xs text-neutral-400">Автоматическое ограничение убытков и контроль рисков</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs text-neutral-300">
          {/* Section 1: Daily Loss & Drawdown Barriers */}
          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5 text-green-400">
              <ShieldCheck className="w-4 h-4" />
              1. Защитные Пороги Убытков (Circuit Breakers)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Max Daily Loss % */}
              <div>
                <label className="block text-neutral-400 mb-1">
                  Макс. дневной убыток (% от депозита):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    max="15"
                    step="0.5"
                    value={formRisk.maxDailyLossPct}
                    onChange={(e) => setFormRisk({ ...formRisk, maxDailyLossPct: parseFloat(e.target.value) || 1 })}
                    className="glass-input rounded-xl p-2 text-white font-mono w-28 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-neutral-400 font-mono">= ${maxDailyLossUsdt} USDT</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">При достижении убытка AI временно приостанавливает торги на 24 часа.</p>
              </div>

              {/* Max Drawdown % */}
              <div>
                <label className="block text-neutral-400 mb-1">
                  Макс. общая просадка портфеля (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="25"
                    step="0.5"
                    value={formRisk.maxDrawdownPct}
                    onChange={(e) => setFormRisk({ ...formRisk, maxDrawdownPct: parseFloat(e.target.value) || 5 })}
                    className="glass-input rounded-xl p-2 text-white font-mono w-28 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-red-400 font-bold font-mono">Аварийный стоп</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">Автоматическое закрытие позиций при падении капитала на {formRisk.maxDrawdownPct}%.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Position Sizing & Leverage Cap */}
          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5 text-green-400">
              <Sliders className="w-4 h-4" />
              2. Размер Сделок и Плечо (Position Sizing & Leverage)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Max Position Size % */}
              <div>
                <label className="block text-neutral-400 mb-1">
                  Макс. маржа на 1 позицию (% от баланса):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="25"
                    step="0.5"
                    value={formRisk.maxPositionSizePct}
                    onChange={(e) => setFormRisk({ ...formRisk, maxPositionSizePct: parseFloat(e.target.value) || 1 })}
                    className="glass-input rounded-xl p-2 text-white font-mono w-28 focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-neutral-400 font-mono">≈ ${maxPositionUsdt} USDT</span>
                </div>
              </div>

              {/* Max Leverage */}
              <div>
                <label className="block text-neutral-400 mb-1">
                  Максимальное кредитное плечо (Leverage):
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={formRisk.maxLeverage}
                    onChange={(e) => setFormRisk({ ...formRisk, maxLeverage: parseInt(e.target.value) })}
                    className="glass-input rounded-xl p-2 text-white font-mono w-28 focus:border-green-500 focus:outline-none"
                  >
                    {[1, 2, 3, 5, 10, 15, 20].map((lev) => (
                      <option key={lev} value={lev} className="bg-neutral-900 text-white">
                        {lev}x
                      </option>
                    ))}
                  </select>
                  <span className="text-neutral-400 font-mono">
                    {formRisk.maxLeverage > 10 ? 'Высокий риск' : 'Умеренный риск'}
                  </span>
                </div>
              </div>

              {/* Max Open Positions */}
              <div className="md:col-span-2 pt-2 border-t border-white/5 flex items-center justify-between">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-0.5">Лимит активных позиций (Max Open Positions):</label>
                  <p className="text-[11px] text-neutral-500">Ограничение на количество одновременных сделок AI и трейдера.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={formRisk.maxOpenPositions || 3}
                    onChange={(e) => setFormRisk({ ...formRisk, maxOpenPositions: parseInt(e.target.value) })}
                    className="glass-input rounded-xl p-2 text-white font-mono font-bold w-24 focus:border-green-500 focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 8, 10].map((num) => (
                      <option key={num} value={num} className="bg-neutral-900 text-white">
                        {num} поз.
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Stop-Loss & Take-Profit Rules */}
          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-1.5 text-green-400">
              <Lock className="w-4 h-4" />
              3. Дефолтные Правила SL / TP & Trailing Stop
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-neutral-400 mb-1">Stop-Loss по умолчанию (%):</label>
                <input
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={formRisk.defaultStopLossPct}
                  onChange={(e) => setFormRisk({ ...formRisk, defaultStopLossPct: parseFloat(e.target.value) || 1 })}
                  className="glass-input rounded-xl p-2 text-white font-mono w-full focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Take-Profit по умолчанию (%):</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  step="0.5"
                  value={formRisk.defaultTakeProfitPct}
                  onChange={(e) => setFormRisk({ ...formRisk, defaultTakeProfitPct: parseFloat(e.target.value) || 2 })}
                  className="glass-input rounded-xl p-2 text-white font-mono w-full focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Trailing Stop Offset (%):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    max="5"
                    step="0.1"
                    disabled={!formRisk.enableTrailingStop}
                    value={formRisk.trailingStopPct}
                    onChange={(e) => setFormRisk({ ...formRisk, trailingStopPct: parseFloat(e.target.value) || 1 })}
                    className="glass-input rounded-xl p-2 text-white font-mono w-full focus:border-green-500 focus:outline-none disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRisk.enableTrailingStop}
                  onChange={(e) => setFormRisk({ ...formRisk, enableTrailingStop: e.target.checked })}
                  className="rounded bg-black border-white/20 text-green-500 focus:ring-0"
                />
                <span>Включить скользящий подтягивающийся стоп-лосс (Trailing Stop)</span>
              </label>
            </div>
          </div>

          {/* Section 4: Emergency Kill Switch Trigger */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold text-red-300 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Аварийная Кнопка Остановки (Panic Button)
              </div>
              <p className="text-neutral-400 text-[11px] mt-0.5">
                Мгновенно закрывает все открытые позиции по рынку и полностью останавливает автономного AI-агента.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onTriggerKillSwitch();
                onClose();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-red-950/50 transition whitespace-nowrap"
            >
              KILL SWITCH
            </button>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-neutral-300 rounded-xl text-xs font-semibold transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-400 text-black font-bold rounded-xl text-xs shadow-lg shadow-green-500/20 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Сохранить Параметры Риска
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
