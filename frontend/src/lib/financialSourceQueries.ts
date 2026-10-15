import type { QueryClient } from '@tanstack/react-query'
import { qk } from './queryKeys'

/** One tenant-aware invalidation contract for stored financial source changes. */
export async function invalidateFinancialSources(client: QueryClient, tenant: string, companyId: string): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: qk.company(tenant, companyId) }),
    client.invalidateQueries({ queryKey: qk.dashboard(tenant) }),
  ])
}
