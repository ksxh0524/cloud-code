import { Message } from '../types'
import MessageItem from './MessageItem'
import { MessageErrorBoundary } from './MessageErrorBoundary'
import styles from './MessageList.module.css'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  return (
    <div className={styles.messageList}>
      {messages.map((message, i) => (
        <MessageErrorBoundary key={message.id}>
          <MessageItem
            message={message}
            isStreaming={isStreaming && i === messages.length - 1 && message.role === 'assistant' && message.type === 'text'}
          />
        </MessageErrorBoundary>
      ))}
    </div>
  )
}
