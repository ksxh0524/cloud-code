import React, { useState } from 'react'
import { Message } from '../types'
import CodeBlock from './CodeBlock'
import ToolCallCard from './ToolCallCard'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import styles from './MessageItem.module.css'

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
    return <code className={styles.inlineCode} {...props}>{children}</code>
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
      <div className={styles.msgUser}>
        <div className={styles.msgUserText}>{message.content}</div>
      </div>
    )
  }

  // Thinking — collapsible gray text
  if (message.type === 'thinking') {
    const preview = (message.content || '').slice(0, 80)
    return (
      <div>
        <button className={styles.thinkingToggle} onClick={() => setThinkingExpanded(e => !e)} aria-expanded={thinkingExpanded}>
          <span className={styles.thinkingArrow}>{thinkingExpanded ? '▼' : '▸'}</span>
          <span className={styles.thinkingLabel}>Thinking</span>
        </button>
        {thinkingExpanded && <div className={styles.thinkingBody}>{message.content}</div>}
        {!thinkingExpanded && preview && <div className={styles.thinkingPreview}>{preview}...</div>}
      </div>
    )
  }

  // Assistant text — Markdown with streaming cursor
  const showCursor = isStreaming && !!message.content
  return (
    <div>
      <div className={showCursor ? `${styles.msgAssistantText} ${styles.streamingCursor}` : styles.msgAssistantText}>
        {message.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        ) : (
          <span style={{ color: '#999' }}>...</span>
        )}
      </div>
    </div>
  )
})
