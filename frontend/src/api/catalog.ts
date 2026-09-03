import type { CatalogResponse } from '@/types/api'
import { api } from './client'

export const catalogApi = {
  get: ({ signal }: { signal?: AbortSignal } = {}): Promise<CatalogResponse> =>
    api.get('/catalog', { signal, skipTransform: true }).then((res) => res.data),
}
