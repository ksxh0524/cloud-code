import { Message } from '../types'
import ToolCall from './ToolCall'

interface MessageItemProps {
  message: Message
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isThinking = message.type === 'thinking'
  const isToolUse = message.type === 'tool_use'

  // 获取角色标签
  const getRoleLabel = () => {
    if (isUser) return 'You'
    if (isTool) return 'Tool'
    if (isThinking) return 'Thinking'
    if (isToolUse) return 'Action'
    return 'Assistant'
  }

  // 获取消息样式
  const getMessageStyle = () => {
    if (isUser) return 'user'
    if (isTool) return 'tool'
    if (isThinking) return 'thinking'
    if (isToolUse) return 'tool-use'
    return 'assistant'
  }

  return (
    <div className={`message-item ${getMessageStyle()}`}>
      <div className="message-header">
        <span className="role-label">{getRoleLabel()}</span>
      </div>
      <div className="message-content">
        <div className="message-text">{message.content || <span className="typing">...</span>}</div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="message-tools">
            {message.toolCalls.map((tool: any, index: number) => (
              <ToolCall key={index} toolCall={tool} />
            ))}
          </div>
        )}
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

        .message-item.user .message-text {
          color: white;
        }

        .typing {
          color: #8e8ea0;
          font-style: italic;
        }

        .message-tools {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
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
