import { Message } from '../types'
import CodeBlock from './CodeBlock'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MessageItemProps {
  message: Message
}

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>
  },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const codeStr = String(children).replace(/\n$/, '')
    if (match) {
      return <CodeBlock code={codeStr} language={match[1]} />
    }
    return <code className="inline-code" {...props}>{children}</code>
  },
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isThinking = message.type === 'thinking'
  const isToolUse = message.type === 'tool_use'

  const getRoleLabel = () => {
    if (isUser) return 'You'
    if (isTool) return 'Tool'
    if (isThinking) return 'Thinking'
    if (isToolUse) return 'Action'
    return 'Assistant'
  }

  const getMessageStyle = () => {
    if (isUser) return 'user'
    if (isTool) return 'tool'
    if (isThinking) return 'thinking'
    if (isToolUse) return 'tool-use'
    return 'assistant'
  }

  const renderContent = () => {
    const content = message.content || ''
    if (!content) return <span className="typing">...</span>

    // Render markdown for assistant text messages
    if (!isUser && !isTool && !isThinking && !isToolUse) {
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      )
    }

    return content
  }

  return (
    <div className={`message-item ${getMessageStyle()}`}>
      <div className="message-header">
        <span className="role-label">{getRoleLabel()}</span>
      </div>
      <div className="message-content">
        <div className="message-text">{renderContent()}</div>
        {message.metadata?.toolName && (
          <div className="tool-info">
            <span className="tool-name">{message.metadata.toolName}</span>
          </div>
        )}
      </div>

      <style>{`
        .message-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 100%;
        }

        .message-item.user {
          align-self: flex-end;
        }

        .message-item.assistant,
        .message-item.thinking,
        .message-item.tool-use,
        .message-item.tool {
          align-self: flex-start;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 4px;
        }

        .role-label {
          font-size: 12px;
          font-weight: 600;
          color: #8e8ea0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .message-item.user .role-label {
          color: #3b82f6;
        }

        .message-item.thinking .role-label {
          color: #f59e0b;
        }

        .message-item.tool-use .role-label {
          color: #10b981;
        }

        .message-item.tool .role-label {
          color: #8b5cf6;
        }

        .message-content {
          max-width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
        }

        .message-item.user .message-content {
          background: #3b82f6;
          color: white;
        }

        .message-item.assistant .message-content {
          background: #f7f7f8;
        }

        .message-item.thinking .message-content {
          background: #fef3c7;
          border: 1px solid #fcd34d;
        }

        .message-item.tool-use .message-content {
          background: #d1fae5;
          border: 1px solid #6ee7b7;
        }

        .message-item.tool .message-content {
          background: #ede9fe;
          border: 1px solid #c4b5fd;
        }

        .message-text {
          font-size: 15px;
          line-height: 1.6;
          color: inherit;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .message-item.assistant .message-text {
          white-space: normal;
        }

        .message-item.user .message-text {
          color: white;
        }

        .message-text p {
          margin: 0 0 8px;
        }

        .message-text p:last-child {
          margin-bottom: 0;
        }

        .message-text ul, .message-text ol {
          margin: 4px 0;
          padding-left: 20px;
        }

        .message-text li {
          margin-bottom: 4px;
        }

        .message-text h1, .message-text h2, .message-text h3 {
          margin: 12px 0 6px;
          font-weight: 600;
        }

        .message-text h1 { font-size: 18px; }
        .message-text h2 { font-size: 16px; }
        .message-text h3 { font-size: 15px; }

        .message-text table {
          border-collapse: collapse;
          margin: 8px 0;
          width: 100%;
        }

        .message-text th, .message-text td {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          font-size: 13px;
        }

        .message-text th {
          background: #f3f4f6;
          font-weight: 600;
        }

        .inline-code {
          background: rgba(0,0,0,0.06);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Söhne Mono', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
        }

        .typing {
          color: #8e8ea0;
          font-style: italic;
        }

        .tool-info {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(0,0,0,0.1);
        }

        .tool-name {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .message-content {
            max-width: 100%;
            padding: 10px 14px;
          }

          .message-text {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  )
}
