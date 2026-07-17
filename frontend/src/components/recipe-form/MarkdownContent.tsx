import ReactMarkdown from 'react-markdown'

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent = ({ content }: MarkdownContentProps) => (
  <div className="text-slate-600 leading-relaxed prose prose-slate max-w-none">
    <ReactMarkdown 
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-black text-slate-900">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-500">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">{children}</a>
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
)
