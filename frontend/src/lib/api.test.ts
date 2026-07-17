import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch } from './api'

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('location', { href: '' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds Authorization header when token exists', async () => {
    localStorage.setItem('recipe_token', 'test-token')
    ;(fetch as any).mockResolvedValue({ ok: true })

    await apiFetch('/test')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    )
  })

  it('removes token and redirects on 401 for GET requests', async () => {
    localStorage.setItem('recipe_token', 'test-token')
    ;(fetch as any).mockResolvedValue({ status: 401 })

    await apiFetch('/test', { method: 'GET' })

    expect(localStorage.getItem('recipe_token')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('throws SessionExpiredError and removes token on 401 for mutations', async () => {
    localStorage.setItem('recipe_token', 'test-token')
    ;(fetch as any).mockResolvedValue({ status: 401 })

    await expect(apiFetch('/test', { method: 'POST' })).rejects.toThrow('Session expired')
    expect(localStorage.getItem('recipe_token')).toBeNull()
  })
})
