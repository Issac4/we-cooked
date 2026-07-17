import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RecipeDetails from './RecipeDetails'
import { AuthContext } from '../context/AuthContext'
import * as api from '../lib/api'

// Mock the API fetch
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

const mockRecipe = {
  id: 1,
  title: 'Test Recipe',
  proteins: ['Chicken'],
  meal_types: ['Dinner'],
  servings: 2,
  prep_time_mins: 10,
  cook_time_mins: 20,
  ingredients: [{ item: 'Chicken', amount: '500g' }],
  instructions: {
    prep: [{ step: 1, action: 'Cut chicken', description: '' }],
    cook: [{ step: 1, action: 'Fry chicken', description: '', timer_mins: 10 }]
  },
  reference_links: [],
  attributes: {},
  cover_image_url: '/static/uploads/test.jpg'
}

describe('RecipeDetails Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock for fetching recipe
    ;(api.apiFetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRecipe),
    })
  })

  const renderComponent = (isAuthenticated = true) => {
    return render(
      <AuthContext.Provider value={{ 
        isAuthenticated, 
        user: isAuthenticated ? { 
          id: 1, 
          username: 'testuser', 
          email: 'test@example.com',
          is_active: true,
          is_admin: false,
          created_at: new Date().toISOString()
        } : null,
        token: isAuthenticated ? 'mock-token' : null,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn().mockResolvedValue(undefined),
        loading: false
      }}>
        <MemoryRouter initialEntries={['/recipe/1']}>
          <Routes>
            <Route path="/recipe/:id" element={<RecipeDetails />} />
            <Route path="/" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
  }

  it('shows delete button when authenticated', async () => {
    renderComponent(true)
    await waitFor(() => expect(screen.getByText('Test Recipe')).toBeDefined())
    expect(screen.getByRole('button', { name: /delete/i })).toBeDefined()
  })

  it('hides delete button when unauthenticated', async () => {
    renderComponent(false)
    await waitFor(() => expect(screen.getByText('Test Recipe')).toBeDefined())
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('requires confirmation via modal to delete', async () => {
    renderComponent(true)
    await waitFor(() => expect(screen.getByText('Test Recipe')).toBeDefined())
    
    // 1. Click Delete button
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(deleteBtn)
    
    // 2. Verify Modal is shown
    expect(screen.getByText(/confirm deletion/i)).toBeDefined()
    expect(screen.getByText(/are you absolutely sure\?/i)).toBeDefined()
    
    // 3. Mock delete success
    ;(api.apiFetch as any).mockResolvedValueOnce({ ok: true })
    
    // 4. Click Permanent Delete button in modal
    const confirmBtn = screen.getByRole('button', { name: /permanently delete/i })
    fireEvent.click(confirmBtn)
    
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledWith('/recipes/1', expect.objectContaining({ method: 'DELETE' })))
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeDefined())
  })
})
