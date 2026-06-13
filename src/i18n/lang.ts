// Pure language state — no React / Firebase imports, so non-React formatters
// (e.g. lib/date.ts) can read the current language without circular deps.
import type { Lang } from './messages'

/** User preference: 'system' resolves from the device language; else forced. */
export type LangPref = 'system' | 'en' | 'es'

const KEY = 'lang'

export function getStoredPref(): LangPref {
  if (typeof localStorage === 'undefined') return 'system'
  const v = localStorage.getItem(KEY)
  return v === 'en' || v === 'es' || v === 'system' ? v : 'system'
}

export function storePref(pref: LangPref) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, pref)
}

function systemLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  const l = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return l === 'es' ? 'es' : 'en' // default to system, fall back to English
}

export function resolveLang(pref: LangPref): Lang {
  return pref === 'system' ? systemLang() : pref
}

let current: Lang = resolveLang(getStoredPref())

export function getLang(): Lang {
  return current
}

export function setCurrentLang(l: Lang) {
  current = l
}
