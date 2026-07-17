import { useRef } from 'react'
import { Image as ImageIcon, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useRecipeForm } from './RecipeFormContext'

export const ImagePicker = () => {
  const { imagePreview, handleFileChange, removeImage, apiUrl } = useRecipeForm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getFullImageUrl = (url: string) => {
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${apiUrl}${url}`;
  };

  return (
    <div className="space-y-4">
      <Label>Recipe Cover Image</Label>
      <div 
        onClick={() => !imagePreview && fileInputRef.current?.click()}
        className={cn(
          "relative h-64 w-full rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden group",
          imagePreview 
            ? "border-transparent" 
            : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer"
        )}
      >
        {imagePreview ? (
          <>
            <img src={getFullImageUrl(imagePreview)} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <Button 
                type="button" 
                variant="secondary" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="rounded-full gap-2"
              >
                <ImagePlus className="w-4 h-4" /> Change
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  removeImage()
                }}
                className="rounded-full gap-2"
              >
                <X className="w-4 h-4" /> Remove
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center space-y-2">
            <div className="bg-slate-100 p-4 rounded-full w-fit mx-auto group-hover:bg-blue-100 transition-colors">
              <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Click to upload image</p>
              <p className="text-xs text-slate-400">JPG, PNG, WebP up to 5MB</p>
            </div>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          aria-label="Upload recipe image"
          className="hidden" 
        />
      </div>
    </div>
  )
}
