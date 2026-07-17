import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Timer, Users, CheckCircle, ChefHat, Utensils, Edit, Trash2, AlertTriangle, X as CloseIcon, Link as LinkIcon, ExternalLink, Calendar, Star, History as HistoryIcon, PlusCircle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { apiFetch, formatErrorDetail } from '@/lib/api'
import { RecipeImage } from '@/components/RecipeImage'
import { useAuth } from '@/context/AuthContext'
import ReactMarkdown from 'react-markdown'
import type { Recipe, MealLog } from '@/types/api'

function RecipeDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)
  const [showLogDeleteModal, setShowLogDeleteModal] = useState(false)
  const [logToDelete, setLogToDelete] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Meal Log State
  const [mealLogs, setMealLogs] = useState<MealLog[]>([])
  const [loggingMeal, setLoggingMeal] = useState(false)
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [newLog, setNewLog] = useState({
    cooked_date: new Date().toISOString().split('T')[0],
    rating: 5,
    notes: ''
  })

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiFetch(`/recipes/${id}/logs`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      const data = await res.json()
      setMealLogs(data)
    } catch (err) {
      console.error('Logs fetch error:', err)
    }
  }, [id])

  const fetchRecipe = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    apiFetch(`/recipes/${id}`, { signal })
      .then(res => {
        if (!res.ok) throw new Error('Recipe not found')
        return res.json()
      })
      .then(data => {
        setRecipe(data)
        setLoading(false)
        fetchLogs()
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        console.error('Fetch error:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [id, fetchLogs])

  const handleLogMeal = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoggingMeal(true)
    try {
      const endpoint = editingLogId 
        ? `/recipes/logs/${editingLogId}`
        : `/recipes/${id}/logs`
      
      const res = await apiFetch(endpoint, {
        method: editingLogId ? 'PUT' : 'POST',
        body: JSON.stringify(newLog)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(formatErrorDetail(errorData.detail) || `Failed to ${editingLogId ? 'update' : 'log'} meal`)
      }
      
      setShowLogModal(false)
      setEditingLogId(null)
      setNewLog({
        cooked_date: new Date().toISOString().split('T')[0],
        rating: 5,
        notes: ''
      })
      
      fetchLogs()
      fetchRecipe()
      toast.success(editingLogId ? 'Entry updated!' : 'Cooking session logged!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed'
      console.error('Log meal error:', err)
      toast.error(msg)
    } finally {
      setLoggingMeal(false)
    }
  }

  const openEditLog = (log: MealLog) => {
    setEditingLogId(log.id)
    setNewLog({
      cooked_date: log.cooked_date,
      rating: log.rating,
      notes: log.notes || ''
    })
    setShowLogModal(true)
  }

  const openDeleteLog = (logId: number) => {
    setLogToDelete(logId)
    setShowLogDeleteModal(true)
  }

  const handleDeleteLog = async () => {
    if (!logToDelete) return
    
    setDeleting(true)
    try {
      const res = await apiFetch(`/recipes/logs/${logToDelete}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete log entry')
      
      toast.success('Journal entry removed')
      setShowLogDeleteModal(false)
      setLogToDelete(null)
      fetchLogs()
      fetchRecipe()
    } catch (err) {
      console.error('Delete log error:', err)
      toast.error('Failed to delete entry')
    } finally {
      setDeleting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await apiFetch(`/recipes/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete recipe')
      toast.success('Recipe deleted successfully')
      setShowModal(false)
      navigate('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deletion failed'
      console.error('Delete error:', err)
      setError(msg)
      toast.error(msg)
      setDeleting(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchRecipe(controller.signal)
    return () => controller.abort()
  }, [id, fetchRecipe])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-200 rounded-full"></div>
          <p className="text-slate-500 font-medium">Fetching recipe details...</p>
        </div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="flex items-center justify-center p-8 py-20">
        <Card className="max-w-md w-full border-red-100 shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600">{error || 'The requested recipe could not be found.'}</p>
            <div className="flex gap-4">
              <Button 
                variant="default" 
                onClick={() => fetchRecipe()}
                className="flex-1"
              >
                Retry
              </Button>
              <Link 
                to="/" 
                className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              >
                Back to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* Deletion Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 p-0">
            <CardHeader className="bg-red-50 border-b border-red-100 flex flex-row items-center justify-between py-4 px-6">
              <CardTitle className="text-red-700 flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="w-5 h-5" />
                Confirm Deletion
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowModal(false)}
                className="text-red-300 hover:text-red-600 hover:bg-red-100 rounded-full w-8 h-8"
              >
                <CloseIcon className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-slate-900 font-bold text-xl">Are you absolutely sure?</p>
                <p className="text-slate-500 leading-relaxed">
                  This will permanently delete <span className="font-bold text-slate-900">"{recipe.title}"</span> and its cover image. This action cannot be undone.
                </p>
              </div>
              
              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full h-12 rounded-2xl font-bold text-lg shadow-lg shadow-red-100 gap-2"
                >
                  {deleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Permanently Delete
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => !deleting && setShowModal(false)}
                  disabled={deleting}
                  className="w-full h-12 rounded-2xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  Cancel, keep recipe
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Log Meal Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 p-0">
            <CardHeader className="bg-blue-600 text-white flex flex-row items-center justify-between py-4 px-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <HistoryIcon className="w-5 h-5" />
                {editingLogId ? 'Edit Journal Entry' : 'Log a Cooking Session'}
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setShowLogModal(false)
                  setEditingLogId(null)
                  setNewLog({
                    cooked_date: new Date().toISOString().split('T')[0],
                    rating: 5,
                    notes: ''
                  })
                }}
                className="text-blue-100 hover:text-white hover:bg-blue-500 rounded-full w-8 h-8"
              >
                <CloseIcon className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleLogMeal} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cooked_date" className="text-xs font-black uppercase tracking-widest text-slate-400">Date Cooked</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      id="cooked_date"
                      type="date" 
                      required
                      value={newLog.cooked_date}
                      onChange={(e) => setNewLog({...newLog, cooked_date: e.target.value})}
                      className="pl-10 h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Rating (1-5)</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewLog({...newLog, rating: star})}
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                          newLog.rating >= star 
                            ? "bg-yellow-100 text-yellow-600 scale-105 shadow-sm" 
                            : "bg-slate-50 text-slate-300 hover:bg-slate-100"
                        )}
                      >
                        <Star className={cn("w-6 h-6", newLog.rating >= star && "fill-current")} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-black uppercase tracking-widest text-slate-400">Notes (Optional)</Label>
                  <Textarea 
                    id="notes"
                    placeholder="How did it turn out? Any adjustments made?"
                    value={newLog.notes}
                    onChange={(e) => setNewLog({...newLog, notes: e.target.value})}
                    className="min-h-[100px] rounded-xl"
                  />
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit"
                    disabled={loggingMeal}
                    className="w-full h-12 rounded-2xl font-bold text-lg shadow-lg shadow-blue-100 gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    {loggingMeal ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        {editingLogId ? 'Update Entry' : 'Save Entry'}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Log Entry Deletion Confirmation Modal */}
      {showLogDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md shadow-2xl border-slate-200 rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 p-0">
            <CardHeader className="bg-red-50 border-b border-red-100 flex flex-row items-center justify-between py-4 px-6">
              <CardTitle className="text-red-700 flex items-center gap-2 text-lg font-bold">
                <AlertTriangle className="w-5 h-5" />
                Remove Journal Entry
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowLogDeleteModal(false)}
                className="text-red-300 hover:text-red-600 hover:bg-red-100 rounded-full w-8 h-8"
              >
                <CloseIcon className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-slate-900 font-bold text-xl">Remove this session?</p>
                <p className="text-slate-500 leading-relaxed">
                  This will permanently remove this cooking record from your journal. Your "Times Cooked" stat will be updated.
                </p>
              </div>
              
              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteLog}
                  disabled={deleting}
                  className="w-full h-12 rounded-2xl font-bold text-lg shadow-lg shadow-red-100 gap-2"
                >
                  {deleting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Delete Entry
                    </>
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowLogDeleteModal(false)}
                  className="w-full h-12 rounded-2xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Hero Section / Header */}
      <div className="bg-white border-b border-slate-200 mb-8 pt-8 pb-12 shadow-sm">
        <div className="px-8">
          <div className="flex justify-between items-center mb-6">
            <Link 
              to="/" 
              className={cn(buttonVariants({ variant: "ghost" }), "-ml-4 text-slate-500 hover:text-blue-600 gap-2")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>

            {isAuthenticated && !user?.is_admin && (
              <div className="flex gap-3">
                <Link 
                  to={`/recipe/edit/${id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "rounded-full gap-2 text-slate-600 hover:text-blue-600 border-slate-200 shadow-sm")}
                >
                  <Edit className="w-4 h-4" />
                  Edit Recipe
                </Link>
                
                <Button 
                  variant="outline"
                  onClick={() => setShowModal(true)}
                  className="rounded-full gap-2 text-slate-400 hover:text-red-600 border-slate-200 shadow-sm transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {recipe.cover_image_url && (
            <RecipeImage 
              src={recipe.cover_image_url} 
              alt={recipe.title}
              containerClassName="mb-8 w-full h-96 rounded-[2.5rem] shadow-2xl shadow-blue-100 border-8 border-white"
            />
          )}
          
          <div className="space-y-6 w-full max-w-full">
            <div className="w-full max-w-full min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <ChefHat className="w-6 h-6 text-blue-600" />
                <div className="flex gap-2">
                  {recipe.proteins?.map(protein => (
                    <Badge key={protein} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                      {protein}
                    </Badge>
                  ))}
                  {recipe.meal_types?.map(type => (
                    <Badge key={type} variant="outline" className="text-slate-500">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 break-all leading-tight">
                {recipe.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-6">
              <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 shadow-sm text-center min-w-[120px]">
                <Users className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Servings</p>
                <p className="text-xl font-black text-slate-900">{recipe.servings ?? 'N/A'}</p>
              </div>
              {(recipe.prep_time_mins !== undefined || recipe.cook_time_mins !== undefined) && (
                <div className="bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 shadow-sm text-center min-w-[120px]">
                  <Timer className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Time</p>
                  <p className="text-xl font-black text-blue-700">
                    {(recipe.prep_time_mins || 0) + (recipe.cook_time_mins || 0)}m
                  </p>
                </div>
              )}
              <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 shadow-sm text-center min-w-[120px]">
                <HistoryIcon className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cooks</p>
                <p className="text-xl font-black text-slate-900">{recipe.cook_count || 0}</p>
              </div>
              {recipe.last_cooked && (
                <div className="bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 shadow-sm text-center min-w-[120px]">
                  <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Last Made</p>
                  <p className="text-xl font-black text-blue-700">
                    {new Date(recipe.last_cooked).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Sidebar: Ingredients & Resources */}
          <aside className="lg:col-span-4 sticky top-8 self-start h-fit">
            <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
              <CardHeader className="bg-slate-900 text-white pb-6 pt-8">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <Utensils className="w-6 h-6 text-blue-400" />
                  Ingredients
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8 pb-8">
                <ul className="space-y-4">
                  {recipe.ingredients?.map((ing, idx) => (
                    <li key={idx} className="flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-150 transition-transform"></div>
                        <span className="font-medium text-slate-700">{ing.item}</span>
                      </div>
                      <Badge variant="outline" className="bg-slate-50 font-bold text-slate-900 border-slate-200">
                        {ing.amount}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {recipe.reference_links?.length > 0 && (
              <Card className="mt-8 border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
                <CardHeader className="bg-slate-50 border-b border-slate-100 py-6">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <LinkIcon className="w-5 h-5 text-blue-600" />
                    Resources
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {recipe.reference_links.map((link, idx) => (
                    <a 
                      key={idx} 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all group gap-4"
                    >
                      <div className="flex flex-col flex-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{link.type}</span>
                        <span className="font-bold text-slate-700 group-hover:text-blue-700 leading-tight">{link.title}</span>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0" />
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}
          </aside>

          {/* Main Content: Instructions */}
          <main className="lg:col-span-8 space-y-12">
            {recipe.instructions?.prep?.length > 0 && (
              <section>
                <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3 italic">
                  <span className="text-blue-600 not-italic">01.</span> Preparation
                </h2>
                <div className="grid gap-6">
                  {recipe.instructions.prep.map((step) => (
                    <Card key={step.step} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-2xl">
                      <CardContent className="p-6 flex gap-6">
                        <div className="flex-shrink-0 w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl font-black">
                          {step.step}
                        </div>
                        <div className="pt-1">
                          <h3 className="text-xl font-bold text-slate-800 mb-2">{step.action}</h3>
                          {step.description && (
                            <div className="text-slate-600 leading-relaxed text-lg">
                              <ReactMarkdown 
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  strong: ({ children }) => <strong className="font-black text-slate-900">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-slate-500">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="pl-1">{children}</li>,
                                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">{children}</a>
                                }}
                              >
                                {step.description}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {recipe.instructions?.cook?.length > 0 && (
              <section>
                <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3 italic">
                  <span className="text-green-600 not-italic">02.</span> Cooking
                </h2>
                <div className="grid gap-6">
                  {recipe.instructions.cook.map((step) => (
                    <Card key={step.step} className="border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-2xl">
                      <CardContent className="p-6 flex gap-6">
                        <div className="flex-shrink-0 w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center text-xl font-black">
                          {step.step}
                        </div>
                        <div className="pt-1 flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold text-slate-800">{step.action}</h3>
                            {step.timer_mins && (
                              <Badge className="bg-slate-100 text-slate-600 border-none px-3 py-1 gap-1">
                                <Timer className="w-3.5 h-3.5" />
                                {step.timer_mins}m
                              </Badge>
                            )}
                          </div>
                          {step.description && (
                            <div className="text-slate-600 leading-relaxed text-lg">
                              <ReactMarkdown 
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  strong: ({ children }) => <strong className="font-black text-slate-900">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-slate-500">{children}</em>,
                                  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="pl-1">{children}</li>,
                                  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">{children}</a>
                                }}
                              >
                                {step.description}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
            
            <div className="pt-12 flex flex-col items-center gap-6">
              <div className="flex items-center gap-3 text-slate-400 font-bold uppercase tracking-widest text-sm">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Enjoy your meal
              </div>
              <div className="w-24 h-1 bg-slate-100 rounded-full"></div>
            </div>

            {/* Cooking Journal Section (Bottom) */}
            {isAuthenticated && !user?.is_admin && (
              <section className="pt-12 space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-100">
                      <HistoryIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900">Cooking Journal</h2>
                      <p className="text-slate-500 font-medium">Your personal history with this recipe</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Cooks</p>
                      <p className="text-xl font-black text-blue-600">{recipe.cook_count || 0}</p>
                    </div>
                    <Button 
                      variant="default" 
                      onClick={() => setShowLogModal(true)}
                      className="h-12 rounded-2xl font-bold px-6 gap-2 bg-slate-900 hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Log a New Session
                    </Button>
                  </div>
                </div>

                <div className="space-y-8">
                  {mealLogs.length > 0 ? (
                    <div className="relative pl-8 space-y-12 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      {mealLogs.map((log) => (
                        <div key={log.id} className="relative group">
                          {/* Timeline Dot */}
                          <div className="absolute -left-[35px] top-1.5 w-6 h-6 rounded-full border-4 border-white bg-blue-600 shadow-sm z-10 group-hover:scale-125 transition-transform"></div>
                          
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                                  {user?.username?.substring(0, 2).toUpperCase() || 'U'}
                                </div>
                                <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                                  {new Date(log.cooked_date).toLocaleDateString(undefined, { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                <div className="flex text-yellow-500 gap-0.5">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={cn("w-4 h-4", i < log.rating ? "fill-current" : "text-slate-200")} />
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openEditLog(log)}
                                  className="w-8 h-8 rounded-full text-slate-300 hover:text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => openDeleteLog(log.id)}
                                  className="w-8 h-8 rounded-full text-slate-300 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {log.notes && (
                              <Card className="border-slate-100 shadow-sm rounded-2xl bg-white/50 group-hover:border-blue-100 group-hover:bg-blue-50/10 transition-all">
                                <CardContent className="p-6">
                                  <div className="flex gap-4">
                                    <MessageSquare className="w-5 h-5 text-slate-300 shrink-0 mt-1" />
                                    <p className="text-slate-600 leading-relaxed text-lg italic font-medium">
                                      {log.notes}
                                    </p>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <HistoryIcon className="w-12 h-12 text-slate-300 mx-auto mb-4 opacity-50" />
                      <p className="text-slate-500 font-bold">No cooking sessions logged yet.</p>
                      <p className="text-slate-400 text-sm">Start your journal by logging your first meal!</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

export default RecipeDetails
