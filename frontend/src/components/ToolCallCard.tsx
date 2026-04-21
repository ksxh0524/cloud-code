import React, { useState } from 'react'
import CodeBlock from './CodeBlock'

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
    <div className="tool-card">
      <button className="tool-card-header" onClick={() => setExpanded(e => !e)}>
        <span className="tool-card-arrow">{expanded ? '▼' : '▸'}</span>
        <span className="tool-card-name">{toolName}</span>
        {filePath && <span className="tool-card-file">{filePath.split('/').pop()}</span>}
        <span className="tool-card-status" style={{ color: statusColor }}>
          {statusIcon} {statusText}
        </span>
      </button>

      {expanded && (
        <div className="tool-card-body">
          {hasDiff && (
            <div className="tool-diff">
              {toolInput.old_string !== undefined && (
                <div className="diff-section">
                  <div className="diff-label">-</div>
                  <pre className="diff-old">{String(toolInput.old_string)}</pre>
                </div>
              )}
              {toolInput.new_string !== undefined && (
                <div className="diff-section">
                  <div className="diff-label">+</div>
                  <pre className="diff-new">{String(toolInput.new_string)}</pre>
                </div>
              )}
            </div>
          )}

          {inputEntries && inputEntries.length > 0 && (
            <div className="tool-inputs">
              {inputEntries.map(({ key, value }) => (
                <div key={key} className="tool-input-item">
                  <span className="tool-input-key">{key}</span>
                  {value.split('\n').length > 2 ? (
                    <CodeBlock code={value} language="bash" />
                  ) : (
                    <pre className="tool-input-val">{value}</pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {toolOutput && (
            <div className="tool-output">
              <div className="tool-output-label">输出</div>
              {toolOutput.split('\n').length > 5 ? (
                <CodeBlock code={toolOutput} language="text" />
              ) : (
                <pre className="tool-output-text">{toolOutput.length > 500 ? toolOutput.slice(0, 500) + '...' : toolOutput}</pre>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .tool-card {
          margin: 4px 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #f0f0f0;
          background: #fafafa;
        }
        .tool-card-header {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 8px 10px;
          background: none; border: none;
          cursor: pointer; font-size: 14px;
          color: #555; text-align: left;
          border-radius: 8px;
          transition: background 0.15s;
          min-height: 42px;
        }
        .tool-card-header:hover { background: #f0f0f0; }
        .tool-card-arrow { font-size: 10px; color: #aaa; flex-shrink: 0; }
        .tool-card-name { font-weight: 600; color: #333; }
        .tool-card-file {
          font-size: 12px; color: #888;
          font-family: 'SFMono-Regular', 'Menlo', monospace;
          background: #e8e8e8; padding: 2px 8px;
          border-radius: 4px; max-width: 150px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tool-card-status { margin-left: auto; font-size: 12px; font-weight: 500; flex-shrink: 0; }
        .tool-card-body {
          padding: 0 10px 10px;
          font-size: 13px;
        }
        .tool-diff { margin-bottom: 8px; border-radius: 6px; overflow: hidden; }
        .diff-section { margin-bottom: 2px; }
        .diff-label {
          display: inline-block; width: 24px;
          font-weight: 700; font-size: 13px;
          user-select: none;
        }
        .diff-label { color: #999; }
        .diff-old {
          display: block; margin: 0;
          background: #fef2f2; color: #991b1b;
          padding: 8px 10px; border-radius: 6px;
          font-family: 'SFMono-Regular', 'Menlo', monospace;
          font-size: 12px; line-height: 1.6;
          white-space: pre-wrap; word-break: break-all;
          border-left: 3px solid #fca5a5;
        }
        .diff-new {
          display: block; margin: 0;
          background: #f0fdf4; color: #166534;
          padding: 8px 10px; border-radius: 6px;
          font-family: 'SFMono-Regular', 'Menlo', monospace;
          font-size: 12px; line-height: 1.6;
          white-space: pre-wrap; word-break: break-all;
          border-left: 3px solid #86efac;
        }
        .tool-inputs { margin-bottom: 6px; }
        .tool-input-item { margin-bottom: 4px; }
        .tool-input-key {
          font-size: 11px; color: #999;
          text-transform: uppercase; letter-spacing: 0.3px;
          margin-right: 6px;
        }
        .tool-input-val {
          margin: 2px 0 0; font-size: 12px;
          font-family: 'SFMono-Regular', 'Menlo', monospace;
          color: #555; white-space: pre-wrap;
          word-break: break-all;
        }
        .tool-output { border-top: 1px solid #eee; padding-top: 8px; margin-top: 4px; }
        .tool-output-label {
          font-size: 11px; color: #999;
          text-transform: uppercase; letter-spacing: 0.3px;
          margin-bottom: 6px;
        }
        .tool-output-text {
          margin: 0; font-size: 12px;
          font-family: 'SFMono-Regular', 'Menlo', monospace;
          color: #555; white-space: pre-wrap;
          word-break: break-all;
          background: #fff; padding: 8px 10px;
          border-radius: 6px; border: 1px solid #eee;
          max-height: 300px; overflow-y: auto;
        }
        @media (max-width: 768px) {
          .tool-card-header { padding: 10px 12px; font-size: 14px; min-height: 44px; }
          .tool-card-file { max-width: 100px; }
        }
      `}</style>
    </div>
  )
})
