import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'
import { companiesApi } from './companies'
import { authApi } from './auth'
import { forecastApi } from './forecast'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

function mockAdapter(responseBody: unknown) {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
    data: responseBody,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
}

// axios's default transformRequest JSON-stringifies object bodies before the
// adapter runs, so unwrap config.data before asserting on the wire keys.
function sentBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  return typeof config.data === 'string' ? JSON.parse(config.data) : config.data
}

describe('API wire-contract casing', () => {
  it('companiesApi.update sends gross_margin (snake_case) on the wire', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: { id: 'c1', gross_margin: 0.8 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    api.defaults.adapter = adapter

    await companiesApi.update('c1', { gross_margin: 0.8 })

    expect(adapter).toHaveBeenCalledTimes(1)
    const body = sentBody(adapter.mock.calls[0][0])
    expect(body).toEqual({ gross_margin: 0.8 })
    expect(body).not.toHaveProperty('grossMargin')
  })

  it('companiesApi.create sends gross_margin (snake_case) on the wire', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: { id: 'c1', name: 'ACME', gross_margin: 0.7 },
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    }))
    api.defaults.adapter = adapter

    await companiesApi.create({ name: 'ACME', gross_margin: 0.7 })

    expect(adapter).toHaveBeenCalledTimes(1)
    const body = sentBody(adapter.mock.calls[0][0])
    expect(body).toEqual({ name: 'ACME', gross_margin: 0.7 })
    expect(body).not.toHaveProperty('grossMargin')
  })

  it('authApi.register sends full_name / company_name (snake_case) on the wire', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: { token_type: 'bearer', expires_in: 3600 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    api.defaults.adapter = adapter

    await authApi.register({
      email: 'a@b.c',
      password: 'secret123',
      full_name: 'Ada Lovelace',
      company_name: 'ACME',
    })

    expect(adapter).toHaveBeenCalledTimes(1)
    const body = sentBody(adapter.mock.calls[0][0])
    expect(body).toEqual({
      email: 'a@b.c',
      password: 'secret123',
      full_name: 'Ada Lovelace',
      company_name: 'ACME',
    })
    expect(body).not.toHaveProperty('fullName')
    expect(body).not.toHaveProperty('companyName')
  })

  it('camelizes snake_case response bodies into camelCase fields', async () => {
    mockAdapter({
      predictions: [110, 121, 133],
      confidence_interval: { lower: [105, 115], upper: [115, 127] },
      method: 'linear',
    })

    const result = await forecastApi.predict({ history: [100, 110, 121], months: 3, method: 'linear' })

    expect(result.confidenceInterval).toEqual({ lower: [105, 115], upper: [115, 127] })
    expect(result as unknown as Record<string, unknown>).not.toHaveProperty('confidence_interval')
  })
})
