import { useTranslation } from 'react-i18next'
import { switchLanguage } from '../i18n'

export const LanguageToggle = ({ className = '' }: { className?: string }) => {
  const { i18n, t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => switchLanguage(i18n.language === 'ru' ? 'en' : 'ru')}
      className={`text-sm font-medium ${className}`}
      aria-label={t('common.language')}
    >
      {i18n.language === 'ru' ? 'EN' : 'RU'}
    </button>
  )
}
