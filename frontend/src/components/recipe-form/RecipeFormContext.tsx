import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { DropResult } from '@hello-pangea/dnd'
import { apiFetch } from '@/lib/api'
import type { RecipeCreate, Ingredient, InstructionStep, Protein, MealType, ReferenceLink } from '@/types/api'
import CONFIG from '@/config'

interface RecipeFormContextType {
  formData: RecipeCreate;
  imageFile: File | null;
  imagePreview: string | null;
  error: string | null;
  loading: boolean;
  proteins: Protein[];
  mealTypes: MealType[];
  showAddProtein: boolean;
  newProteinName: string;
  showAddMealType: boolean;
  newMealTypeName: string;
  previews: Record<string, boolean>;
  showMarkdownHelp: boolean;
  proteinExists: boolean;
  mealTypeExists: boolean;
  apiUrl: string;
  hasDraft: boolean;

  // Handlers
  setFormData: React.Dispatch<React.SetStateAction<RecipeCreate>>;
  setError: (error: string | null) => void;
  setImageFile: (file: File | null) => void;
  setImagePreview: (preview: string | null) => void;
  setShowAddProtein: (show: boolean) => void;
  setNewProteinName: (name: string) => void;
  setShowAddMealType: (show: boolean) => void;
  setNewMealTypeName: (name: string) => void;
  setShowMarkdownHelp: (show: boolean) => void;

  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  toggleProtein: (id: number) => void;
  toggleMealType: (id: number) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeImage: () => void;
  handleAddIngredient: () => void;
  handleUpdateIngredient: (index: number, field: keyof Ingredient, value: string) => void;
  handleRemoveIngredient: (index: number) => void;
  handleAddStep: (type: 'prep' | 'cook') => void;
  handleUpdateStep: (type: 'prep' | 'cook', index: number, field: keyof InstructionStep, value: string | number) => void;
  handleRemoveStep: (type: 'prep' | 'cook', index: number) => void;
  handleDragEnd: (result: DropResult) => void;
  handleAddReferenceLink: () => void;
  handleUpdateReferenceLink: (index: number, field: keyof ReferenceLink, value: string) => void;
  handleRemoveReferenceLink: (index: number) => void;
  handleUrlBlur: (index: number, url: string) => Promise<void>;
  handleAddProtein: (name: string) => Promise<void>;
  handleAddMealType: (name: string) => Promise<void>;
  togglePreview: (id: string) => void;
  saveDraft: () => void;
  restoreDraft: () => void;
  clearDraft: () => void;
}

const RecipeFormContext = createContext<RecipeFormContextType | undefined>(undefined)

export const useRecipeForm = () => {
  const context = useContext(RecipeFormContext)
  if (!context) {
    throw new Error('useRecipeForm must be used within a RecipeFormProvider')
  }
  return context
}

interface RecipeFormProviderProps {
  children: React.ReactNode;
  initialData?: Partial<RecipeCreate>;
  loading: boolean;
}

export const RecipeFormProvider: React.FC<RecipeFormProviderProps> = ({ children, initialData, loading }) => {
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.cover_image_url || null)
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false)
  const [previews, setPreviews] = useState<Record<string, boolean>>({})

  // Options from API
  const [proteins, setProteins] = useState<Protein[]>([])
  const [mealTypes, setMealTypes] = useState<MealType[]>([])

  // New Category State
  const [showAddProtein, setShowAddProtein] = useState(false)
  const [newProteinName, setNewProteinName] = useState('')
  const [showAddMealType, setShowAddMealType] = useState(false)
  const [newMealTypeName, setNewMealTypeName] = useState('')
  const [hasDraft, setHasDraft] = useState(false)
  const apiUrl = CONFIG.API_URL

  // Form State
  const [formData, setFormData] = useState<RecipeCreate>({
    title: initialData?.title || '',
    protein_ids: initialData?.protein_ids || [],
    meal_type_ids: initialData?.meal_type_ids || [],
    servings: initialData?.servings || 2,
    prep_time_mins: initialData?.prep_time_mins || 0,
    cook_time_mins: initialData?.cook_time_mins || 0,
    ingredients: initialData?.ingredients || [{ item: '', amount: '' }],
    instructions: initialData?.instructions || {
      prep: [{ step: 1, action: '', description: '' }],
      cook: [{ step: 1, action: '', description: '', timer_mins: 0 }]
    },
    reference_links: initialData?.reference_links || [],
    attributes: initialData?.attributes || {},
    cover_image_url: initialData?.cover_image_url || undefined
  })

  // Validation State for Duplicates
  const proteinExists = useMemo(() => {
    return proteins.some(p => p.name.toLowerCase() === newProteinName.trim().toLowerCase())
  }, [newProteinName, proteins])

  const mealTypeExists = useMemo(() => {
    return mealTypes.some(m => m.name.toLowerCase() === newMealTypeName.trim().toLowerCase())
  }, [newMealTypeName, mealTypes])

  useEffect(() => {
    Promise.all([
      apiFetch('/proteins/').then(res => res.json()),
      apiFetch('/meal-types/').then(res => res.json())
    ]).then(([proteinData, mealTypeData]) => {
      setProteins(proteinData)
      setMealTypes(mealTypeData)
      // Set default protein if not provided in initialData
      if (!initialData?.protein_ids && proteinData.length > 0 && formData.protein_ids.length === 0) {
        setFormData(prev => ({ ...prev, protein_ids: [proteinData[0].id] }))
      }
    }).catch(err => {
      console.error('Failed to fetch options:', err)
      setError('Failed to load form options. Please check your connection.')
    })
  }, [initialData])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }))
  }, [])

  const toggleProtein = useCallback((id: number) => {
    setFormData(prev => ({
      ...prev,
      protein_ids: prev.protein_ids.includes(id)
        ? prev.protein_ids.filter(i => i !== id)
        : [...prev.protein_ids, id]
    }))
  }, [])

  const toggleMealType = useCallback((id: number) => {
    setFormData(prev => ({
      ...prev,
      meal_type_ids: prev.meal_type_ids.includes(id)
        ? prev.meal_type_ids.filter(i => i !== id)
        : [...prev.meal_type_ids, id]
    }))
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const removeImage = useCallback(() => {
    setImageFile(null)
    setImagePreview(null)
    setFormData(prev => ({ ...prev, cover_image_url: undefined }))
  }, [])

  const handleAddIngredient = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { item: '', amount: '' }]
    }))
  }, [])

  const handleUpdateIngredient = useCallback((index: number, field: keyof Ingredient, value: string) => {
    setFormData(prev => {
      const newIngredients = [...prev.ingredients]
      newIngredients[index] = { ...newIngredients[index], [field]: value }
      return { ...prev, ingredients: newIngredients }
    })
  }, [])

  const handleRemoveIngredient = useCallback((index: number) => {
    setFormData(prev => {
      if (prev.ingredients.length === 1) return prev
      return {
        ...prev,
        ingredients: prev.ingredients.filter((_, i) => i !== index)
      }
    })
  }, [])

  const handleAddStep = useCallback((type: 'prep' | 'cook') => {
    setFormData(prev => ({
      ...prev,
      instructions: {
        ...prev.instructions,
        [type]: [
          ...prev.instructions[type],
          { 
            step: prev.instructions[type].length + 1, 
            action: '', 
            description: '',
            ...(type === 'cook' ? { timer_mins: 0 } : {})
          }
        ]
      }
    }))
  }, [])

  const handleUpdateStep = useCallback((type: 'prep' | 'cook', index: number, field: keyof InstructionStep, value: string | number) => {
    setFormData(prev => {
      const newSteps = [...prev.instructions[type]]
      newSteps[index] = { ...newSteps[index], [field]: value } as InstructionStep
      return {
        ...prev,
        instructions: { ...prev.instructions, [type]: newSteps }
      }
    })
  }, [])

  const handleRemoveStep = useCallback((type: 'prep' | 'cook', index: number) => {
    setFormData(prev => {
      if (prev.instructions[type].length === 1) return prev
      const newSteps = prev.instructions[type]
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, step: i + 1 }))
      
      return {
        ...prev,
        instructions: { ...prev.instructions, [type]: newSteps }
      }
    })
  }, [])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result
    if (!destination) return

    const [type, stepType] = source.droppableId.split('-') as ['instructions', 'prep' | 'cook']
    if (type !== 'instructions') return

    setFormData(prev => {
      const items = Array.from(prev.instructions[stepType])
      const [reorderedItem] = items.splice(source.index, 1)
      items.splice(destination.index, 0, reorderedItem)

      // Re-index steps
      const updatedItems = items.map((item, index) => ({
        ...item,
        step: index + 1
      }))

      return {
        ...prev,
        instructions: {
          ...prev.instructions,
          [stepType]: updatedItems
        }
      }
    })
  }, [])

  const handleAddReferenceLink = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      reference_links: [...prev.reference_links, { type: 'YouTube', title: '', url: '' }]
    }))
  }, [])

  const handleUpdateReferenceLink = useCallback((index: number, field: keyof ReferenceLink, value: string) => {
    setFormData(prev => {
      const newLinks = [...prev.reference_links]
      newLinks[index] = { ...newLinks[index], [field]: value }
      return { ...prev, reference_links: newLinks }
    })
  }, [])

  const handleRemoveReferenceLink = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      reference_links: prev.reference_links.filter((_, i) => i !== index)
    }))
  }, [])

  const handleUrlBlur = useCallback(async (index: number, url: string) => {
    if (!url || !url.includes('yout')) return;
    
    setFormData(prev => {
      if (prev.reference_links[index].type !== 'YouTube') {
        const newLinks = [...prev.reference_links]
        newLinks[index] = { ...newLinks[index], type: 'YouTube' }
        return { ...prev, reference_links: newLinks }
      }
      return prev
    })

    // Using a ref or checking current state in a functional update is tricky for async
    // Let's just check against what we have in the moment.
    
    try {
      const res = await apiFetch(`/metadata/youtube?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.formatted_title) {
          handleUpdateReferenceLink(index, 'title', data.formatted_title);
        }
      }
    } catch (err) {
      console.error('Failed to fetch YouTube metadata:', err);
    }
  }, [handleUpdateReferenceLink])

  const handleAddProtein = useCallback(async (name: string) => {
    if (!name.trim()) {
      setShowAddProtein(false);
      return;
    }
    try {
      const res = await apiFetch('/proteins/', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() })
      })
      if (!res.ok) throw new Error('Failed to add protein')
      const newProtein = await res.json()
      setProteins(prev => [...prev, newProtein].sort((a, b) => a.name.localeCompare(b.name)))
      toggleProtein(newProtein.id)
      setNewProteinName('')
      setShowAddProtein(false)
    } catch (err) {
      console.error(err)
      setError('Could not add protein. It might already exist.')
    }
  }, [toggleProtein])

  const handleAddMealType = useCallback(async (name: string) => {
    if (!name.trim()) {
      setShowAddMealType(false);
      return;
    }
    try {
      const res = await apiFetch('/meal-types/', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() })
      })
      if (!res.ok) throw new Error('Failed to add meal type')
      const newType = await res.json()
      setMealTypes(prev => [...prev, newType].sort((a, b) => a.name.localeCompare(b.name)))
      toggleMealType(newType.id)
      setNewMealTypeName('')
      setShowAddMealType(false)
    } catch (err) {
      console.error(err)
      setError('Could not add meal type. It might already exist.')
    }
  }, [toggleMealType])

  const togglePreview = useCallback((id: string) => {
    setPreviews(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const saveDraft = useCallback(() => {
    localStorage.setItem('recipe_draft', JSON.stringify(formData))
    setHasDraft(true)
  }, [formData])

  const restoreDraft = useCallback(() => {
    const draft = localStorage.getItem('recipe_draft')
    if (draft) {
      setFormData(JSON.parse(draft))
      localStorage.removeItem('recipe_draft')
      setHasDraft(false)
    }
  }, [])

  const clearDraft = useCallback(() => {
    localStorage.removeItem('recipe_draft')
    setHasDraft(false)
  }, [])

  useEffect(() => {
    const draft = localStorage.getItem('recipe_draft')
    if (draft) {
      setHasDraft(true)
    }
  }, [])

  const value = {
    formData,
    imageFile,
    imagePreview,
    error,
    loading,
    proteins,
    mealTypes,
    showAddProtein,
    newProteinName,
    showAddMealType,
    newMealTypeName,
    previews,
    showMarkdownHelp,
    proteinExists,
    mealTypeExists,
    apiUrl,
    hasDraft,
    setFormData,
    setError,
    setImageFile,
    setImagePreview,
    setShowAddProtein,
    setNewProteinName,
    setShowAddMealType,
    setNewMealTypeName,
    setShowMarkdownHelp,
    handleInputChange,
    toggleProtein,
    toggleMealType,
    handleFileChange,
    removeImage,
    handleAddIngredient,
    handleUpdateIngredient,
    handleRemoveIngredient,
    handleAddStep,
    handleUpdateStep,
    handleRemoveStep,
    handleDragEnd,
    handleAddReferenceLink,
    handleUpdateReferenceLink,
    handleRemoveReferenceLink,
    handleUrlBlur,
    handleAddProtein,
    handleAddMealType,
    togglePreview,
    saveDraft,
    restoreDraft,
    clearDraft
  }

  return (
    <RecipeFormContext.Provider value={value}>
      {children}
    </RecipeFormContext.Provider>
  )
}
