import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import Dashboard from './pages/Dashboard'
import RecipeDetails from './pages/RecipeDetails'
import AddRecipe from './pages/AddRecipe'
import EditRecipe from './pages/EditRecipe'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'

const ProtectedRoute = () => {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" />
  if (user?.is_admin) return <Navigate to="/admin" />
  return <Outlet />
}

const AdminRoute = () => {
  const { isAuthenticated, user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  return isAuthenticated && user?.is_admin ? <Outlet /> : <Navigate to="/login" />
}

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/recipe/:id" element={<RecipeDetails />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/add-recipe" element={<AddRecipe />} />
          <Route path="/recipe/edit/:id" element={<EditRecipe />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
      </Route>


      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors duration={1000} />
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App
