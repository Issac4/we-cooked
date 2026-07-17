import { Outlet, Link, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/context/AuthContext'
import { ShieldAlert } from 'lucide-react'

export function Layout() {
  const { user, isAuthenticated } = useAuth()
  const location = useLocation()
  
  const showAdminBanner = isAuthenticated && user?.is_admin && location.pathname !== '/admin';

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {showAdminBanner && (
          <div className="bg-amber-500 text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold tracking-wider uppercase animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Logged in as Administrator (Read-Only Mode)</span>
            </div>
            <Link 
              to="/admin" 
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-[10px] transition-all font-black"
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
