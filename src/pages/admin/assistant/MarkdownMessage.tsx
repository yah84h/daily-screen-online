import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Model output is untrusted: no raw HTML, external images, or script/data URLs. */
export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="assistant-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => (/^(https?:\/\/|mailto:|\/[^/]|#)/i.test(url) ? url : '')}
        components={{
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => <span>{alt || 'صورة'}</span>,
          table: ({ children }) => (
            <div className="assistant-table-scroll" tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
