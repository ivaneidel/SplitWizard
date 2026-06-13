import { nav } from './messages/nav'
import { login } from './messages/login'
import { settings } from './messages/settings'
import { dashboard } from './messages/dashboard'
import { group } from './messages/group'
import { expense } from './messages/expense'
import { installments } from './messages/installments'
import { search } from './messages/search'
import { activity } from './messages/activity'
import { charts } from './messages/charts'
import { importexport } from './messages/importexport'

export type Lang = 'en' | 'es'

/** One namespace's translations. */
export type Dict = { en: Record<string, string>; es: Record<string, string> }

const all: Dict[] = [
  nav,
  login,
  settings,
  dashboard,
  group,
  expense,
  installments,
  search,
  activity,
  charts,
  importexport,
]

export const messages: Record<Lang, Record<string, string>> = {
  en: Object.assign({}, ...all.map((d) => d.en)),
  es: Object.assign({}, ...all.map((d) => d.es)),
}
