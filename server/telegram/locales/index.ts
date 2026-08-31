import { ru } from "./ru.js";
import { en } from "./en.js";
import type { LocaleCode } from "./types.js";

export type { LocaleCode } from "./types.js";
export { ru, en };

export function getLocale(code?: string | null) {
  return code === "en" ? en : ru;
}

export function localeCode(code?: string | null): LocaleCode {
  return code === "en" ? "en" : "ru";
}
