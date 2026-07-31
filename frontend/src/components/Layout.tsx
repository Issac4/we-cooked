import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'
import { ShieldAlert, CookingPot, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Layout() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const showAdminBanner = isAuthenticated && user?.is_admin && location.pathname !== '/admin';

  // Automatically close mobile menu drawer on route or filter query navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname, location.search])

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50/50">
      {/* Desktop Fixed Sidebar (md: and up) */}
      <Sidebar className="hidden md:flex" />

      {/* Sticky Mobile Top Header (< md) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm">
            <CookingPot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-lg">RecipeApp</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="text-slate-600 hover:text-slate-900"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </header>

      {/* Slide-Over Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Content */}
          <div className="relative z-50 w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <Sidebar isMobile onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {showAdminBanner && (
          <div className="bg-amber-500 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-bold tracking-wider uppercase animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Logged in as Administrator (Read-Only Mode)</span>
            </div>
            <Link 
              to="/admin" 
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-[10px] transition-all font-black shrink-0"
            >
              Go to Admin Panel
            </Link>
          </div>
        )}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
