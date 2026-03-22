import { Message } from '../../../shared/types'
import ToolCall from './ToolCall'

interface MessageItemProps {
  message: Message
}

export default function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`message-item ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-content">
        <div className="message-text">
          {message.content || <span className="typing">正在思考...</span>}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="message-tools">
            {message.toolCalls.map((tool, index) => (
              <ToolCall key={index} toolCall={tool} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        .message-item {
          display: flex;
          gap: 0;
        }

        .message-item.user {
          justify-content: flex-end;
        }

        .message-item.assistant {
          justify-content: flex-start;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 8px;
        }

        .message-item.user .message-content {
          background: #f7f7f8;
        }

        .message-item.assistant .message-content {
          background: transparent;
          padding-left: 0;
        }

        .message-text {
          font-size: 15px;
          line-height: 1.6;
          color: #2e2e2e;
          white-space: pre-wrap;
          word-break: break-word;
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
      `}</style>
    </div>
  )
}
