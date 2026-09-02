import { INTEL } from "./config.js";
import type { VolumeClass, VolumeResult } from "./types.js";

export function analyzeVolume(relativeVolume?: number, current?: number, average?: number): VolumeResult {
  const relative = relativeVolume && relativeVolume > 0 ? relativeVolume : 0;
  const klass: VolumeClass =
    relative <= 0
      ? "UNKNOWN"
      : relative < INTEL.rvolWeak
        ? "WEAK"
        : relative < INTEL.rvolNormal
          ? "NORMAL"
          : relative < INTEL.rvolStrong
            ? "STRONG"
            : "VERY_STRONG";
  const confirms = klass === "STRONG" || klass === "VERY_STRONG";
  const reasons = [
    {
      textRu:
        klass === "UNKNOWN"
          ? "Объём в этом снимке не рассчитан — подтверждение не заявляется"
          : `Относительный объём x${relative.toFixed(2)} (${klass === "WEAK" ? "слабый" : klass === "NORMAL" ? "обычный" : klass === "STRONG" ? "сильный" : "очень сильный"})`,
      textEn:
        klass === "UNKNOWN"
          ? "Volume was not computed — confirmation is not claimed"
          : `Relative volume x${relative.toFixed(2)} (${klass.toLowerCase()})`,
      ok: confirms,
    },
  ];
  return {
    current: current || 0,
    average: average || 0,
    relative,
    klass,
    confirms,
    reasons,
  };
}
