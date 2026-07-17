import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect } from 'vitest'
import Settings from './Settings'
import { AuthContext } from '@/context/AuthContext'
import * as api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  updateProtein: vi.fn(),
  deleteProtein: vi.fn(),
  updateMealType: vi.fn(),
  deleteMealType: vi.fn(),
  updateProfile: vi.fn(),
}))


const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  is_active: true,
  is_admin: false,
  created_at: new Date().toISOString(),
}

describe('Settings Page Smoke Test', () => {
  const renderSettings = () => {
    return render(
      <AuthContext.Provider value={{ 
        isAuthenticated: true, 
        user: mockUser, 
        token: 'mock-token',
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn().mockResolvedValue(undefined),
        loading: false
      }}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('renders without crashing and shows tabs', async () => {
    // Mock successful fetch
    ;(api.apiFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    renderSettings()
    
    await waitFor(() => {
        expect(screen.getByText(/Settings/i)).toBeDefined()
        expect(screen.getByText(/Account & Profile/i)).toBeDefined()
        expect(screen.getByText(/Category Management/i)).toBeDefined()
    })
  })

  it('shows profile information in Account tab', async () => {
     ;(api.apiFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    renderSettings()
    
    await waitFor(() => {
        expect(screen.getByDisplayValue(mockUser.username)).toBeDefined()
        expect(screen.getByDisplayValue(mockUser.email)).toBeDefined()
    })
  })

})
