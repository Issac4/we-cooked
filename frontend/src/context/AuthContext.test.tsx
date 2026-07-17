import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

// Helper component to test AuthContext
const AuthConsumer = () => {
  const { token, logout, isAuthenticated } = useAuth()
  return (
    <div>
      <div data-testid="token">{token}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('initializes with token from localStorage', () => {
    localStorage.setItem('recipe_token', 'initial-token')
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )
    expect(screen.getByTestId('token').textContent).toBe('initial-token')
    expect(screen.getByTestId('authenticated').textContent).toBe('true')
  })

  it('removes token from localStorage on logout', () => {
    localStorage.setItem('recipe_token', 'initial-token')
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    )
    
    act(() => {
      screen.getByText('Logout').click()
    })
    
    expect(screen.getByTestId('token').textContent).toBe('')
    expect(screen.getByTestId('authenticated').textContent).toBe('false')
    expect(localStorage.getItem('recipe_token')).toBeNull()
  })
})
