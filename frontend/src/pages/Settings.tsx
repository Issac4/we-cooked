import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { apiFetch, updateProtein, createProtein, deleteProtein, updateMealType, createMealType, deleteMealType, updateProfile, formatErrorDetail } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Edit2, Trash2, Check, X, User, Tag, Lock, Plus, AlertTriangle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Category {
  id: number
  name: string
  recipe_count: number
}

interface DeleteConfig {
  type: 'protein' | 'mealType'
  id: number
  name: string
}

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'account' | 'categories'>('account')
  const [proteins, setProteins] = useState<Category[]>([])
  const [mealTypes, setMealTypes] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editingItem, setEditingItem] = useState<{ type: 'protein' | 'mealType', id: number, name: string } | null>(null)
  const [addingType, setAddingType] = useState<'protein' | 'mealType' | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Profile update form state
  const [usernameInput, setUsernameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setUsernameInput(user.username)
      setEmailInput(user.email)
    }
  }, [user])


  const handleBackgroundClick = () => {
    setActiveActionId(null);
    setEditingItem(null);
    setAddingType(null);
    setNewItemName('');
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProfileSuccess(null);

    if (!currentPassword) {
      setError('Current password is required to verify changes');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    setProfileLoading(true);
    try {
      const payload: any = {
        current_password: currentPassword,
      };

      if (usernameInput !== user?.username) {
        payload.username = usernameInput;
      }
      if (emailInput !== user?.email) {
        payload.email = emailInput;
      }
      if (newPassword) {
        payload.new_password = newPassword;
      }

      if (Object.keys(payload).length === 1) {
        setError('No changes to update');
        setProfileLoading(false);
        return;
      }

      const res = await updateProfile(payload);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(formatErrorDetail(data.detail) || 'Failed to update profile');
      }

      setProfileSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      await refreshUser();
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating profile');
    } finally {
      setProfileLoading(false);
    }
  };


  const fetchData = async () => {
    setLoading(true)
    try {
      const [pRes, mtRes] = await Promise.all([
        apiFetch('/proteins/'),
        apiFetch('/meal-types/')
      ])
      if (!pRes.ok || !mtRes.ok) throw new Error('Failed to fetch categories')
      setProteins(await pRes.json())
      setMealTypes(await mtRes.json())
    } catch (err) {
      setError('Failed to load settings data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleTabChange = (tab: 'account' | 'categories') => {
    setActiveTab(tab);
    setError(null);
    setEditingItem(null);
    setActiveActionId(null);
    setAddingType(null);
    setNewItemName('');
  };

  const handleCreate = async () => {
    if (!addingType || !newItemName.trim()) {
        setAddingType(null);
        setNewItemName('');
        return;
    }
    setError(null);
    try {
      const res = addingType === 'protein'
        ? await createProtein(newItemName)
        : await createMealType(newItemName)
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(formatErrorDetail(data.detail) || 'Failed to create')
      }
      
      setAddingType(null);
      setNewItemName('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!editingItem) return
    if (!editingItem.name.trim()) {
        setError('Name cannot be empty');
        return;
    }
    setError(null)
    try {
      const res = editingItem.type === 'protein' 
        ? await updateProtein(editingItem.id, editingItem.name)
        : await updateMealType(editingItem.id, editingItem.name)
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(formatErrorDetail(data.detail) || 'Failed to update')
      }
      
      setEditingItem(null)
      setActiveActionId(null)
      fetchData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setError(null)
    try {
      const res = deleteConfirm.type === 'protein' 
        ? await deleteProtein(deleteConfirm.id) 
        : await deleteMealType(deleteConfirm.id)
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(formatErrorDetail(data.detail) || 'Failed to delete')
      }
      setDeleteConfirm(null)
      setActiveActionId(null)
      fetchData()
    } catch (err: any) {
      setError(err.message)
      setDeleteConfirm(null)
    }
  }

  if (loading && proteins.length === 0) {
      return (
          <div className="flex items-center justify-center h-[50vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
      )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen" onClick={handleBackgroundClick}>
      {/* Custom Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="p-8 pb-4 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <CardTitle className="text-2xl font-black text-slate-900">Confirm Deletion</CardTitle>
              <CardDescription className="text-slate-500 font-bold mt-2">
                Are you sure you want to delete <span className="text-slate-900">"{deleteConfirm.name}"</span>? 
                This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-6 flex flex-col gap-3">
              <Button 
                variant="destructive" 
                className="w-full h-12 rounded-xl font-black uppercase tracking-wider shadow-lg shadow-red-100"
                onClick={handleDelete}
              >
                Delete Category
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-500 font-medium">Manage your personal profile and global recipe categories.</p>
      </header>

      <div className="flex gap-4 mb-10 p-1.5 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => handleTabChange('account')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'account' 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Account & Profile
        </button>
        <button 
          onClick={() => handleTabChange('categories')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'categories' 
              ? "bg-white text-blue-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          Category Management
        </button>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm font-bold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
          <button 
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 opacity-50 hover:opacity-100" />
          </button>
        </div>
      )}

      <div className="animate-in fade-in duration-500">
        {activeTab === 'account' && (
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <Card className="rounded-[2.5rem] border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
              <CardHeader className="p-10 pb-6 border-b border-slate-50">
                <div className="flex items-center gap-4 mb-2">
                  <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl font-black text-slate-900">Profile</CardTitle>
                    <CardDescription className="text-slate-500 font-bold text-base">Private account credentials</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                {profileSuccess && (
                  <div className="p-4 bg-green-50 border border-green-100 text-green-700 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <Check className="w-5 h-5 text-green-500" />
                    {profileSuccess}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="username" className="text-slate-500 font-black uppercase text-[11px] tracking-[0.25em] px-1">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="h-14 px-6 rounded-2xl border border-slate-200 font-bold text-slate-800"
                      placeholder="Enter username"
                      required
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-slate-500 font-black uppercase text-[11px] tracking-[0.25em] px-1">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="h-14 px-6 rounded-2xl border border-slate-200 font-bold text-slate-800"
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-8 space-y-6">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-slate-400" />
                    Change Password (Optional)
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <Label htmlFor="new-password" className="text-slate-500 font-black uppercase text-[11px] tracking-[0.25em] px-1">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-14 px-6 rounded-2xl border border-slate-200 font-medium text-slate-800"
                        placeholder="Leave blank to keep current"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="confirm-new-password" className="text-slate-500 font-black uppercase text-[11px] tracking-[0.25em] px-1">Confirm New Password</Label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="h-14 px-6 rounded-2xl border border-slate-200 font-medium text-slate-800"
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-8 space-y-4">
                  <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100/30 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password" className="text-blue-700 font-black uppercase text-[11px] tracking-[0.25em] px-1">
                        Current Password (Required to Save Changes)
                      </Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-14 px-6 rounded-2xl border border-blue-200 bg-white focus-visible:ring-blue-500 font-medium text-slate-800"
                        placeholder="Enter current password to verify identity"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={profileLoading}
                    className="h-14 px-8 rounded-2xl font-black uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 disabled:opacity-50 min-w-[160px]"
                  >
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-16">
            <CloudSection 
              title="Proteins" 
              items={proteins} 
              type="protein"
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              addingType={addingType}
              setAddingType={setAddingType}
              newItemName={newItemName}
              setNewItemName={setNewItemName}
              onCreate={handleCreate}
              activeActionId={activeActionId}
              setActiveActionId={setActiveActionId}
              onUpdate={handleUpdate}
              onDelete={(id: number, name: string) => setDeleteConfirm({ type: 'protein', id, name })}
            />
            
            <CloudSection 
              title="Meal Types" 
              items={mealTypes} 
              type="mealType"
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              addingType={addingType}
              setAddingType={setAddingType}
              newItemName={newItemName}
              setNewItemName={setNewItemName}
              onCreate={handleCreate}
              activeActionId={activeActionId}
              setActiveActionId={setActiveActionId}
              onUpdate={handleUpdate}
              onDelete={(id: number, name: string) => setDeleteConfirm({ type: 'mealType', id, name })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function CloudSection({ 
  title, items, type, editingItem, setEditingItem, 
  addingType, setAddingType, newItemName, setNewItemName, onCreate,
  activeActionId, setActiveActionId, onUpdate, onDelete 
}: any) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-2xl">
              <Tag className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
        </div>
        <Badge variant="outline" className="text-slate-400 border-slate-200 font-black px-4 h-8 rounded-xl uppercase text-[10px] tracking-wider">
          {items.length} Options
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3 items-center min-h-[60px]">
        {items.map((item: any) => {
          const actionId = `${type}-${item.id}`;
          const isEditing = editingItem?.id === item.id && editingItem?.type === type;
          const isActing = activeActionId === actionId && !isEditing;

          return (
            <div key={item.id} className="relative" onClick={(e) => e.stopPropagation()}>
              {isEditing ? (
                <div className="flex items-center gap-2 bg-white border-2 border-blue-500 rounded-2xl p-1 pr-2 shadow-lg shadow-blue-100 animate-in zoom-in-95 duration-200">
                  <Input 
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="h-9 w-40 border-none bg-transparent font-bold focus:ring-0 px-3"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && onUpdate()}
                  />
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700 rounded-xl" onClick={onUpdate}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-slate-100 rounded-xl" onClick={() => setEditingItem(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : isActing ? (
                <div className="flex items-center gap-1 bg-slate-900 rounded-2xl p-1 px-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                  <span className="text-white font-bold text-sm px-2 border-r border-white/10 mr-1">{item.name}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                    onClick={() => setEditingItem({ type, id: item.id, name: item.name })}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    disabled={item.recipe_count > 0}
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all",
                      item.recipe_count > 0 
                        ? "text-white/20" 
                        : "text-white/70 hover:text-red-400 hover:bg-red-400/10"
                    )}
                    onClick={() => onDelete(item.id, item.name)}
                  >
                    {item.recipe_count > 0 ? <Lock className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-white/40 hover:text-white rounded-lg"
                    onClick={() => setActiveActionId(null)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveActionId(actionId)}
                  className="group flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 transition-all duration-300 active:scale-95"
                >
                  <span className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">{item.name}</span>
                </button>
              )}
            </div>
          )
        })}
        
        {addingType === type ? (
          <div className="flex items-center gap-2 bg-white border-2 border-blue-500 rounded-2xl p-1 pr-2 shadow-lg shadow-blue-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <Input 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={`Add ${title.slice(0, -1)}...`}
              className="h-9 w-40 border-none bg-transparent font-bold focus:ring-0 px-3"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            />
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-lg" onClick={onCreate}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-slate-50 rounded-lg" onClick={() => setAddingType(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setAddingType(type);
              setNewItemName('');
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all group"
          >
              <Plus className="w-4 h-4" />
              <span className="font-bold text-sm uppercase tracking-wider">New</span>
          </button>
        )}
      </div>
    </div>
  )
}
