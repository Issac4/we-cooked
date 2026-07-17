import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AdminDashboard from './AdminDashboard'
import { AuthContext } from '@/context/AuthContext'
import * as api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}))

const mockCurrentUser = {
  id: 1,
  username: 'admin',
  email: 'admin@example.com',
  is_active: true,
  is_admin: true,
  created_at: new Date().toISOString(),
}

const mockUsersList = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    is_active: true,
    is_admin: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    username: 'john_doe',
    email: 'john@example.com',
    is_active: true,
    is_admin: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    username: 'jane_doe',
    email: 'jane@example.com',
    is_active: false,
    is_admin: false,
    created_at: new Date().toISOString(),
  }
]

describe('AdminDashboard Page Tests', () => {
  const renderDashboard = () => {
    return render(
      <AuthContext.Provider value={{ 
        isAuthenticated: true, 
        user: mockCurrentUser, 
        token: 'mock-token',
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn().mockResolvedValue(undefined),
        loading: false
      }}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(api.apiFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockUsersList),
    })
  })

  it('renders dashboard with user directory', async () => {
    renderDashboard()
    
    await waitFor(() => {
      expect(screen.getByText(/System Administration/i)).toBeDefined()
      expect(screen.getByText(/Total registered: 3/i)).toBeDefined()
      expect(screen.getByText('john_doe')).toBeDefined()
      expect(screen.getByText('jane_doe')).toBeDefined()
    })
  })

  it('filters directory by search query', async () => {
    renderDashboard()
    
    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/Search by username or email/i)
    fireEvent.change(searchInput, { target: { value: 'john' } })

    await waitFor(() => {
      expect(screen.queryByText('jane_doe')).toBeNull()
      expect(screen.getByText('john_doe')).toBeDefined()
    })
  })
})
