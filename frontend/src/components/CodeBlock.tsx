import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? '✓ 已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter language={language} style={oneDark} customStyle={{
        margin: 0,
        borderRadius: '0 0 6px 6px',
        fontSize: '13px',
        lineHeight: '1.5',
      }}>
        {code}
      </SyntaxHighlighter>

      <style>{`
        .code-block {
          border-radius: 6px;
          overflow: hidden;
          margin: 8px 0;
          border: 1px solid #e5e5e5;
        }

        .code-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          background: #2d2d2d;
          font-size: 12px;
        }

        .code-block-lang {
          color: #8e8ea0;
          text-transform: uppercase;
        }

        .code-block-copy {
          background: none;
          border: none;
          color: #8e8ea0;
          cursor: pointer;
          font-size: 12px;
          padding: 2px 6px;
          min-height: unset;
          min-width: unset;
        }

        .code-block-copy:hover {
          color: #ffffff;
        }
      `}</style>
    </div>
  )
}
