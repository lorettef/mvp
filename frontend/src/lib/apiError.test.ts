import { describe, expect, it } from 'vitest'
import { normalizeApiError } from './apiError'

describe('normalizeApiError', () => {
  it('maps an arpu greater_than 422 error to the ARPU message', () => {
    const error = {
      response: {
        data: {
          detail: [
            {
              loc: ['body', 'items', 0, 'arpu'],
              msg: 'Input should be greater than 0',
              type: 'greater_than',
            },
          ],
        },
      },
    }
    expect(normalizeApiError(error)).toEqual({
      field: 'arpu',
      message: 'ARPU должен быть больше 0',
    })
  })

  it('maps a title 422 error to the title message', () => {
    const error = {
      response: {
        data: {
          detail: [
            {
              loc: ['body', 'title'],
              msg: 'String should have at most 200 characters',
              type: 'string_too_long',
            },
          ],
        },
      },
    }
    expect(normalizeApiError(error)).toEqual({
      field: 'title',
      message: 'Название должно быть не длиннее 200 символов',
    })
  })

  it('maps retention_rate and retention_mN errors', () => {
    const rate = {
      response: {
        data: {
          detail: [
            {
              loc: ['body', 'items', 0, 'retention_rate'],
              msg: 'Input should be less than or equal to 1',
              type: 'less_than_equal',
            },
          ],
        },
      },
    }
    expect(normalizeApiError(rate).message).toBe('Retention должен быть от 0 до 1')

    const m3 = {
      response: {
        data: {
          detail: [
            {
              loc: ['body', 'retention_m3'],
              msg: 'Input should be less than or equal to 1',
              type: 'less_than_equal',
            },
          ],
        },
      },
    }
    expect(normalizeApiError(m3)).toEqual({
      field: 'retention_m3',
      message: 'Retention должен быть от 0 до 1',
    })
  })

  it('falls back to the first validation message for unknown 422 fields', () => {
    const error = {
      response: {
        data: {
          detail: [
            {
              loc: ['body', 'unknown_field'],
              msg: 'Input should be a valid number',
              type: 'float_parsing',
            },
          ],
        },
      },
    }
    expect(normalizeApiError(error)).toEqual({ message: 'Input should be a valid number' })
  })

  it('falls back to the generic message for non-422 errors', () => {
    expect(normalizeApiError(new Error('boom'))).toEqual({ message: 'boom' })
    expect(normalizeApiError({})).toEqual({
      message: 'Something went wrong. Please try again.',
    })
  })
})
