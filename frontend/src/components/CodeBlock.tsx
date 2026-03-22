interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  return (
    <div className="code-block">
      <pre>
        <code className={`language-${language}`}>{code}</code>
      </pre>

      <style>{`
        .code-block {
          background: #f7f7f8;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          overflow: hidden;
          margin: 8px 0;
        }

        .code-block pre {
          margin: 0;
          padding: 12px;
          overflow-x: auto;
        }

        .code-block code {
          font-family: 'Söhne Mono', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: #2e2e2e;
        }

        .code-block code::selection {
          background: rgba(16, 163, 127, 0.2);
        }
      `}</style>
    </div>
  )
}
