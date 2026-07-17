import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AddRecipe from './AddRecipe'
import { AuthProvider } from '../context/AuthContext'

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn())

const renderAddRecipe = () => {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <AddRecipe />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('AddRecipe Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('recipe_token', 'mock-token')
  })

  it('renders all form sections', async () => {
    ;(fetch as any).mockResolvedValue({ 
      ok: true, 
      json: async () => [] 
    })

    renderAddRecipe()

    expect(screen.getByText(/Create New Recipe/i)).toBeInTheDocument()
    expect(screen.getByText(/Basic Information/i)).toBeInTheDocument()
    expect(screen.getByText(/Proteins/i)).toBeInTheDocument()
    expect(screen.getByText(/Meal Types/i)).toBeInTheDocument()
    expect(screen.getByText(/Ingredients/i)).toBeInTheDocument()
    expect(screen.getByText(/Preparation Steps/i)).toBeInTheDocument()
    expect(screen.getByText(/Cooking Steps/i)).toBeInTheDocument()
  })

  it('can add and remove ingredients', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    renderAddRecipe()

    const addBtn = screen.getByRole('button', { name: /Add Ingredient/i })
    fireEvent.click(addBtn)

    const inputs = screen.getAllByPlaceholderText(/Item \(e.g. Flour\)/i)
    expect(inputs).toHaveLength(2)

    const removeBtns = screen.getAllByLabelText(/Remove ingredient/i)
    fireEvent.click(removeBtns[0])

    expect(screen.getAllByPlaceholderText(/Item \(e.g. Flour\)/i)).toHaveLength(1)
  })

  it('can add and remove reference links', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    renderAddRecipe()

    const addBtn = screen.getByRole('button', { name: /Add Reference Link/i })
    fireEvent.click(addBtn)

    const titleInputs = screen.getAllByPlaceholderText(/e.g. Video Tutorial/i)
    expect(titleInputs).toHaveLength(1)

    const urlInputs = screen.getAllByPlaceholderText(/https:\/\/.../i)
    expect(urlInputs).toHaveLength(1)

    // Remove it
    const removeBtn = screen.getByLabelText(/Remove reference link/i)
    fireEvent.click(removeBtn)

    expect(screen.queryByPlaceholderText(/e.g. Video Tutorial/i)).toBeNull()
  })

  it('can add a new protein category on the fly', async () => {
    // Initial fetch for proteins/meal-types
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: 'Chicken' }] }) // proteins
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: 'Dinner' }] }) // meal-types
    
    renderAddRecipe()
    await waitFor(() => expect(screen.getByText('Chicken')).toBeInTheDocument())

    // 1. Click the [+] button next to Proteins
    const addProteinBtn = screen.getAllByRole('button').find(btn => {
      // Find the button with Plus icon inside the Protein card header
      // Since it's a ghost button with no text, we'll look for the first one that matches
      return btn.querySelector('.lucide-plus')
    })
    fireEvent.click(addProteinBtn!)

    // 2. Type new protein name
    const input = screen.getByPlaceholderText(/New protein name.../i)
    fireEvent.change(input, { target: { value: 'Fish' } })

    // 3. Mock the POST response
    ;(fetch as any).mockResolvedValueOnce({ 
      ok: true, 
      json: async () => ({ id: 2, name: 'Fish' }) 
    })

    // 4. Click Add
    fireEvent.click(screen.getByLabelText(/Confirm add protein/i))

    // 5. Verify it's in the list and selected
    await waitFor(() => expect(screen.getByText('Fish')).toBeInTheDocument(), { timeout: 3000 })
  })

  it('validates required fields', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    renderAddRecipe()

    const saveBtn = screen.getByRole('button', { name: /Save Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText(/Recipe title is required/i)).toBeInTheDocument()
    })
  })

  it('shows image preview when a file is selected (regression test)', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    renderAddRecipe()

    const file = new File(['hello'], 'hello.png', { type: 'image/png' })
    const input = screen.getByLabelText(/Upload recipe image/i)
    
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByAltText(/Preview/i)).toBeInTheDocument()
    })
  })

  it('cleans up empty fields before submission (Auto-Cleanup)', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    renderAddRecipe()

    // 1. Set title
    const titleInput = screen.getByPlaceholderText(/e.g. Classic Beef Stroganoff/i)
    fireEvent.change(titleInput, { target: { value: 'Clean Recipe' } })

    // 2. Add an empty ingredient (there's already one by default)
    // Fill the first one
    const ingInputs = screen.getAllByPlaceholderText(/Item \(e.g. Flour\)/i)
    fireEvent.change(ingInputs[0], { target: { value: 'Real Ingredient' } })

    // Add another and leave it empty
    const addIngBtn = screen.getByRole('button', { name: /Add Ingredient/i })
    fireEvent.click(addIngBtn)

    // 3. Add an empty step
    // Fill the first prep step
    const prepActionInputs = screen.getAllByPlaceholderText(/Action \(e.g. Dice the onions\)/i)
    fireEvent.change(prepActionInputs[0], { target: { value: 'Real Step' } })

    // Add another and leave it empty
    const addStepBtn = screen.getByRole('button', { name: /Add Preparation Step/i })
    fireEvent.click(addStepBtn)

    // 4. Add an empty reference link
    const addLinkBtn = screen.getByRole('button', { name: /Add Reference Link/i })
    fireEvent.click(addLinkBtn)

    // 5. Submit
    const saveBtn = screen.getByRole('button', { name: /Save Recipe/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      // Find the POST request to /recipes/
      const recipeCall = (fetch as any).mock.calls.find((call: any) => 
        call[0].includes('/recipes/') && call[1].method === 'POST'
      )
      expect(recipeCall).toBeDefined()
      const payload = JSON.parse(recipeCall[1].body)

      // Verify cleanup
      expect(payload.ingredients).toHaveLength(1)
      expect(payload.ingredients[0].item).toBe('Real Ingredient')
      
      expect(payload.instructions.prep).toHaveLength(1)
      expect(payload.instructions.prep[0].action).toBe('Real Step')
      expect(payload.instructions.prep[0].step).toBe(1) // Re-indexed
      
      expect(payload.reference_links).toHaveLength(0) // Empty one removed
    })
  })

  it('constrains title length to 255 characters', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, json: async () => [] })
    renderAddRecipe()

    const titleInput = screen.getByPlaceholderText(/e.g. Classic Beef Stroganoff/i)
    expect(titleInput).toHaveAttribute('maxLength', '255')
  })
})
