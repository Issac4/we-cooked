import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import EditRecipe from './EditRecipe'
import { AuthProvider } from '../context/AuthContext'

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn())

const mockRecipe = {
  id: 1,
  title: 'Existing Recipe',
  proteins: ['Chicken'],
  meal_types: ['Dinner'],
  servings: 4,
  prep_time_mins: 10,
  cook_time_mins: 20,
  ingredients: [{ item: 'Chicken', amount: '500g' }],
  instructions: {
    prep: [{ step: 1, action: 'Wash chicken', description: '' }],
    cook: [{ step: 1, action: 'Fry chicken', description: '', timer_mins: 15 }]
  },
  reference_links: [],
  attributes: {},
  cover_image_url: '/uploads/test.jpg',
  created_at: new Date().toISOString()
}

const mockProteins = [{ id: 1, name: 'Chicken' }, { id: 2, name: 'Beef' }]
const mockMealTypes = [{ id: 1, name: 'Dinner' }, { id: 2, name: 'Lunch' }]

const renderEditRecipe = () => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/recipe/edit/1']}>
        <Routes>
          <Route path="/recipe/edit/:id" element={<EditRecipe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('EditRecipe Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('recipe_token', 'mock-token')
  })

  it('fetches and displays recipe data on load', async () => {
    // Mock sequential fetch calls: recipe, proteins, meal-types
    vi.mocked(fetch).mockImplementation((url) => {
      if (url.toString().includes('/recipes/1')) {
        return Promise.resolve({ ok: true, json: async () => mockRecipe } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('4')).toBeInTheDocument() // Servings
    
    // Wait for the options to load in RecipeForm
    const proteinButton = await screen.findByRole('button', { name: 'Chicken' })
    expect(proteinButton).toHaveClass('bg-blue-600')

    const mealTypeButton = await screen.findByRole('button', { name: 'Dinner' })
    expect(mealTypeButton).toHaveClass('bg-green-600')

    // Find the ingredient item input
    const ingredientInputs = screen.getAllByDisplayValue('Chicken')
    expect(ingredientInputs.length).toBeGreaterThan(0)
  })

  it('shows error if recipe is not found', async () => {
    vi.mocked(fetch).mockResolvedValue({ 
      ok: false, 
      status: 404,
      json: async () => ({ detail: 'Recipe not found' })
    } as Response)

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByText(/Recipe not found/i)).toBeInTheDocument()
    })
  })
})
