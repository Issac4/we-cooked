import { Info, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { RecipeCreate } from '@/types/api'
import { SessionExpiredError } from '@/lib/api'

// Context
import { RecipeFormProvider, useRecipeForm } from './recipe-form/RecipeFormContext'

// Sub-modules
import { BasicInfo } from './recipe-form/BasicInfo'
import { ImagePicker } from './recipe-form/ImagePicker'
import { CategoryEditor } from './recipe-form/CategoryEditor'
import { IngredientEditor } from './recipe-form/IngredientEditor'
import { InstructionEditor } from './recipe-form/InstructionEditor'
import { ReferenceLinkEditor } from './recipe-form/ReferenceLinkEditor'

interface RecipeFormProps {
  initialData?: Partial<RecipeCreate>;
  onSubmit: (data: RecipeCreate, imageFile: File | null) => Promise<void>;
  loading: boolean;
  submitLabel: string;
}

export function RecipeForm(props: RecipeFormProps) {
  return (
    <RecipeFormProvider initialData={props.initialData} loading={props.loading}>
      <RecipeFormInner {...props} />
    </RecipeFormProvider>
  )
}

function RecipeFormInner({ onSubmit, loading, submitLabel }: RecipeFormProps) {
  const { 
    formData, 
    imageFile, 
    error, 
    setError,
    hasDraft,
    restoreDraft,
    clearDraft,
    saveDraft
  } = useRecipeForm()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) {
      setError("Recipe title is required")
      return
    }

    const cleanedData: RecipeCreate = {
      ...formData,
      ingredients: formData.ingredients.filter(ing => ing.item.trim() || ing.amount.trim()),
      instructions: {
        prep: formData.instructions.prep
          .filter(step => step.action.trim() || step.description?.trim())
          .map((step, idx) => ({ ...step, step: idx + 1 })),
        cook: formData.instructions.cook
          .filter(step => step.action.trim() || step.description?.trim())
          .map((step, idx) => ({ ...step, step: idx + 1 }))
      },
      reference_links: formData.reference_links.filter(link => link.url.trim())
    }

    onSubmit(cleanedData, imageFile)
      .then(() => clearDraft())
      .catch((err: Error) => {
        if (err instanceof SessionExpiredError) {
          saveDraft()
          window.location.href = '/login'
        }
        setError(err.message)
      })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {hasDraft && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">You have an unsaved draft from a previous session.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={restoreDraft}
              className="rounded-lg border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Restore
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={clearDraft}
              className="rounded-lg text-blue-600 hover:bg-blue-100"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3">
          <Info className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Section 1: Basic Info */}
      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-6">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <ImagePicker />
          <BasicInfo />
        </CardContent>
      </Card>

      {/* Section 2: Categories */}
      <CategoryEditor />

      {/* Section 3: Ingredients */}
      <IngredientEditor />

      {/* Section 4: Instructions */}
      <InstructionEditor />

      {/* Section 5: Reference Links */}
      <ReferenceLinkEditor />

      <div className="flex gap-4 justify-end pt-10">
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-slate-900 hover:bg-blue-600 text-white rounded-xl px-12 h-12 text-lg font-bold shadow-lg shadow-slate-200 transition-all gap-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
