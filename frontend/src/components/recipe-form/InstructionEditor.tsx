import { Plus, Trash2, GripVertical, Eye, EyeOff, HelpCircle, X, Info } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './MarkdownContent'
import { MarkdownHelp } from './MarkdownHelp'
import { useRecipeForm } from './RecipeFormContext'

export const InstructionEditor = () => {
  const {
    formData,
    handleUpdateStep,
    handleAddStep,
    handleRemoveStep,
    handleDragEnd,
    previews,
    togglePreview,
    showMarkdownHelp,
    setShowMarkdownHelp
  } = useRecipeForm()

  const { instructions } = formData

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-10">
        {/* Markdown Help Header */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Markdown Editor</p>
              <p className="text-xs text-slate-500 font-medium">Use markdown to format your descriptions.</p>
            </div>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => setShowMarkdownHelp(!showMarkdownHelp)}
            className="rounded-xl font-bold text-xs uppercase tracking-wider gap-2 h-9"
          >
            {showMarkdownHelp ? <X className="w-3 h-3" /> : <Info className="w-3 h-3" />}
            {showMarkdownHelp ? 'Hide Guide' : 'Formatting Guide'}
          </Button>
        </div>

        <MarkdownHelp show={showMarkdownHelp} />

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="text-blue-600">01.</span> Preparation Steps
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-slate-200">
              Markdown Supported
            </Badge>
          </div>
          
          <Droppable droppableId="instructions-prep">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-6"
              >
                {instructions.prep.map((step, idx) => {
                  const stepId = `prep-${idx}`;
                  const isPreview = previews[stepId];
                  return (
                    <Draggable key={stepId} draggableId={stepId} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "transition-shadow",
                            snapshot.isDragging && "shadow-2xl z-50"
                          )}
                        >
                          <Card className={cn(
                            "border-slate-100 shadow-sm rounded-2xl relative",
                            snapshot.isDragging && "border-blue-200 bg-blue-50/10"
                          )}>
                            <CardContent className="p-6 space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                  <div 
                                    {...provided.dragHandleProps}
                                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400 cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="w-5 h-5" />
                                  </div>
                                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    {step.step}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => togglePreview(stepId)}
                                    className={cn(
                                      "rounded-full h-8 px-3 gap-2 text-xs font-bold",
                                      isPreview ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                    )}
                                  >
                                    {isPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {isPreview ? 'Close Preview' : 'Live Preview'}
                                  </Button>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    aria-label="Remove step"
                                    onClick={() => handleRemoveStep('prep', idx)}
                                    className="text-slate-300 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <Input 
                                  placeholder="Action (e.g. Dice the onions)" 
                                  value={step.action}
                                  className="font-bold h-10"
                                  onChange={(e) => handleUpdateStep('prep', idx, 'action', e.target.value)}
                                />
                                {isPreview ? (
                                  <div className="min-h-[80px] p-3 rounded-md bg-slate-50/50 border border-slate-100">
                                    <MarkdownContent content={step.description || '*No description provided*'} />
                                  </div>
                                ) : (
                                  <Textarea 
                                    placeholder="Detailed description (optional)..." 
                                    value={step.description || ''}
                                    className="min-h-[80px]"
                                    onChange={(e) => handleUpdateStep('prep', idx, 'description', e.target.value)}
                                  />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleAddStep('prep')}
                  className="w-full border-dashed border-2 py-8 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Preparation Step
                </Button>
              </div>
            )}
          </Droppable>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="text-green-600">02.</span> Cooking Steps
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-slate-200">
              Markdown Supported
            </Badge>
          </div>

          <Droppable droppableId="instructions-cook">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-6"
              >
                {instructions.cook.map((step, idx) => {
                  const stepId = `cook-${idx}`;
                  const isPreview = previews[stepId];
                  return (
                    <Draggable key={stepId} draggableId={stepId} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "transition-shadow",
                            snapshot.isDragging && "shadow-2xl z-50"
                          )}
                        >
                          <Card className={cn(
                            "border-slate-100 shadow-sm rounded-2xl relative",
                            snapshot.isDragging && "border-green-200 bg-green-50/10"
                          )}>
                            <CardContent className="p-6 space-y-4">
                              <div className="flex justify-between items-start">
                                <div className="flex gap-4 items-center">
                                  <div 
                                    {...provided.dragHandleProps}
                                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400 cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="w-5 h-5" />
                                  </div>
                                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
                                    {step.step}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor={`timer-${idx}`} className="text-xs font-bold text-slate-400 uppercase">Timer (min)</Label>
                                    <Input 
                                      id={`timer-${idx}`}
                                      type="number" 
                                      className="w-20 h-8"
                                      value={step.timer_mins || 0}
                                      onChange={(e) => handleUpdateStep('cook', idx, 'timer_mins', parseInt(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => togglePreview(stepId)}
                                    className={cn(
                                      "rounded-full h-8 px-3 gap-2 text-xs font-bold",
                                      isPreview ? "bg-green-600 text-white hover:bg-green-700 hover:text-white" : "text-slate-400 hover:text-green-600 hover:bg-green-50"
                                    )}
                                  >
                                    {isPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {isPreview ? 'Close Preview' : 'Live Preview'}
                                  </Button>
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    aria-label="Remove step"
                                    onClick={() => handleRemoveStep('cook', idx)}
                                    className="text-slate-300 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <Input 
                                  placeholder="Action (e.g. Sear the steak)" 
                                  value={step.action}
                                  className="font-bold h-10"
                                  onChange={(e) => handleUpdateStep('cook', idx, 'action', e.target.value)}
                                />
                                {isPreview ? (
                                  <div className="min-h-[80px] p-3 rounded-md bg-slate-50/50 border border-slate-100">
                                    <MarkdownContent content={step.description || '*No description provided*'} />
                                  </div>
                                ) : (
                                  <Textarea 
                                    placeholder="Detailed description (optional)..." 
                                    value={step.description || ''}
                                    className="min-h-[80px]"
                                    onChange={(e) => handleUpdateStep('cook', idx, 'description', e.target.value)}
                                  />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => handleAddStep('cook')}
                  className="w-full border-dashed border-2 py-8 rounded-2xl text-slate-400 hover:text-green-600 hover:border-green-200 hover:bg-green-50/50 gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Cooking Step
                </Button>
              </div>
            )}
          </Droppable>
        </section>
      </div>
    </DragDropContext>
  )
}
