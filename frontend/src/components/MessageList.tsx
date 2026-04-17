import { useRef, useEffect } from 'react'
import { Message } from '../types'
import MessageItem from './MessageItem'

interface MessageListProps {
  messages: Message[]
}

export default function MessageList({ messages }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 自动滚动到底部
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  return (
    <div ref={scrollRef} className="message-list">
      {messages.length === 0 ? (
        <div className="empty-messages">
          <p>开始新的对话...</p>
        </div>
      ) : (
        messages.map(message => <MessageItem key={message.id} message={message} />)
      )}

      <style>{`
        .message-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 100%;
          margin: 0 auto;
          width: 100%;
          overflow-y: auto;
          padding: 16px;
          padding-bottom: 100px;
        }

        .empty-messages {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #8e8ea0;
          font-size: 14px;
          padding: 40px 20px;
        }
      `}</style>
    </div>
  )
}
