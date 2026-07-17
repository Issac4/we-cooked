import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useRecipeForm } from './RecipeFormContext'

export const CategoryEditor = () => {
  const {
    formData,
    proteins,
    mealTypes,
    toggleProtein,
    toggleMealType,
    handleAddProtein,
    handleAddMealType,
    showAddProtein,
    setShowAddProtein,
    showAddMealType,
    setShowAddMealType,
    newProteinName,
    setNewProteinName,
    newMealTypeName,
    setNewMealTypeName,
    proteinExists,
    mealTypeExists
  } = useRecipeForm()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 flex flex-row items-center justify-between px-6">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            Proteins
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddProtein(!showAddProtein)}
            className="text-blue-600 hover:bg-blue-50 rounded-full h-8 w-8 p-0"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {showAddProtein && (
            <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2">
                <Input
                  placeholder="New protein name..."
                  value={newProteinName}
                  onChange={(e) => setNewProteinName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !proteinExists && (e.preventDefault(), handleAddProtein(newProteinName))}
                  className={cn(
                    "h-9 text-sm",
                    proteinExists && "border-red-400 focus:ring-red-100"
                  )}
                  autoFocus
                />
                <Button 
                  type="button" 
                  size="sm" 
                  aria-label="Confirm add protein"
                  onClick={() => handleAddProtein(newProteinName)}
                  disabled={proteinExists || !newProteinName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Add
                </Button>
              </div>
              {proteinExists && (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider ml-1">
                  This protein already exists
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {Array.isArray(proteins) && proteins.map(protein => (
              <button
                key={protein.id}
                type="button"
                onClick={() => toggleProtein(protein.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                  formData.protein_ids.includes(protein.id)
                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {protein.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 flex flex-row items-center justify-between px-6">
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
            Meal Types
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddMealType(!showAddMealType)}
            className="text-green-600 hover:bg-green-50 rounded-full h-8 w-8 p-0"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {showAddMealType && (
            <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2">
                <Input
                  placeholder="New meal type..."
                  value={newMealTypeName}
                  onChange={(e) => setNewMealTypeName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !mealTypeExists && (e.preventDefault(), handleAddMealType(newMealTypeName))}
                  className={cn(
                    "h-9 text-sm",
                    mealTypeExists && "border-red-400 focus:ring-red-100"
                  )}
                  autoFocus
                />
                <Button 
                  type="button" 
                  size="sm" 
                  aria-label="Confirm add meal type"
                  onClick={() => handleAddMealType(newMealTypeName)}
                  disabled={mealTypeExists || !newMealTypeName.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Add
                </Button>
              </div>
              {mealTypeExists && (
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider ml-1">
                  This meal type already exists
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {Array.isArray(mealTypes) && mealTypes.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleMealType(type.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                  formData.meal_type_ids.includes(type.id)
                    ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-100"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {type.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
