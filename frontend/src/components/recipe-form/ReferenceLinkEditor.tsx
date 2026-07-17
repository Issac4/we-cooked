import { Plus, Trash2, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRecipeForm } from './RecipeFormContext'

export const ReferenceLinkEditor = () => {
  const {
    formData,
    handleUpdateReferenceLink,
    handleAddReferenceLink,
    handleRemoveReferenceLink,
    handleUrlBlur
  } = useRecipeForm()

  const { reference_links } = formData

  return (
    <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden p-0">
      <CardHeader className="bg-slate-50 border-b border-slate-100 py-6">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-blue-600" />
          Reference Links
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-4">
        {reference_links.map((link, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-slate-50/50 p-4 rounded-2xl border border-slate-100 relative group">
            <div className="md:col-span-3 space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Type</Label>
              <select
                value={link.type}
                onChange={(e) => handleUpdateReferenceLink(idx, 'type', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="YouTube">YouTube</option>
                <option value="Blog">Blog Post</option>
                <option value="Original">Original Recipe</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="md:col-span-4 space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">URL</Label>
              <Input 
                placeholder="https://..." 
                value={link.url}
                onChange={(e) => handleUpdateReferenceLink(idx, 'url', e.target.value)}
                onBlur={(e) => handleUrlBlur(idx, e.target.value)}
                className="h-10"
              />
            </div>
            <div className="md:col-span-4 space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase">Title</Label>
              <Input 
                placeholder="e.g. Video Tutorial" 
                value={link.title}
                onChange={(e) => handleUpdateReferenceLink(idx, 'title', e.target.value)}
                className="h-10"
              />
            </div>
            <div className="md:col-span-1 pt-8 md:pt-6 flex justify-end">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                aria-label="Remove reference link"
                onClick={() => handleRemoveReferenceLink(idx)}
                className="text-slate-300 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleAddReferenceLink}
          className="w-full border-dashed border-2 py-6 rounded-2xl text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Reference Link
        </Button>
      </CardContent>
    </Card>
  )
}
