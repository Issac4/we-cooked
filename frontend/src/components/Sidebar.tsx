import { useEffect, useState, useMemo } from 'react'
import { NavLink, useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { CookingPot, LayoutDashboard, PlusCircle, LogOut, Settings, FilterX, LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'

interface FilterItem {
  id: number
  name: string
}

export function Sidebar() {
  const { logout, user, isAuthenticated } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
  const [proteins, setProteins] = useState<FilterItem[]>([])
  const [mealTypes, setMealTypes] = useState<FilterItem[]>([])
  const [loading, setLoading] = useState(true)

  // Parse active filters from URL
  const activeProteins = searchParams.get('proteins')?.split(',').filter(Boolean).map(Number) || []
  const activeMealTypes = searchParams.get('meal_types')?.split(',').filter(Boolean).map(Number) || []

  useEffect(() => {
    Promise.all([
      apiFetch('/proteins/').then(res => res.json()),
      apiFetch('/meal-types/').then(res => res.json())
    ]).then(([proteinData, mealTypeData]) => {
      setProteins(proteinData)
      setMealTypes(mealTypeData)
      setLoading(false)
    }).catch(err => {
      console.error('Failed to fetch filter options:', err)
      setLoading(false)
    })
  }, [])

  const toggleFilter = (type: 'proteins' | 'meal_types', id: number) => {
    const current = type === 'proteins' ? activeProteins : activeMealTypes
    const next = current.includes(id) 
      ? current.filter(i => i !== id)
      : [...current, id]
    
    const newParams = new URLSearchParams(searchParams)
    if (next.length > 0) {
      newParams.set(type, next.join(','))
    } else {
      newParams.delete(type)
    }

    // If not on dashboard, go there with new filters
    if (location.pathname !== '/') {
      navigate(`/?${newParams.toString()}`)
    } else {
      setSearchParams(newParams)
    }
  }

  const clearFilters = () => {
    const newParams = new URLSearchParams(searchParams)
    newParams.delete('proteins')
    newParams.delete('meal_types')
    if (location.pathname !== '/') {
      navigate(`/?${newParams.toString()}`)
    } else {
      setSearchParams(newParams)
    }
  }

  const navItems = useMemo(() => {
    if (isAuthenticated && user?.is_admin) {
      return [
        { icon: LayoutDashboard, label: 'Admin Panel', to: '/admin' },
        { icon: Settings, label: 'Recipe Dashboard', to: '/' },
      ]
    }
    const items = [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    ]
    if (isAuthenticated) {
      items.push(
        { icon: PlusCircle, label: 'Add Recipe', to: '/add-recipe' },
        { icon: Settings, label: 'Settings', to: '/settings' }
      )
    }
    return items
  }, [isAuthenticated, user, activeProteins.join(','), activeMealTypes.join(',')])

  const FilterSection = ({ title, items, activeItems, type }: { 
    title: string, 
    items: FilterItem[], 
    activeItems: number[],
    type: 'proteins' | 'meal_types'
  }) => (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map(item => {
          const isActive = activeItems.includes(item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggleFilter(type, item.id)}
              title={item.name}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 truncate max-w-[140px]",
                isActive 
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-transparent border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
              )}
            >
              {item.name}
            </button>
          )
        })}
      </div>
    </div>
  )

  const hasActiveFilters = activeProteins.length > 0 || activeMealTypes.length > 0

  return (
    <div className="w-64 border-r bg-slate-50/50 flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <CookingPot className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">RecipeApp</span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                    : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Separator className="mx-6 w-auto" />

      {/* Scrollable Filters Section */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-bold text-slate-900">Filters</span>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="h-7 px-2 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
            >
              <FilterX className="w-3 h-3" />
              Clear All
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-4 px-1">
            <div className="h-4 w-20 bg-slate-200 animate-pulse rounded" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-7 w-16 bg-slate-200 animate-pulse rounded-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <FilterSection 
              title="Proteins" 
              items={proteins} 
              activeItems={activeProteins} 
              type="proteins" 
            />
            <FilterSection 
              title="Meal Types" 
              items={mealTypes} 
              activeItems={activeMealTypes} 
              type="meal_types" 
            />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t bg-slate-50/50 space-y-4">
        {isAuthenticated ? (
          <>
            <div className="flex items-center gap-3 px-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                {user?.username?.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-slate-900 truncate">{user?.username}</span>
                <span className="text-xs text-slate-500 truncate">{user?.email}</span>
              </div>
            </div>

            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-slate-600 hover:text-red-600 hover:bg-red-50 px-3"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </>
        ) : (
          <Link 
            to="/login"
            className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start gap-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3")}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        )}
      </div>
    </div>
  )
}
