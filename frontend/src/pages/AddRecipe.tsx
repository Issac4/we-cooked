import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiFetch, formatErrorDetail } from '@/lib/api'
import { RecipeForm } from '@/components/RecipeForm'
import type { RecipeCreate } from '@/types/api'

export default function AddRecipe() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (formData: RecipeCreate, imageFile: File | null) => {
    setLoading(true)
    setError(null)

    try {
      let cover_image_url = formData.cover_image_url

      // 1. Upload image if selected
      if (imageFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('file', imageFile)

        const uploadResponse = await apiFetch('/uploads/', {
          method: 'POST',
          body: uploadFormData,
          headers: {} 
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image')
        }

        const uploadData = await uploadResponse.json()
        cover_image_url = uploadData.url
      }

      // 2. Create recipe
      const response = await apiFetch('/recipes/', {
        method: 'POST',
        body: JSON.stringify({ ...formData, cover_image_url })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(formatErrorDetail(data.detail) || 'Failed to create recipe')
      }

      const newRecipe = await response.json()
      toast.success('Recipe created successfully!')
      navigate(`/recipe/${newRecipe.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(msg)
      toast.error(msg)
      setLoading(false)
      throw err // Re-throw to be caught by RecipeForm's internal error handler if needed
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      <header className="mb-10">
        <Link to="/" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 -ml-4 text-slate-500 hover:text-blue-600 gap-2")}>
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">Create New Recipe</h1>
        <p className="text-slate-500 text-lg">Add a new culinary masterpiece to your collection.</p>
      </header>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3">
          <p className="font-medium">{error}</p>
        </div>
      )}

      <RecipeForm 
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Save Recipe"
      />
    </div>
  )
}
