import { AxiosError, CanceledError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, resetUnauthorizedHandler, setUnauthorizedHandler } from './client'
import { companiesApi } from './companies'

function unauthorizedResponse(config: InternalAxiosRequestConfig): AxiosResponse {
  return {
    data: {},
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  }
}

function rejectWith401(message = 'Unauthorized'): void {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError(
      message,
      AxiosError.ERR_BAD_REQUEST,
      config,
      undefined,
      unauthorizedResponse(config)
    )
  }
}

// window.location подменяется на plain-объект: присваивание href в jsdom
// вызвало бы реальную (и шумную) попытку навигации.
const locationStub = { href: '' }

beforeEach(() => {
  resetUnauthorizedHandler()
  locationStub.href = ''
  vi.stubGlobal('location', locationStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api client 401 interceptor', () => {
  it('rejects a cancelled request without touching the session or redirecting', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      // Simulate a cancellation that races a 401 response: without the
      // axios.isCancel guard the session-clear branch would run.
      const cancel = new CanceledError('canceled', config)
      cancel.response = unauthorizedResponse(config)
      throw cancel
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const controller = new AbortController()
    await expect(
      api.get('/companies/1', { signal: controller.signal })
    ).rejects.toBeInstanceOf(CanceledError)

    expect(handler).not.toHaveBeenCalled()
    expect(locationStub.href).toBe('')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('does not clear the session or redirect on a 401 from /auth/login', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    rejectWith401()

    await expect(
      api.post('/auth/login', { email: 'wrong@test', password: 'wrong' })
    ).rejects.toMatchObject({ message: 'Unauthorized' })

    expect(handler).not.toHaveBeenCalled()
    expect(locationStub.href).toBe('')
  })

  it('calls the registered handler exactly once on a data-endpoint 401 and does not hard-redirect', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    rejectWith401()

    await expect(api.get('/companies/1')).rejects.toMatchObject({ message: 'Unauthorized' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(locationStub.href).toBe('')
  })

  it('falls back to the hard redirect on a data-endpoint 401 when no handler is registered', async () => {
    rejectWith401()

    await expect(api.get('/companies/1')).rejects.toMatchObject({ message: 'Unauthorized' })

    expect(locationStub.href).toBe('/login')
  })

  it('forwards the AbortSignal into the axios adapter config', async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    api.defaults.adapter = adapter

    const controller = new AbortController()
    await companiesApi.get('comp-1', { signal: controller.signal })

    expect(adapter).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }))
  })
})
