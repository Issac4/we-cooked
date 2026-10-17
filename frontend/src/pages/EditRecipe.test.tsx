import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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

  it('normalizes missing cover_image_url in restored draft to null so preview and PUT payload agree', async () => {
    // Draft saved from a recipe without cover_image_url (where undefined was omitted by JSON.stringify)
    localStorage.setItem(
      'recipe_draft',
      JSON.stringify({
        title: 'Draft Without Cover Image Key',
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
        attributes: {}
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

    expect(screen.getByAltText('Preview')).toBeInTheDocument()

    const restoreBtn = await screen.findByRole('button', { name: /Restore/i })
    fireEvent.click(restoreBtn)

    // Preview is cleared and PUT payload explicitly sends cover_image_url: null
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

  it('prevents delayed FileReader onloadend from resurrecting a removed image preview', async () => {
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

    let capturedReader: { onloadend: (() => void) | null; result: string; readAsDataURL: ReturnType<typeof vi.fn> } | null = null
    const OriginalFileReader = window.FileReader
    class ControlledFileReader {
      onloadend: (() => void) | null = null
      result = 'data:image/png;base64,STALE'
      readAsDataURL = vi.fn(() => {
        capturedReader = this
      })
    }
    vi.stubGlobal('FileReader', ControlledFileReader)

    try {
      renderEditRecipe()

      await waitFor(() => {
        expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
      })

      const fileInput = screen.getByLabelText(/Upload recipe image/i) as HTMLInputElement
      const file = new File(['image-bytes'], 'photo.png', { type: 'image/png' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      expect(capturedReader).not.toBeNull()

      // User clicks Remove before FileReader finishes reading
      const removeImageBtn = screen.getByRole('button', { name: /^Remove$/i })
      fireEvent.click(removeImageBtn)
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()

      // Now the stale FileReader finishes
      act(() => {
        capturedReader!.onloadend?.()
      })

      // Preview must remain absent
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()
    } finally {
      vi.stubGlobal('FileReader', OriginalFileReader)
    }
  })

  it('restores cover_image_url and preview when restoring a draft that has an image URL', async () => {
    localStorage.setItem(
      'recipe_draft',
      JSON.stringify({
        title: 'Draft With Cover Image URL',
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
        cover_image_url: '/uploads/draft-image.jpg'
      })
    )

    const recipeWithoutImage = { ...mockRecipe, cover_image_url: null }

    vi.mocked(fetch).mockImplementation((url, init) => {
      if (url.toString().includes('/recipes/1') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => recipeWithoutImage } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      if (url.toString().includes('/recipes/1') && init?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({ ...mockRecipe, cover_image_url: '/uploads/draft-image.jpg', id: 1 }) } as Response)
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Recipe')).toBeInTheDocument()
    })

    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument()

    const restoreBtn = await screen.findByRole('button', { name: /Restore/i })
    fireEvent.click(restoreBtn)

    const previewImg = screen.getByAltText('Preview') as HTMLImageElement
    expect(previewImg).toBeInTheDocument()
    expect(previewImg.src).toContain('/uploads/draft-image.jpg')

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      const putCall = vi.mocked(fetch).mock.calls.find((call) =>
        call[0].toString().includes('/recipes/1') && call[1]?.method === 'PUT'
      )
      expect(putCall).toBeDefined()
      const payload = JSON.parse(putCall![1]!.body as string)
      expect(payload).toHaveProperty('cover_image_url', '/uploads/draft-image.jpg')
    })
  })

  it('keeps RecipeForm mounted with user edits intact when PUT submission fails and allows retry', async () => {
    let putAttempts = 0
    let resolveRetryPut: ((value: Response) => void) | null = null

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
        putAttempts++
        if (putAttempts === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ detail: 'Database connection error' })
          } as Response)
        }
        return new Promise<Response>((resolve) => {
          resolveRetryPut = resolve
        })
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    const titleInput = await screen.findByDisplayValue('Existing Recipe')
    fireEvent.change(titleInput, { target: { value: 'Edited Recipe Title' } })

    const ingredientAmountInput = screen.getByDisplayValue('500g')
    fireEvent.change(ingredientAmountInput, { target: { value: '750g' } })

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    // Error message should be displayed, but form must stay mounted with edits intact
    await waitFor(() => {
      expect(screen.getByText(/Database connection error/i)).toBeInTheDocument()
    })

    expect(screen.queryByRole('link', { name: /Back to Dashboard/i })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Edited Recipe Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('750g')).toBeInTheDocument()

    // User can retry submission; stale error banner clears immediately while retry is in-flight
    const retrySaveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    expect(retrySaveBtn).not.toBeDisabled()
    fireEvent.click(retrySaveBtn)

    await waitFor(() => {
      expect(putAttempts).toBe(2)
      expect(screen.queryByText(/Database connection error/i)).not.toBeInTheDocument()
    })

    await act(async () => {
      resolveRetryPut!({
        ok: true,
        json: async () => ({ ...mockRecipe, title: 'Edited Recipe Title', id: 1 })
      } as Response)
    })
  })

  it('does not re-fetch form options or overwrite the submit error when PUT fails due to a network error', async () => {
    let initialLoaded = false

    vi.mocked(fetch).mockImplementation((url, init) => {
      if (url.toString().includes('/recipes/1') && (!init?.method || init.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => mockRecipe } as Response)
      }
      if (url.toString().includes('/proteins/')) {
        if (initialLoaded) {
          return Promise.reject(new Error('Network offline'))
        }
        return Promise.resolve({ ok: true, json: async () => mockProteins } as Response)
      }
      if (url.toString().includes('/meal-types/')) {
        if (initialLoaded) {
          return Promise.reject(new Error('Network offline'))
        }
        return Promise.resolve({ ok: true, json: async () => mockMealTypes } as Response)
      }
      if (url.toString().includes('/recipes/1') && init?.method === 'PUT') {
        return Promise.reject(new Error('Network offline'))
      }
      return Promise.reject(new Error('Not found'))
    })

    renderEditRecipe()

    await screen.findByDisplayValue('Existing Recipe')
    await screen.findByRole('button', { name: 'Chicken' })
    initialLoaded = true

    const saveBtn = screen.getByRole('button', { name: /Update Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText(/Network offline/i)).toBeInTheDocument()
    })

    expect(screen.queryByText(/Failed to load form options/i)).not.toBeInTheDocument()
  })
})



