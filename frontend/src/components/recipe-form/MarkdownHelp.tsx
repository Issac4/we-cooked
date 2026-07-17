import { Card, CardContent } from '@/components/ui/card'

interface MarkdownHelpProps {
  show: boolean;
}

export const MarkdownHelp = ({ show }: MarkdownHelpProps) => {
  if (!show) return null;

  return (
    <Card className="border-blue-100 bg-blue-50/30 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Emphasis</p>
          <ul className="text-xs space-y-1.5 font-medium text-slate-600">
            <li className="flex justify-between"><span>**Bold**</span> <span className="text-slate-400">**text**</span></li>
            <li className="flex justify-between"><span>*Italic*</span> <span className="text-slate-400">*text*</span></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Lists</p>
          <ul className="text-xs space-y-1.5 font-medium text-slate-600">
            <li className="flex justify-between"><span>Bullet</span> <span className="text-slate-400">- item</span></li>
            <li className="flex justify-between"><span>Numbered</span> <span className="text-slate-400">1. item</span></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Links</p>
          <ul className="text-xs space-y-1.5 font-medium text-slate-600">
            <li className="flex justify-between"><span>Link</span> <span className="text-slate-400">[label](url)</span></li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Tips</p>
          <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
            Use <code className="bg-slate-100 px-1 rounded text-blue-600">Space Space + Enter</code> for a line break.<br />
            Use <code className="bg-slate-100 px-1 rounded text-blue-600">Double Enter</code> for a new paragraph.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
