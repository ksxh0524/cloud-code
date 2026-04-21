import React, { useState } from 'react'
import CodeBlock from './CodeBlock'
import styles from './ToolCallCard.module.css'

interface ToolCallCardProps {
  toolName: string
  toolInput?: Record<string, unknown>
  toolOutput?: string
  status: 'running' | 'done' | 'error'
}

export default React.memo(function ToolCallCard({ toolName, toolInput, toolOutput, status }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = status === 'running' ? '⏳' : status === 'error' ? '✕' : '✓'
  const statusColor = status === 'running' ? '#d97706' : status === 'error' ? '#dc2626' : '#16a34a'
  const statusText = status === 'running' ? '运行中' : status === 'error' ? '失败' : '完成'

  const isEdit = toolName === 'Edit' || toolName === 'Write'

  const formatInput = () => {
    if (!toolInput) return null
    if (isEdit && toolInput.old_string !== undefined && toolInput.new_string !== undefined) {
      return null // Will be rendered by DiffView
    }
    const entries = Object.entries(toolInput)
      .filter(([k]) => k !== 'old_string' && k !== 'new_string')
    if (entries.length === 0) return null
    return entries.map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v, null, 2)
      return { key: k, value: val }
    })
  }

  const inputEntries = formatInput()
  const hasDiff = isEdit && toolInput?.old_string !== undefined && toolInput?.new_string !== undefined
  const filePath = (toolInput?.file_path as string) || ''

  return (
    <div className={styles.toolCard}>
      <button className={styles.toolCardHeader} onClick={() => setExpanded(e => !e)} aria-expanded={expanded}>
        <span className={styles.toolCardArrow}>{expanded ? '▼' : '▸'}</span>
        <span className={styles.toolCardName}>{toolName}</span>
        {filePath && <span className={styles.toolCardFile}>{filePath.split('/').pop()}</span>}
        <span className={styles.toolCardStatus} style={{ color: statusColor }}>
          {statusIcon} {statusText}
        </span>
      </button>

      {expanded && (
        <div className={styles.toolCardBody}>
          {hasDiff && (
            <div className={styles.toolDiff}>
              {toolInput.old_string !== undefined && (
                <div className={styles.diffSection}>
                  <div className={styles.diffLabel}>-</div>
                  <pre className={styles.diffOld}>{String(toolInput.old_string)}</pre>
                </div>
              )}
              {toolInput.new_string !== undefined && (
                <div className={styles.diffSection}>
                  <div className={styles.diffLabel}>+</div>
                  <pre className={styles.diffNew}>{String(toolInput.new_string)}</pre>
                </div>
              )}
            </div>
          )}

          {inputEntries && inputEntries.length > 0 && (
            <div className={styles.toolInputs}>
              {inputEntries.map(({ key, value }) => (
                <div key={key} className={styles.toolInputItem}>
                  <span className={styles.toolInputKey}>{key}</span>
                  {value.split('\n').length > 2 ? (
                    <CodeBlock code={value} language="bash" />
                  ) : (
                    <pre className={styles.toolInputVal}>{value}</pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {toolOutput && (
            <div className={styles.toolOutput}>
              <div className={styles.toolOutputLabel}>输出</div>
              {toolOutput.split('\n').length > 5 ? (
                <CodeBlock code={toolOutput} language="text" />
              ) : (
                <pre className={styles.toolOutputText}>{toolOutput.length > 500 ? toolOutput.slice(0, 500) + '...' : toolOutput}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
