import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Dashboard from './pages/Dashboard'
import RecipeDetails from './pages/RecipeDetails'
import { AuthProvider } from './context/AuthContext'

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn())

const mockRecipes = [
  { id: 1, title: 'Chicken Tacos', proteins: ['Chicken'], meal_types: ['Dinner'] }
]

const mockRecipeDetail = {
  id: 1,
  title: 'Chicken Tacos',
  proteins: ['Chicken'],
  meal_types: ['Dinner'],
  servings: 4,
  prep_time_mins: 5,
  cook_time_mins: 10,
  ingredients: [
    { item: 'Chicken Breast', amount: '500g' },
    { item: 'Taco Shells', amount: '8' }
  ],
  instructions: {
    prep: [
      { step: 1, action: 'Dice Chicken', description: 'Cut into 1-inch cubes' }
    ],
    cook: [
      { step: 1, action: 'Sauté', description: 'Cook until golden', timer_mins: 10 }
    ]
  }
}

const renderWithRouter = (_ui: React.ReactNode, { route = '/' } = {}) => {
  // Set a mock token to bypass auth check in components
  localStorage.setItem('recipe_token', 'mock-token')
  
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recipe/:id" element={<RecipeDetails />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('Full App Smoke Test', () => {
  it('renders the entire app without crashing and shows dashboard for guests', async () => {
    // Setup: No recipes needed for this smoke test
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    
    render(<App />)
    
    // The app should render the Dashboard by default now
    await waitFor(() => {
      expect(screen.getByText(/My Recipes/i)).toBeInTheDocument()
    })
    
    // Sidebar should show "Sign In"
    expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument()
  })
})

describe('Recipe App Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Dashboard Page', () => {
    it('renders the Dashboard header', async () => {
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
      renderWithRouter(<Dashboard />)
      expect(screen.getByText(/My Recipes/i)).toBeInTheDocument()
    })

    it('shows empty state message when no recipes exist', async () => {
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
      renderWithRouter(<Dashboard />)
      await waitFor(() => {
        expect(screen.getByText(/No recipes found/i)).toBeInTheDocument()
      })
    })

    it('contains items-start in the grid container to prevent card stretching (regression test)', async () => {
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
      const { container } = renderWithRouter(<Dashboard />)
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('items-start')
    })

    it('handles broken images with a "No Image" diagnostic indicator (regression test)', async () => {
      const mockRecipe = {
        id: 1,
        title: 'Broken Image Recipe',
        proteins: ['Egg'],
        meal_types: ['Breakfast'],
        cover_image_url: '/broken-path.jpg'
      }
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [mockRecipe] })
      renderWithRouter(<Dashboard />)

      const img = await screen.findByAltText('Broken Image Recipe')
      fireEvent.error(img)

      await waitFor(() => {
        expect(screen.getByTestId('image-error')).toBeInTheDocument()
        expect(screen.getByText(/No Image/i)).toBeInTheDocument()
      })
    })

    it('renders a beautiful "Culinary Gallery" placeholder if cover_image_url is missing (regression test)', async () => {
      const mockRecipe = {
        id: 1,
        title: 'No Image Recipe',
        proteins: ['Egg'],
        meal_types: ['Breakfast'],
        cover_image_url: null
      }
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [mockRecipe] })
      renderWithRouter(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('No Image Recipe')).toBeInTheDocument()
      })

      // The placeholder should be present for intentional "no image"
      expect(screen.getByTestId('image-placeholder')).toBeInTheDocument()
      expect(screen.getByText(/Culinary Gallery/i)).toBeInTheDocument()
    })

    it('renders multiple recipe cards', async () => {
      const manyRecipes = [
        { id: 1, title: 'Recipe A', proteins: ['P1'], meal_types: ['T1'] },
        { id: 2, title: 'Recipe B', proteins: ['P2'], meal_types: ['T2'] }
      ]
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => manyRecipes })
      renderWithRouter(<Dashboard />)
      await waitFor(() => {
        expect(screen.getByText('Recipe A')).toBeInTheDocument()
        expect(screen.getByText('Recipe B')).toBeInTheDocument()
      })
    })

    it('shows error message on fetch failure', async () => {
      ;(fetch as any).mockRejectedValue(new Error('Network error'))
      renderWithRouter(<Dashboard />)
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    it('shows loading state initially', async () => {
      let resolveFetch: any
      const fetchPromise = new Promise((resolve) => { resolveFetch = resolve })
      ;(fetch as any).mockReturnValue(fetchPromise)

      renderWithRouter(<Dashboard />)
      expect(screen.getByText(/Loading your culinary library/i)).toBeInTheDocument()

      resolveFetch({ ok: true, json: async () => [] })
    })
  })

  describe('Recipe Details Page', () => {
    it('renders partial recipe data correctly (no preparation steps)', async () => {
      const partialRecipe = {
        ...mockRecipeDetail,
        instructions: { prep: [], cook: mockRecipeDetail.instructions.cook }
      }

      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => partialRecipe })

      renderWithRouter(<RecipeDetails />, { route: '/recipe/1' })

      await waitFor(() => {
        expect(screen.getByText('Chicken Tacos')).toBeInTheDocument()
      })

      expect(screen.queryByText('Preparation')).not.toBeInTheDocument()
      expect(screen.getByText('Cooking')).toBeInTheDocument()
    })

    it('renders partial recipe data correctly (no cooking steps)', async () => {
      const partialRecipe = {
        ...mockRecipeDetail,
        instructions: { prep: mockRecipeDetail.instructions.prep, cook: [] }
      }

      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => partialRecipe })

      renderWithRouter(<RecipeDetails />, { route: '/recipe/1' })

      await waitFor(() => {
        expect(screen.getByText('Preparation')).toBeInTheDocument()
      })
      expect(screen.queryByText('Cooking')).not.toBeInTheDocument()
    })

    it('shows error message when recipe is not found (404)', async () => {
      ;(fetch as any).mockResolvedValue({ ok: false, status: 404 })
      renderWithRouter(<RecipeDetails />, { route: '/recipe/999' })
      await waitFor(() => {
        expect(screen.getByText(/Recipe not found/i)).toBeInTheDocument()
      })
    })

    it('shows error message on network failure', async () => {
      ;(fetch as any).mockRejectedValue(new Error('Failed to connect'))
      renderWithRouter(<RecipeDetails />, { route: '/recipe/1' })
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect/i)).toBeInTheDocument()
      })
    })

    it('renders all recipe details correctly', async () => {
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => mockRecipeDetail })

      renderWithRouter(<RecipeDetails />, { route: '/recipe/1' })

      await waitFor(() => {
        expect(screen.getByText('Chicken Tacos')).toBeInTheDocument()
        expect(screen.getByText('Chicken')).toBeInTheDocument()
        expect(screen.getByText('Dinner')).toBeInTheDocument()
        expect(screen.getByText('Ingredients')).toBeInTheDocument()
        expect(screen.getByText('Chicken Breast')).toBeInTheDocument()
        expect(screen.getByText('500g')).toBeInTheDocument()
        expect(screen.getByText('Preparation')).toBeInTheDocument()
        expect(screen.getByText('Dice Chicken')).toBeInTheDocument()
        expect(screen.getByText('Cooking')).toBeInTheDocument()
        expect(screen.getByText('Sauté')).toBeInTheDocument()
        expect(screen.getByText(/15\s*m/i)).toBeInTheDocument()
      })
    })

    it('shows the time section even if total time is 0 (regression test)', async () => {
      const zeroTimeRecipe = {
        ...mockRecipeDetail,
        prep_time_mins: 0,
        cook_time_mins: 0,
        instructions: { prep: [], cook: [] } // Clear steps so we don't match timers
      }
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => zeroTimeRecipe })

      renderWithRouter(<RecipeDetails />, { route: '/recipe/66' })

      await waitFor(() => {
        expect(screen.getByText('Chicken Tacos')).toBeInTheDocument()
      })

      // Check for the "Time" label (in a paragraph) and the "0m" value
      expect(screen.getByText('Time', { selector: 'p' })).toBeInTheDocument()
      expect(screen.getByText(/0\s*m/i)).toBeInTheDocument()
    })

    it('handles malformed data gracefully (missing meal_types)', async () => {
      const malformed = { ...mockRecipeDetail, meal_types: undefined }
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => malformed })

      renderWithRouter(<RecipeDetails />, { route: '/recipe/1' })

      await waitFor(() => {
        expect(screen.getByText('Chicken Tacos')).toBeInTheDocument()
      })
    })

    it('handles extremely malformed data gracefully (missing instructions and ingredients)', async () => {
      const broken = { ...mockRecipeDetail, instructions: undefined, ingredients: undefined }
      ;(fetch as any).mockResolvedValue({ ok: true, json: async () => broken })

      renderWithRouter(<RecipeDetails />, { route: '/recipe/1' })

      await waitFor(() => {
        expect(screen.getByText('Chicken Tacos')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation Flow', () => {
    it('full flow: home -> details -> home', async () => {
      const user = userEvent.setup()
      ;(fetch as any).mockImplementation((url: string) => {
        if (url.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: 1,
              username: 'testuser',
              email: 'test@example.com',
              is_active: true,
              created_at: new Date().toISOString()
            })
          })
        }
        if (url.includes('/recipes/')) {
           // Handle both plain /recipes/ and /recipes/?sort_by=...
           if (url.includes('/recipes/1')) return Promise.resolve({ ok: true, json: async () => mockRecipeDetail })
           return Promise.resolve({ ok: true, json: async () => mockRecipes })
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`))
      })

      renderWithRouter(<Dashboard />)
      
      const viewBtn = await screen.findByRole('link', { name: /View Details/i })
      await user.click(viewBtn)
      
      await waitFor(() => {
        expect(screen.getByText('Ingredients')).toBeInTheDocument()
      })

      const backBtn = screen.getByRole('link', { name: /Back to Dashboard/i })
      await user.click(backBtn)

      await waitFor(() => {
        expect(screen.getByText(/My Recipes/i)).toBeInTheDocument()
      })
    })
  })
})
