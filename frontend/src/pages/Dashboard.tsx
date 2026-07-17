import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Utensils, Search, ArrowUpDown, SortAsc, SortDesc, Calendar, Type, Clock, History as HistoryIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { RecipeImage } from '@/components/RecipeImage'
import type { Recipe } from '@/types/api'

type SortOption = 'created_at' | 'title' | 'total_time'
type OrderOption = 'asc' | 'desc'

function Dashboard() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get('sort_by') as SortOption) || 'created_at')
  const [order, setOrder] = useState<OrderOption>((searchParams.get('order') as OrderOption) || 'desc')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const activeProteins = useMemo(() => searchParams.get('proteins')?.split(',').filter(Boolean) || [], [searchParams])
  const activeMealTypes = useMemo(() => searchParams.get('meal_types')?.split(',').filter(Boolean) || [], [searchParams])

  const fetchRecipes = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    
    // Construct query string for FastAPI (repeating keys for lists)
    const params = new URLSearchParams()
    if (debouncedSearch) params.append('search', debouncedSearch)
    activeProteins.forEach(id => params.append('protein_ids', id))
    activeMealTypes.forEach(id => params.append('meal_type_ids', id))
    params.append('sort_by', sortBy)
    params.append('order', order)
    
    const queryString = params.toString()
    const url = queryString ? `/recipes/?${queryString}` : '/recipes/'

    apiFetch(url, { signal })
      .then(async res => {
        if (!res.ok) {
            throw new Error(`Failed to fetch recipes (${res.status})`);
        }
        return res.json()
      })
      .then(data => {
        setRecipes(data)
        setLoading(false)
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [debouncedSearch, activeProteins, activeMealTypes, sortBy, order])

  useEffect(() => {
    const controller = new AbortController()
    fetchRecipes(controller.signal)
    return () => controller.abort()
  }, [fetchRecipes])

  const updateSort = (newSort: SortOption) => {
    setSortBy(newSort)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('sort_by', newSort)
    setSearchParams(newParams)
  }

  const toggleOrder = () => {
    const newOrder = order === 'asc' ? 'desc' : 'asc'
    setOrder(newOrder)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('order', newOrder)
    setSearchParams(newParams)
  }

  const isFiltered = activeProteins.length > 0 || activeMealTypes.length > 0 || !!debouncedSearch

  return (
    <div className="p-8">
      <header className="mb-12 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              {isFiltered ? 'Filtered Results' : 'My Recipes'}
            </h1>
            <p className="text-slate-500 text-lg">
              {isFiltered 
                ? `Showing recipes matching your criteria (${recipes.length} found)` 
                : 'Manage your culinary collection'}
            </p>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <Input 
              placeholder="Search recipes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-slate-200 focus:border-blue-300 focus:ring-blue-100 bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Sorting Controls */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-xl">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Sort by</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => updateSort('created_at')}
              className={cn(
                "rounded-xl h-9 px-4 gap-2 text-sm font-bold transition-all",
                sortBy === 'created_at' ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Calendar className="w-4 h-4" />
              Date
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => updateSort('title')}
              className={cn(
                "rounded-xl h-9 px-4 gap-2 text-sm font-bold transition-all",
                sortBy === 'title' ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Type className="w-4 h-4" />
              Title
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => updateSort('total_time')}
              className={cn(
                "rounded-xl h-9 px-4 gap-2 text-sm font-bold transition-all",
                sortBy === 'total_time' ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Clock className="w-4 h-4" />
              Time
            </Button>
          </div>

          <div className="w-px h-6 bg-slate-100 mx-1" />

          <Button 
            variant="outline" 
            size="sm"
            onClick={toggleOrder}
            className="rounded-xl h-9 px-4 gap-2 text-sm font-bold border-slate-200 text-slate-600 hover:bg-slate-50 shadow-none min-w-[140px] justify-start"
          >
            {order === 'asc' ? (
              <>
                <SortAsc className="w-4 h-4 text-blue-500" />
                {sortBy === 'created_at' && 'Oldest First'}
                {sortBy === 'title' && 'A → Z'}
                {sortBy === 'total_time' && 'Fastest First'}
              </>
            ) : (
              <>
                <SortDesc className="w-4 h-4 text-blue-500" />
                {sortBy === 'created_at' && 'Newest First'}
                {sortBy === 'title' && 'Z → A'}
                {sortBy === 'total_time' && 'Longest First'}
              </>
            )}
          </Button>
        </div>
      </header>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-500 font-medium">Loading your culinary library...</p>
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50/50 max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-800">Connection Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => fetchRecipes()}>Retry</Button>
          </CardFooter>
        </Card>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm">
          <Utensils className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {isFiltered ? 'No matches found' : 'No recipes found'}
          </h3>
          <p className="text-slate-500 max-w-xs mx-auto mb-6">
            {isFiltered 
              ? 'Try adjusting your search or filters to find what you are looking for.' 
              : 'Start your collection by adding your first masterpiece.'}
          </p>
          {!isFiltered && (
            <Link 
              to="/recipe/add"
              className={cn(buttonVariants({ variant: "default" }), "bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8")}
            >
              Add Your First Recipe
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 items-start">
        {recipes.map(recipe => (
          <Card key={recipe.id} className="group overflow-hidden border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 rounded-2xl flex flex-col p-0">
            <RecipeImage 
              src={recipe.cover_image_url} 
              alt={recipe.title}
              containerClassName="h-48"
              className="group-hover:scale-110 transition-transform duration-500"
            />
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-1">
                <CardTitle className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {recipe.title}
                </CardTitle>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-1">
                  <HistoryIcon className="w-3 h-3 text-blue-500" />
                  {recipe.cook_count || 0} times
                </div>
                {recipe.last_cooked && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" />
                    {new Date(recipe.last_cooked).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex flex-wrap gap-2">
                {recipe.proteins?.map(protein => (
                  <Badge key={protein} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1">
                    {protein}
                  </Badge>
                ))}
                {recipe.meal_types?.map(type => (
                  <Badge key={type} variant="outline" className="text-slate-600 border-slate-200 px-3 py-1">
                    {type}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 pt-6">
              <Link 
                to={`/recipe/${recipe.id}`}
                className={cn(buttonVariants({ variant: "default" }), "w-full bg-slate-900 hover:bg-blue-600 text-white rounded-xl transition-all h-10 flex items-center justify-center")}
              >
                View Details
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
