export interface GlobalNavItem {
  key: string
  labelKey: string
  href: string
}

export interface CompanyNavLeaf {
  key: string
  labelKey: string
  tab: string
}

export interface CompanyNavGroup {
  key: string
  labelKey: string
  /** Прямой tab для групп без children (unit/tasks/reports). */
  tab?: string
  /** Пункт «Overview» показывается только для startup-роли. */
  startupOnly?: boolean
  children?: CompanyNavLeaf[]
}

/**
 * Единственный источник глобальной навигации.
 * Отдельных роутов «Companies / Tasks / Reports» в приложении нет — они живут
 * внутри Dashboard / вкладок компании, поэтому global nav остаётся из двух
 * пунктов, как и в прежнем sidebar.
 */
export const globalNav: GlobalNavItem[] = [
  { key: 'dashboard', labelKey: 'nav.dashboard', href: '/dashboard' },
  { key: 'settings', labelKey: 'nav.settings', href: '/settings' },
]

/**
 * Единый источник навигации компании (13 вкладок → сгруппированы).
 * Desktop и mobile рендерят ОДНУ эту модель — разница только в presentation.
 */
export const companyGroups: CompanyNavGroup[] = [
  { key: 'overview', labelKey: 'nav.overview', startupOnly: true },
  {
    key: 'growth',
    labelKey: 'nav.growth',
    children: [
      { key: 'metrics', labelKey: 'company.tabs.metrics', tab: 'metrics' },
      { key: 'cohorts', labelKey: 'company.tabs.cohorts', tab: 'cohorts' },
    ],
  },
  { key: 'unit', labelKey: 'company.tabs.unit', tab: 'unit' },
  {
    key: 'finance',
    labelKey: 'nav.finance',
    children: [
      { key: 'budget', labelKey: 'company.tabs.budget', tab: 'budget' },
      { key: 'pnl', labelKey: 'company.tabs.pnl', tab: 'pnl' },
      { key: 'cashflow', labelKey: 'company.tabs.cashflow', tab: 'cashflow' },
      { key: 'credit', labelKey: 'company.tabs.credit', tab: 'credit' },
      { key: 'valuation', labelKey: 'company.tabs.valuation', tab: 'valuation' },
      { key: 'sensitivity', labelKey: 'company.tabs.sensitivity', tab: 'sensitivity' },
    ],
  },
  {
    key: 'planning',
    labelKey: 'nav.planning',
    children: [
      { key: 'market', labelKey: 'company.tabs.market', tab: 'market' },
      { key: 'hiring', labelKey: 'company.tabs.hiring', tab: 'hiring' },
    ],
  },
  { key: 'tasks', labelKey: 'company.tabs.tasks', tab: 'tasks' },
  { key: 'reports', labelKey: 'company.tabs.reports', tab: 'reports' },
]

/** Все «листовые» tab-значения компании (для «More» на mobile). */
export const companyTabKeys: string[] = [
  'metrics',
  'cohorts',
  'unit',
  'budget',
  'pnl',
  'cashflow',
  'credit',
  'valuation',
  'sensitivity',
  'market',
  'hiring',
  'tasks',
  'reports',
]
