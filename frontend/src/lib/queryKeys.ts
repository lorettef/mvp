/**
 * Фабрика ключей React Query с tenant-префиксом.
 *
 * Каждый ключ имеет вид ['tenant', <tenant>, ...], поэтому:
 * - организация A и организация B не могут поделиться кэшем, даже если
 *   id компании совпадает (durable-защита от cross-tenant-утечки данных);
 * - инвалидация по префиксу ['tenant', <tenant>, 'company', <id>] одним
 *   вызовом покрывает и сам запрос компании, и все производные
 *   (metrics, cohorts, unit-economics, pnl, cashflow, credit, valuation, ...).
 *
 * Ключи содержат ТОЛЬКО JSON-сериализуемые строки — никаких функций
 * и объектов внутри queryKey.
 */
export const qk = {
  dashboard: (tenant: string): readonly string[] => ['tenant', tenant, 'dashboard'],
  companies: (tenant: string, archived: boolean): readonly string[] => [
    'tenant',
    tenant,
    'companies',
    archived ? 'archived' : 'active',
  ],

  company: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id],
  companyMetrics: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'metrics'],
  companyCohorts: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'cohorts'],
  companyBudgets: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'budgets'],
  companyUnitEconomics: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'unit-economics'],
  companyTasks: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'tasks'],
  companyReadiness: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'readiness'],
  companyHiring: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'hiring'],
  companyPnl: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'pnl'],
  companyCashflow: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'cashflow'],
  companyCredit: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'credit'],
  companyValuation: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'valuation'],
  companySensitivity: (tenant: string, id: string): readonly string[] => ['tenant', tenant, 'company', id, 'sensitivity'],
}

export type QueryKeyFactory = typeof qk
