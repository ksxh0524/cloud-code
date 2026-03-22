import { useState, useRef, useEffect } from 'react'

interface InputBoxProps {
  onSend: (content: string) => void
  disabled?: boolean
}

export default function InputBox({ onSend, disabled }: InputBoxProps) {
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, 60), 200)
      textarea.style.height = newHeight + 'px'
    }
  }, [content])

  const handleSend = () => {
    if (content.trim() && !disabled) {
      onSend(content.trim())
      setContent('')
    }
  }

  return (
    <div style={{
      borderTop: '1px solid #e5e5e5',
      padding: '16px',
      background: '#fff'
    }}>
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end',
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="发送消息..."
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          style={{
            flex: 1,
            minHeight: '60px',
            maxHeight: '200px',
            padding: '12px 14px',
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            background: '#f7f7f8',
            fontSize: '16px',
            fontFamily: 'inherit',
            color: '#2e2e2e',
            outline: 'none',
            resize: 'none',
            overflowY: 'auto',
            lineHeight: '1.5'
          }}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || disabled}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            border: 'none',
            background: content.trim() ? '#3b82f6' : '#e5e5e5',
            color: content.trim() ? '#fff' : '#8e8ea0',
            cursor: content.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
