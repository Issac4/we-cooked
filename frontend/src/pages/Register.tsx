import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CookingPot, User, Mail, Lock, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { apiFetch, formatErrorDetail } from '@/lib/api'

function Register() {
  const { user } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(formatErrorDetail(data.detail) || 'Registration failed')
      }

      toast.success('User registered successfully!')
      setUsername('')
      setEmail('')
      setPassword('')
      navigate('/admin')
    } catch (err: any) {
      toast.error(err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // If the user is not logged in or is not an admin, deny access
  if (!user?.is_admin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="flex items-center gap-2 mb-8">
          <CookingPot className="w-10 h-10 text-blue-600" />
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Recipe App</h1>
        </div>

        <Card className="w-full max-w-md shadow-xl border-slate-200 rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="space-y-4 pb-8 flex flex-col items-center text-center p-8">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-slate-900">Registration Disabled</CardTitle>
              <CardDescription className="text-slate-500 font-bold mt-2">
                Public registration is closed. Only administrators can register new users in this environment.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0 flex flex-col gap-3">
            <Link to="/login" className="w-full">
              <Button className="w-full h-12 rounded-xl font-bold bg-slate-900 hover:bg-blue-600 text-white transition-all">
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2 mb-8">
        <CookingPot className="w-10 h-10 text-blue-600" />
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Recipe App</h1>
      </div>

      <Card className="w-full max-w-md shadow-xl border-slate-200 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="space-y-1 pb-8">
          <CardTitle className="text-2xl font-bold">Register New User</CardTitle>
          <CardDescription>Administrator Portal - Add a new team member</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="username" 
                  placeholder="johndoe" 
                  className="pl-10 h-11"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm font-medium text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white transition-all rounded-xl" disabled={loading}>
              {loading ? 'Registering...' : 'Register User'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 bg-slate-50/50 pt-6">
          <div className="text-center text-sm text-slate-500">
            <Link to="/" className="text-blue-600 hover:underline font-semibold">
              Back to Dashboard
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default Register
