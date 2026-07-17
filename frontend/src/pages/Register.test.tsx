import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect } from 'vitest'
import Register from './Register'
import { AuthContext } from '@/context/AuthContext'

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}))

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  is_active: true,
  is_admin: false,
  created_at: new Date().toISOString(),
}

const mockAdminUser = {
  ...mockUser,
  is_admin: true,
}

describe('Register Page tests', () => {
  const renderRegister = (user: any) => {
    return render(
      <AuthContext.Provider value={{ 
        isAuthenticated: !!user, 
        user, 
        token: user ? 'mock-token' : null,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn().mockResolvedValue(undefined),
        loading: false
      }}>
        <MemoryRouter>
          <Register />
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('renders registration disabled screen for guests', () => {
    renderRegister(null)
    expect(screen.getByText(/Registration Disabled/i)).toBeDefined()
    expect(screen.getByText(/Public registration is closed/i)).toBeDefined()
  })

  it('renders registration disabled screen for non-admin users', () => {
    renderRegister(mockUser)
    expect(screen.getByText(/Registration Disabled/i)).toBeDefined()
  })

  it('renders admin creation form for admin users', () => {
    renderRegister(mockAdminUser)
    expect(screen.getByText(/Register New User/i)).toBeDefined()
    expect(screen.getByLabelText(/Username/i)).toBeDefined()
    expect(screen.getByLabelText(/Email/i)).toBeDefined()
    expect(screen.getByLabelText(/Password/i)).toBeDefined()
  })
})
