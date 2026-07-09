import type { RegisterRequest, TokenResponse, UserResponse, SeedResponse } from '@/types/api'
import { api } from './client'

export const authApi = {
  register: (data: RegisterRequest): Promise<TokenResponse> => api.post('/auth/register', data).then((res) => res.data),
  login: (data: {email: string, password: string}): Promise<TokenResponse> =>
    api.post('/auth/login', data).then((res) => res.data),
  me: (): Promise<UserResponse> => api.get('/auth/me').then((res) => res.data),
  logout: (): Promise<void> => api.post('/auth/logout').then((res) => res.data),
  seed: (): Promise<SeedResponse> => api.post('/auth/seed').then((res) => res.data),
}
