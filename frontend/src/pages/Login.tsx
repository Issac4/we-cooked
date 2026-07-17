import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CookingPot, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import CONFIG from '@/config'
import { formatErrorDetail } from '@/lib/api'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const formData = new URLSearchParams()
      formData.append('username', email) // FastAPI OAuth2 uses 'username' field even for emails
      formData.append('password', password)

      const response = await fetch(`${CONFIG.API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(formatErrorDetail(data.detail) || 'Invalid credentials')
      }

      const data = await response.json()
      login(data.access_token)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials'
      toast.error(msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-2 mb-8">
        <CookingPot className="w-10 h-10 text-blue-600" />
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Recipe App</h1>
      </div>

      <Card className="w-full max-w-md shadow-xl border-slate-200 rounded-3xl overflow-hidden">
        <CardHeader className="space-y-1 pb-8">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to access your recipes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                  id="email" 
                  placeholder="name@example.com" 
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
              </div>
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
            <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-blue-600 text-white transition-all rounded-xl" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 bg-slate-50/50 pt-6">
          <div className="text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-semibold">
              Create an account
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default Login
