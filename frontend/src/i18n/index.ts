import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ru } from './locales/ru'
import { en } from './locales/en'

const LANG_KEY = 'startup-engine-lang'

const saved = localStorage.getItem(LANG_KEY)

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: saved === 'en' ? 'en' : 'ru',
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

// Keep the <html lang> attribute in sync with the active locale.
document.documentElement.lang = i18n.language
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

export function switchLanguage(next: 'ru' | 'en') {
  i18n.changeLanguage(next)
  localStorage.setItem(LANG_KEY, next)
}

export default i18n
