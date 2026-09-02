import type { RegisterRequest, TokenResponse, UserResponse, SeedResponse } from '@/types/api'
import { api } from './client'

export const authApi = {
  register: (data: RegisterRequest, { signal }: { signal?: AbortSignal } = {}): Promise<TokenResponse> => api.post('/auth/register', data, { signal }).then((res) => res.data),
  login: (data: {email: string, password: string}, { signal }: { signal?: AbortSignal } = {}): Promise<TokenResponse> =>
    api.post('/auth/login', data, { signal }).then((res) => res.data),
  me: ({ signal }: { signal?: AbortSignal } = {}): Promise<UserResponse> => api.get('/auth/me', { signal }).then((res) => res.data),
  logout: ({ signal }: { signal?: AbortSignal } = {}): Promise<void> => api.post('/auth/logout', undefined, { signal }).then((res) => res.data),
  seed: ({ signal }: { signal?: AbortSignal } = {}): Promise<SeedResponse> => api.post('/auth/seed', undefined, { signal }).then((res) => res.data),
}
