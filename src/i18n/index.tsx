import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../hooks/useAuth'
import { updateProfile } from '../lib/firestore'
import { messages, type Lang } from './messages'
import {
  getStoredPref,
  resolveLang,
  setCurrentLang,
  storePref,
  type LangPref,
} from './lang'

export { getLang } from './lang'
export type { LangPref } from './lang'

function translate(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let s = messages[lang][key] ?? messages.en[key] ?? key
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split(`{${k}}`).join(String(vars[k]))
    }
  }
  return s
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string

interface LocaleState {
  lang: Lang
  pref: LangPref
  setPref: (p: LangPref) => void
  t: TFn
}

const Ctx = createContext<LocaleState | undefined>(undefined)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, profile, patchProfile } = useAuth()
  const [pref, setPrefState] = useState<LangPref>(getStoredPref)
  const lang = resolveLang(pref)
  setCurrentLang(lang)

  // Adopt the language saved on the user's profile (cross-device) once it loads.
  useEffect(() => {
    if (profile?.language && profile.language !== pref) {
      storePref(profile.language)
      setPrefState(profile.language)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language])

  const setPref = (p: LangPref) => {
    storePref(p)
    setCurrentLang(resolveLang(p))
    setPrefState(p)
    if (user) {
      patchProfile({ language: p })
      void updateProfile(user.uid, { language: p })
    }
  }

  const t: TFn = (key, vars) => translate(lang, key, vars)

  return <Ctx.Provider value={{ lang, pref, setPref, t }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT(): LocaleState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useT must be used within LocaleProvider')
  return ctx
}
