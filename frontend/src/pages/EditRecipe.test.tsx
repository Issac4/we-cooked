import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

  it('omits timer_mins when submitting an existing recipe that has timer_mins: 0 without editing', async () => {
    const legacyRecipe = {
      ...mockRecipe,
      instructions: {
        prep: [{ step: 1, action: 'Wash chicken', description: '' }],
        cook: [{ step: 1, action: 'Fry chicken', description: '', timer_mins: 0 }]
      }
    }

    vi.mocked(fetch).mockImplementation((url, init) => {
      if (url.toString().includes('/recipes/1') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => legacyRecipe } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      if (url.toString().includes('/recipes/1') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ ...legacyRecipe, id: 1 }) } as Response)
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      const putCall = vi.mocked(fetch).mock.calls.find((call) => 
        call[0].toString().includes('/recipes/1') && call[1]?.method === 'PUT'
      )
      expect(putCall).toBeDefined()
      const payload = JSON.parse(putCall![1]!.body as string)
      expect(payload.instructions.cook[0].timer_mins).toBeUndefined()
    })
  })

  it('omits timer_mins when clearing an existing positive timer', async () => {
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (url.toString().includes('/recipes/1') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => mockRecipe } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      if (url.toString().includes('/recipes/1') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ ...mockRecipe, id: 1 }) } as Response)
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
    })

    const timerInput = screen.getByLabelText(/Cooking step 1 timer in minutes/i)
    fireEvent.change(timerInput, { target: { value: '' } })

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      const putCall = vi.mocked(fetch).mock.calls.find((call) => 
        call[0].toString().includes('/recipes/1') && call[1]?.method === 'PUT'
      )
      expect(putCall).toBeDefined()
      const payload = JSON.parse(putCall![1]!.body as string)
      expect(payload.instructions.cook[0].timer_mins).toBeUndefined()
    })
  })

  it('sends cover_image_url: null in PUT payload when removing an existing cover image', async () => {
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (url.toString().includes('/recipes/1') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => mockRecipe } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      if (url.toString().includes('/recipes/1') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ ...mockRecipe, cover_image_url: null, id: 1 }) } as Response)
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
    })

    expect(screen.getByAltText('Preview')).toBeInTheDocument()

    const removeImageBtn = screen.getByRole('button', { name: /^Remove$/i })
    fireEvent.click(removeImageBtn)

    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      const putCall = vi.mocked(fetch).mock.calls.find((call) =>
        call[0].toString().includes('/recipes/1') && call[1]?.method === 'PUT'
      )
      expect(putCall).toBeDefined()
      const payload = JSON.parse(putCall![1]!.body as string)
      expect(payload).toHaveProperty('cover_image_url', null)
    })
  })

  it('resets the file input value when removing an image so the same file can be re-selected', async () => {
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

    const fileInput = screen.getByLabelText(/Upload recipe image/i) as HTMLInputElement
    const file = new File(['image-bytes'], 'photo.png', { type: 'image/png' })

    // Simulate selecting a file (in real browsers input.value becomes non-empty)
    Object.defineProperty(fileInput, 'value', {
      value: 'C:\\fakepath\\photo.png',
      writable: true,
      configurable: true
    })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const removeImageBtn = screen.getByRole('button', { name: /^Remove$/i })
    fireEvent.click(removeImageBtn)

    expect(fileInput.value).toBe('')
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
  })

  it('synchronizes imagePreview and clears imageFile when restoring a draft that removed the cover image', async () => {
    localStorage.setItem(
      'recipe_draft',
      JSON.stringify({
        title: 'Existing Recipe Draft',
        protein_ids: [1],
        meal_type_ids: [1],
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
        cover_image_url: null
      })
    )

    vi.mocked(fetch).mockImplementation((url, init) => {
      if (url.toString().includes('/recipes/1') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => mockRecipe } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      if (url.toString().includes('/recipes/1') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ ...mockRecipe, cover_image_url: null, id: 1 }) } as Response)
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
    })

    // Initial recipe has a cover image preview
    expect(screen.getByAltText('Preview')).toBeInTheDocument()

    // Click Restore on the draft banner
    const restoreBtn = await screen.findByRole('button', { name: /Restore/i })
    fireEvent.click(restoreBtn)

    // Preview should be cleared because the restored draft had cover_image_url: null
    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Existing Recipe Draft')).toBeInTheDocument()

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      const putCall = vi.mocked(fetch).mock.calls.find((call) =>
        call[0].toString().includes('/recipes/1') && call[1]?.method === 'PUT'
      )
      expect(putCall).toBeDefined()
      const payload = JSON.parse(putCall![1]!.body as string)
      expect(payload).toHaveProperty('cover_image_url', null)
    })
  })
})

