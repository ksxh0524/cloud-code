import { Message } from '../types'
import MessageItem from './MessageItem'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div className="message-list">
      {messages.map((message, i) => (
        <MessageItem
          key={message.id}
          message={message}
          isStreaming={isStreaming && i === messages.length - 1 && message.role === 'assistant' && message.type === 'text'}
        />
      ))}
      <style>{`
        .message-list {
          display: flex; flex-direction: column; gap: 12px;
          max-width: 100%; margin: 0 auto; width: 100%;
        }
      `}</style>
    </div>
  )
}
