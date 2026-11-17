import ReactMarkdown from 'react-markdown';

/** Step and description text. Raw HTML is never rendered; links open in a new tab. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="wc-markdown">
      <ReactMarkdown
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
