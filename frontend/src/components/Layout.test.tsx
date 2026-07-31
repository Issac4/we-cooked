import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './Layout'
import { AuthProvider } from '@/context/AuthContext'

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn())

const renderLayout = (initialRoute = '/') => {
  localStorage.setItem('recipe_token', 'mock-token')
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div data-testid="dashboard-page">Dashboard Content</div>} />
            <Route path="add-recipe" element={<div data-testid="add-recipe-page">Add Recipe Page</div>} />
            <Route path="settings" element={<div data-testid="settings-page">Settings Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('Layout Component & Mobile Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => []
    })
  })

  it('renders desktop layout and main outlet content', async () => {
    renderLayout('/')
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('provides a mobile top header menu toggle button on small viewports', async () => {
    renderLayout('/')
    const toggleBtn = screen.getByRole('button', { name: /navigation menu/i })
    expect(toggleBtn).toBeInTheDocument()
  })

  it('opens mobile menu drawer when hamburger button is clicked', async () => {
    renderLayout('/')
    const toggleBtn = screen.getByRole('button', { name: /open navigation menu/i })
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      const closeBtn = screen.getByRole('button', { name: /close drawer/i })
      expect(closeBtn).toBeInTheDocument()
    })
  })

  it('closes mobile drawer when navigation link is clicked', async () => {
    renderLayout('/')
    const toggleBtn = screen.getByRole('button', { name: /open navigation menu/i })
    fireEvent.click(toggleBtn)

    const addRecipeLinks = await screen.findAllByRole('link', { name: /add recipe/i })
    fireEvent.click(addRecipeLinks[0])

    await waitFor(() => {
      expect(screen.getByTestId('add-recipe-page')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /close drawer/i })).not.toBeInTheDocument()
    })
  })
})
