import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiFetch, formatErrorDetail } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, UserPlus, KeyRound, Search, Power } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface User {
  id: number
  username: string
  email: string
  is_active: boolean;
  is_admin: boolean;
  created_at: string
}

export default function AdminDashboard() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Registration Form State
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [showRegModal, setShowRegModal] = useState(false)

  // Password Reset State
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/auth/users')
      if (!res.ok) throw new Error('Failed to fetch user directory')
      const data = await res.json()
      setUsers(data)
    } catch (err: any) {
      toast.error(err.message || 'Error loading users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot deactivate your own administrator account.')
      return
    }

    try {
      const nextStatus = !user.is_active
      const res = await apiFetch(`/auth/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextStatus })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(formatErrorDetail(errData.detail) || 'Failed to update user status')
      }

      toast.success(`User "${user.username}" has been ${nextStatus ? 'activated' : 'deactivated'}.`)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)

    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(formatErrorDetail(errData.detail) || 'Registration failed')
      }

      toast.success(`User "${regUsername}" registered successfully.`)
      setRegUsername('')
      setRegEmail('')
      setRegPassword('')
      setShowRegModal(false)
      fetchUsers()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRegLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resettingUser) return
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.')
      return
    }

    setResetLoading(true)
    try {
      const res = await apiFetch(`/auth/users/${resettingUser.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ new_password: newPassword })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(formatErrorDetail(errData.detail) || 'Password reset failed')
      }

      toast.success(`Password for "${resettingUser.username}" reset successfully.`)
      setNewPassword('')
      setResettingUser(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setResetLoading(false)
    }
  }

  // Filter users based on search query
  const filteredUsers = users.filter(
    u =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-2xl font-black text-slate-900">Register New User</CardTitle>
              <CardDescription className="text-slate-500 font-medium mt-1">Add a new standard member to the app.</CardDescription>
            </CardHeader>
            <form onSubmit={handleRegisterUser}>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Username</Label>
                  <Input
                    id="reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="johndoe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email Address</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Temporary Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="p-8 pt-0 flex justify-end gap-3">
                <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setShowRegModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={regLoading} className="rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-white px-6">
                  {regLoading ? 'Registering...' : 'Register User'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Password Reset Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <KeyRound className="w-6 h-6 text-blue-500" />
                Reset Password
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium mt-1">
                Set a new password for <span className="text-slate-800 font-bold">"{resettingUser.username}"</span>.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleResetPassword}>
              <CardContent className="p-8 pt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-new-password">New Password</Label>
                  <Input
                    id="reset-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                </div>
              </CardContent>
              <CardFooter className="p-8 pt-0 flex justify-end gap-3">
                <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => setResettingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetLoading} className="rounded-xl font-black bg-blue-600 hover:bg-blue-700 text-white px-6">
                  {resetLoading ? 'Resetting...' : 'Change Password'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Header section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2 flex items-center gap-3">
            <Users className="w-10 h-10 text-blue-600" />
            System Administration
          </h1>
          <p className="text-slate-500 font-medium">Manage user accounts, authentication statuses, and security resets.</p>
        </div>
        <Button 
          onClick={() => setShowRegModal(true)}
          className="h-12 rounded-2xl font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 gap-2 px-6"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </header>

      {/* User Directory Card */}
      <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 pb-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-black text-slate-900">User Directory</CardTitle>
            <CardDescription className="text-slate-500 font-semibold mt-1">Total registered: {users.length}</CardDescription>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or email..."
              className="pl-11 pr-4 h-11 bg-white border-slate-200 rounded-xl font-medium focus-visible:ring-blue-500 shadow-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">
                  <th className="py-4 px-8">User Info</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Joined Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-8 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                      No registered users found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-5 px-8">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-inner",
                              u.is_admin 
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-50 text-blue-600"
                            )}>
                              {u.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-slate-900 font-black text-base truncate">{u.username}</span>
                              <span className="text-slate-500 text-xs truncate">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          {u.is_admin ? (
                            <Badge className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-50 font-black uppercase text-[9px] tracking-wider rounded-lg px-2.5 py-0.5">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-black uppercase text-[9px] tracking-wider rounded-lg px-2.5 py-0.5">
                              User
                            </Badge>
                          )}
                        </td>
                        <td className="py-5 px-6 text-slate-500 text-sm">
                          {new Date(u.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="py-5 px-6">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={isSelf}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95",
                              isSelf 
                                ? "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed"
                                : u.is_active 
                                  ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100/50" 
                                  : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100/50"
                            )}
                          >
                            <Power className="w-3.5 h-3.5 shrink-0" />
                            {u.is_active ? 'Active' : 'Suspended'}
                          </button>
                        </td>
                        <td className="py-5 px-8 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              title="Reset Password"
                              onClick={() => setResettingUser(u)}
                              className="h-9 w-9 rounded-xl p-0 text-slate-400 hover:text-blue-600 hover:border-blue-200"
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
