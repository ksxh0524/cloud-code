import { useState } from 'react'
import { ToolCall as ToolCallType } from '../types'
import CodeBlock from './CodeBlock'

interface ToolCallProps {
  toolCall: ToolCallType
}

export default function ToolCall({ toolCall }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false)
  const isSuccess = toolCall.status === 'completed'
  const isRunning = toolCall.status === 'running'

  return (
    <div className={`tool-call ${toolCall.status}`}>
      <button className="tool-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-icon">{isRunning ? '⏳' : isSuccess ? '✓' : '✕'}</span>
        <span className="tool-name">{toolCall.name}</span>
        <span className="tool-status">{isRunning ? '运行中...' : isSuccess ? '已完成' : '失败'}</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="tool-details">
          {toolCall.input && <div className="tool-section"><div className="tool-section-title">输入</div><CodeBlock code={JSON.stringify(toolCall.input, null, 2)} language="json" /></div>}
          {toolCall.output && <div className="tool-section"><div className="tool-section-title">输出</div><CodeBlock code={typeof toolCall.output === 'string' ? toolCall.output : JSON.stringify(toolCall.output, null, 2)} language="text" /></div>}
        </div>
      )}
      <style>{`
        .tool-call { border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; background: #f7f7f8; margin-top: 8px; }
        .tool-call.error { border-color: #ccc; }
        .tool-header { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f7f7f8; border: none; border-bottom: 1px solid #e5e5e5; cursor: pointer; transition: background 0.2s; font-size: 13px; color: #111; }
        .tool-header:hover { background: #f0f0f0; }
        .tool-icon { font-size: 14px; }
        .tool-name { flex: 1; font-size: 13px; font-weight: 500; color: #111; text-align: left; }
        .tool-status { font-size: 12px; color: #666; }
        .expand-icon { font-size: 10px; color: #666; }
        .tool-details { padding: 12px; }
        .tool-section { margin-bottom: 12px; }
        .tool-section:last-child { margin-bottom: 0; }
        .tool-section-title { font-size: 12px; font-weight: 500; color: #666; margin-bottom: 8px; }
      `}</style>
    </div>
  )
}
