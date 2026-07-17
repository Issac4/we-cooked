import { Plus, Timer, ChefHat } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRecipeForm } from './RecipeFormContext'

export const BasicInfo = () => {
  const { formData, handleInputChange } = useRecipeForm()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Recipe Title</Label>
        <Input 
          id="title" 
          name="title" 
          placeholder="e.g. Classic Beef Stroganoff" 
          value={formData.title}
          onChange={handleInputChange}
          maxLength={255}
          className="h-12 text-lg px-4"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label htmlFor="servings" className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-slate-400" /> Servings
          </Label>
          <Input 
            id="servings" 
            name="servings" 
            type="number" 
            value={formData.servings}
            onChange={handleInputChange}
            min="1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prep_time_mins" className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-slate-400" /> Prep Time (mins)
          </Label>
          <Input 
            id="prep_time_mins" 
            name="prep_time_mins" 
            type="number" 
            value={formData.prep_time_mins}
            onChange={handleInputChange}
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cook_time_mins" className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-slate-400" /> Cook Time (mins)
          </Label>
          <Input 
            id="cook_time_mins" 
            name="cook_time_mins" 
            type="number" 
            value={formData.cook_time_mins}
            onChange={handleInputChange}
            min="0"
          />
        </div>
      </div>
    </div>
  )
}
