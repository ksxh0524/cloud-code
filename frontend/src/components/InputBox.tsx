import { useRef, useEffect } from 'react'

interface InputBoxProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onInterrupt?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
}

export default function InputBox({
  value,
  onChange,
  onSend,
  onInterrupt,
  isStreaming,
  disabled,
  placeholder = '发送消息...',
}: InputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, 44), 120)
      textarea.style.height = newHeight + 'px'
    }
  }, [value])

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend()
    }
  }

  const handleInterrupt = () => {
    onInterrupt?.()
  }

  return (
    <div className="input-box-container">
      <div className="input-box-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={isStreaming ? '生成中...' : placeholder}
          disabled={disabled || isStreaming}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          className="input-textarea"
          rows={1}
        />
        {isStreaming ? (
          <button onClick={handleInterrupt} className="send-button interrupt" title="中断生成">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className={`send-button ${value.trim() ? 'active' : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      <style>{`
        .input-box-container {
          width: 100%;
        }

        .input-box-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          background: #f7f7f8;
          border-radius: 12px;
          padding: 8px 12px;
          border: 1px solid #e5e5e5;
        }

        .input-textarea {
          flex: 1;
          min-height: 44px;
          max-height: 120px;
          padding: 10px 8px;
          border: none;
          background: transparent;
          font-size: 16px;
          font-family: inherit;
          color: #2e2e2e;
          outline: none;
          resize: none;
          overflow-y: auto;
          line-height: 1.5;
        }

        .input-textarea:disabled {
          color: #8e8ea0;
        }

        .send-button {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          border: none;
          background: #e5e5e5;
          color: #8e8ea0;
          cursor: not-allowed;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .send-button.active {
          background: #3b82f6;
          color: #fff;
          cursor: pointer;
        }

        .send-button.active:hover {
          background: #2563eb;
        }

        .send-button.interrupt {
          background: #ef4444;
          color: #fff;
          cursor: pointer;
          animation: pulse 2s infinite;
        }

        .send-button.interrupt:hover {
          background: #dc2626;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }

        @media (max-width: 768px) {
          .input-textarea {
            font-size: 16px;
          }

          .send-button {
            width: 44px;
            height: 44px;
          }
        }
      `}</style>
    </div>
  )
}
