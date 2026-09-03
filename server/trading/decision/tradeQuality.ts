import { INTEL } from "../intelligence/config.js";

export type QualityClass = "NO_TRADE" | "WATCH" | "SIGNAL" | "AUTO_TRADE";

export type QualityCheck = {
  key: string;
  ok: boolean;
  labelRu: string;
  labelEn: string;
};

export function classifySetup(params: {
  hasSignal: boolean;
  grade?: string;
  qualityScore?: number;
  autoGatesPass: boolean;
}): QualityClass {
  if (params.autoGatesPass && params.grade === "A+") return "AUTO_TRADE";
  if (params.hasSignal && (params.grade === "A+" || params.grade === "A")) return "SIGNAL";
  const q = params.qualityScore ?? 0;
  if (!params.hasSignal && q >= 7 && q < INTEL.minConfluenceTrade) return "WATCH";
  return "NO_TRADE";
}

export function autoGateChecks(params: {
  regimeAllowed: boolean;
  htfOk: boolean;
  structureOk: boolean;
  triggerOk: boolean;
  riskOk: boolean;
  costOk: boolean;
  sizeOk: boolean;
  noDuplicate: boolean;
  noKillSwitch: boolean;
  dataFresh: boolean;
  noSetupPause: boolean;
}): { pass: boolean; checks: QualityCheck[] } {
  const checks: QualityCheck[] = [
    { key: "regime", ok: params.regimeAllowed, labelRu: "Режим рынка", labelEn: "Market regime" },
    { key: "htf", ok: params.htfOk, labelRu: "Старший тренд", labelEn: "HTF trend" },
    { key: "structure", ok: params.structureOk, labelRu: "Структура", labelEn: "Structure" },
    { key: "trigger", ok: params.triggerOk, labelRu: "Подтверждение входа", labelEn: "Entry trigger" },
    { key: "risk", ok: params.riskOk, labelRu: "Риск", labelEn: "Risk management" },
    { key: "cost", ok: params.costOk, labelRu: "Расходы / Net RR", labelEn: "Trading costs / Net RR" },
    { key: "size", ok: params.sizeOk, labelRu: "Размер позиции", labelEn: "Position size" },
    { key: "duplicate", ok: params.noDuplicate, labelRu: "Нет дубля позиции", labelEn: "No duplicate position" },
    { key: "kill", ok: params.noKillSwitch, labelRu: "Kill switch выключен", labelEn: "Kill switch off" },
    { key: "data", ok: params.dataFresh, labelRu: "Свежие данные", labelEn: "Fresh market data" },
    { key: "cluster", ok: params.noSetupPause, labelRu: "Сетап не на паузе", labelEn: "Setup not paused" },
  ];
  return { pass: checks.every((c) => c.ok), checks };
}

export function regimeAllowedForAuto(regime: string | undefined | null) {
  if (!regime) return false;
  return (INTEL.autoRegimes as readonly string[]).includes(regime);
}
