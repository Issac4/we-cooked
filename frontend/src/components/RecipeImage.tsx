import { useState } from 'react'
import { Utensils, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import CONFIG from '@/config'

interface RecipeImageProps {
  src?: string | null
  alt: string
  className?: string
  containerClassName?: string
}

export function RecipeImage({ src, alt, className, containerClassName }: RecipeImageProps) {
  const [error, setError] = useState(false)

  const imageUrl = src 
    ? (src.startsWith('http') || src.startsWith('data:') ? src : `${CONFIG.API_URL}${src}`)
    : null

  // 1. Error Case: User added an image but it failed to load
  if (error) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-red-50 text-red-400 gap-2 border-b border-red-100",
          containerClassName
        )}
        data-testid="image-error"
      >
        <ImageOff className="w-8 h-8 opacity-50" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">No Image</span>
      </div>
    )
  }

  // 2. Placeholder Case: No image was added yet
  if (!imageUrl) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 text-slate-300 gap-3 border-b border-slate-100",
          containerClassName
        )}
        data-testid="image-placeholder"
      >
        <div className="bg-white p-4 rounded-full shadow-sm">
          <Utensils className="w-8 h-8 opacity-40" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Culinary Gallery</span>
      </div>
    )
  }

  // 3. Success Case: Image loaded correctly
  return (
    <div className={cn("overflow-hidden", containerClassName)}>
      <img
        src={imageUrl}
        alt={alt}
        className={cn("w-full h-full object-cover", className)}
        onError={() => setError(true)}
      />
    </div>
  )
}
