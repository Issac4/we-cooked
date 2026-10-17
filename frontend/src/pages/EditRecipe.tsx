import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { apiFetch, formatErrorDetail } from '@/lib/api'
import { RecipeForm } from '@/components/RecipeForm'
import type { Recipe, RecipeCreate, Protein, MealType } from '@/types/api'

export default function EditRecipe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [proteins, setProteins] = useState<Protein[]>([])
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const uploadedImageRef = useRef<{ file: File; url: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipeRes, proteinsRes, mealTypesRes] = await Promise.all([
          apiFetch(`/recipes/${id}`),
          apiFetch('/proteins/'),
          apiFetch('/meal-types/')
        ])

        if (!recipeRes.ok) throw new Error('Recipe not found')
        
        const recipeData: Recipe = await recipeRes.json()
        const proteinData: Protein[] = await proteinsRes.json()
        const mealTypeData: MealType[] = await mealTypesRes.json()

        setRecipe(recipeData)
        setProteins(proteinData)
        setMealTypes(mealTypeData)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setFetchError(err.message)
        } else {
          setFetchError('An unknown error occurred')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const handleSubmit = async (formData: RecipeCreate, imageFile: File | null) => {
    setSubmitting(true)

    try {
      let cover_image_url = formData.cover_image_url

      // 1. Upload image if NEW file selected
      if (imageFile) {
        let reusableUrl: string | null = null
        if (uploadedImageRef.current?.file === imageFile) {
          const checkRes = await apiFetch(uploadedImageRef.current.url, {
            method: 'HEAD'
          }).catch(() => null)
          if (checkRes?.ok) {
            reusableUrl = uploadedImageRef.current.url
          } else {
            uploadedImageRef.current = null
          }
        }

        if (reusableUrl) {
          cover_image_url = reusableUrl
        } else {
          const uploadFormData = new FormData()
          uploadFormData.append('file', imageFile)

          const uploadResponse = await apiFetch('/uploads/', {
            method: 'POST',
            body: uploadFormData,
            headers: {} 
          })

          if (!uploadResponse.ok) {
            const uploadErr = await uploadResponse.json().catch(() => null)
            throw new Error(formatErrorDetail(uploadErr?.detail) || 'Failed to upload image')
          }

          const uploadData = await uploadResponse.json()
          cover_image_url = uploadData.url
          uploadedImageRef.current = { file: imageFile, url: uploadData.url }
        }
      } else {
        uploadedImageRef.current = null
      }

      // 2. Update recipe
      const response = await apiFetch(`/recipes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...formData, cover_image_url })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(formatErrorDetail(data?.detail) || 'Failed to update recipe')
      }

      toast.success('Recipe updated successfully!')
      navigate(`/recipe/${id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred'
      toast.error(msg)
      setSubmitting(false)
      throw err
    }
  }

  // Transform Recipe to RecipeCreate format for the form
  const initialData = useMemo<Partial<RecipeCreate> | undefined>(() => {
    if (!recipe) return undefined
    return {
      title: recipe.title,
      protein_ids: recipe.proteins.map(name => proteins.find(p => p.name === name)?.id).filter(Boolean) as number[],
      meal_type_ids: recipe.meal_types.map(name => mealTypes.find(mt => mt.name === name)?.id).filter(Boolean) as number[],
      servings: recipe.servings,
      prep_time_mins: recipe.prep_time_mins,
      cook_time_mins: recipe.cook_time_mins,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      reference_links: recipe.reference_links,
      attributes: recipe.attributes,
      cover_image_url: recipe.cover_image_url
    }
  }, [recipe, proteins, mealTypes])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium">Loading recipe data...</p>
      </div>
    )
  }

  if (fetchError || !recipe) {
    return (
      <div className="p-8 max-w-md mx-auto py-20 text-center">
        <div className="bg-red-50 border border-red-100 p-8 rounded-[2rem] shadow-sm">
            <h2 className="text-2xl font-black text-red-700 mb-2">Error</h2>
            <p className="text-slate-600 mb-6">{fetchError || 'Recipe not found'}</p>
            <Link to="/" className={cn(buttonVariants({ variant: "default" }), "w-full rounded-xl")}>
                Back to Dashboard
            </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-20">
      <header className="mb-8 sm:mb-10">
        <Link to={`/recipe/${id}`} className={cn(buttonVariants({ variant: "ghost" }), "mb-4 -ml-2 text-slate-500 hover:text-blue-600 gap-2 w-fit")}>
          <ArrowLeft className="w-4 h-4" />
          Back to Recipe
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Edit Recipe</h1>
        <p className="text-slate-500 text-sm sm:text-lg">Update your recipe details and keep them fresh.</p>
      </header>

      <RecipeForm 
        initialData={initialData}
        onSubmit={handleSubmit}
        loading={submitting}
        submitLabel="Update Recipe"
      />
    </div>
  )
}
