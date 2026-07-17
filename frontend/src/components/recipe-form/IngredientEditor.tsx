import { Plus, Trash2, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRecipeForm } from './RecipeFormContext'

export const IngredientEditor = () => {
  const { formData, handleUpdateIngredient, handleAddIngredient, handleRemoveIngredient } = useRecipeForm()
  const { ingredients } = formData

  return (
    <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
      <CardHeader className="bg-slate-900 text-white pb-6 pt-8">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Utensils className="w-5 h-5 text-blue-400" />
          Ingredients
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-4">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex gap-4 items-start">
              <div className="flex-1">
                <Input 
                  placeholder="Item (e.g. Flour)" 
                  value={ing.item}
                  onChange={(e) => handleUpdateIngredient(idx, 'item', e.target.value)}
                />
              </div>
              <div className="w-32">
                <Input 
                  placeholder="Amount" 
                  value={ing.amount}
                  onChange={(e) => handleUpdateIngredient(idx, 'amount', e.target.value)}
                />
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                aria-label="Remove ingredient"
                onClick={() => handleRemoveIngredient(idx)}
                className="text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleAddIngredient}
            className="w-full border-dashed border-2 py-6 rounded-2xl text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Ingredient
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
