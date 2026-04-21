import React, { useState } from 'react'
import { Message } from '../types'
import CodeBlock from './CodeBlock'
import ToolCallCard from './ToolCallCard'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
}

const markdownComponents: Components = {
  pre({ children }) { return <>{children}</> },
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const codeStr = String(children).replace(/\n$/, '')
    if (match) return <CodeBlock code={codeStr} language={match[1]} />
    return <code className="inline-code" {...props}>{children}</code>
  },
}

export default React.memo(function MessageItem({ message, isStreaming }: MessageItemProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false)

  // Tool use — render as ToolCallCard with diff support
  if (message.type === 'tool_use') {
    const toolName = message.metadata?.toolName || 'Tool'
    const toolInput = message.metadata?.toolInput as Record<string, unknown> | undefined
    const toolOutput = message.metadata?.toolOutput as string | undefined
    return <ToolCallCard toolName={toolName} toolInput={toolInput} toolOutput={toolOutput} status={toolOutput !== undefined ? 'done' : 'running'} />
  }

  // Tool result — merged into ToolCallCard, skip standalone rendering
  if (message.type === 'tool_result') return null

  // User message — right-aligned bubble
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-user-text">{message.content}</div>
        <style>{`
          .msg-user { display: flex; justify-content: flex-end; }
          .msg-user-text {
            max-width: 85%; padding: 10px 14px;
            background: #f0f0f0; border-radius: 16px 16px 4px 16px;
            font-size: 15px; line-height: 1.5; color: #111;
            white-space: pre-wrap; word-break: break-word;
          }
          @media (max-width: 768px) {
            .msg-user-text { font-size: 14px; max-width: 90%; }
          }
        `}</style>
      </div>
    )
  }

  // Thinking — collapsible gray text
  if (message.type === 'thinking') {
    const preview = (message.content || '').slice(0, 80)
    return (
      <div className="msg msg-thinking">
        <button className="thinking-toggle" onClick={() => setThinkingExpanded(e => !e)}>
          <span className="thinking-arrow">{thinkingExpanded ? '▼' : '▸'}</span>
          <span className="thinking-label">Thinking</span>
        </button>
        {thinkingExpanded && <div className="thinking-body">{message.content}</div>}
        {!thinkingExpanded && preview && <div className="thinking-preview">{preview}...</div>}
        <style>{`
          .thinking-toggle {
            display: inline-flex; align-items: center; gap: 6px;
            background: none; border: none; padding: 4px 0;
            color: #999; font-size: 12px; cursor: pointer;
          }
          .thinking-toggle:hover { color: #666; }
          .thinking-arrow { font-size: 10px; }
          .thinking-label { font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
          .thinking-preview { font-size: 13px; color: #aaa; line-height: 1.4; margin-top: 2px; }
          .thinking-body {
            margin-top: 6px; padding: 10px 12px;
            background: #f9f9f9; border-radius: 6px;
            font-size: 13px; color: #888; line-height: 1.5;
            white-space: pre-wrap; word-break: break-word;
            font-style: italic;
          }
        `}</style>
      </div>
    )
  }

  // Assistant text — Markdown with streaming cursor
  const showCursor = isStreaming && !!message.content
  return (
    <div className="msg msg-assistant">
      <div className={showCursor ? 'msg-assistant-text streaming-cursor' : 'msg-assistant-text'}>
        {message.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        ) : (
          <span style={{ color: '#999' }}>...</span>
        )}
      </div>
      <style>{`
        .msg-assistant-text {
          font-size: 15px; line-height: 1.7; color: #111; max-width: 100%;
        }
        .msg-assistant-text p { margin: 0 0 8px; }
        .msg-assistant-text p:last-child { margin-bottom: 0; }
        .msg-assistant-text ul, .msg-assistant-text ol { margin: 4px 0; padding-left: 20px; }
        .msg-assistant-text li { margin-bottom: 4px; }
        .msg-assistant-text h1, .msg-assistant-text h2, .msg-assistant-text h3 {
          margin: 12px 0 6px; font-weight: 600; color: #111;
        }
        .msg-assistant-text h1 { font-size: 18px; }
        .msg-assistant-text h2 { font-size: 16px; }
        .msg-assistant-text h3 { font-size: 15px; }
        .msg-assistant-text table { border-collapse: collapse; margin: 8px 0; width: 100%; }
        .msg-assistant-text th, .msg-assistant-text td { border: 1px solid #e5e5e5; padding: 6px 10px; font-size: 13px; }
        .msg-assistant-text th { background: #f7f7f8; font-weight: 600; }
        .inline-code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: 'SFMono-Regular', 'Menlo', monospace; font-size: 13px; }
        .streaming-cursor::after {
          content: '▌'; animation: blink 1s infinite;
          color: #111; margin-left: 1px;
        }
        @media (max-width: 768px) {
          .msg-assistant-text { font-size: 14px; }
        }
      `}</style>
    </div>
  )
})
