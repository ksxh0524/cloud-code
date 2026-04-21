interface EmptyStateProps {
  hasConversation: boolean
  onNewConversation: () => void
}

export default function EmptyState({ hasConversation, onNewConversation }: EmptyStateProps) {
  if (hasConversation) {
    return (
      <div className="empty-chat">
        <div className="empty-chat-icon">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className="empty-chat-title">开始对话</h2>
        <p className="empty-chat-desc">输入消息开始使用 Cloud Code</p>
        <div className="empty-chat-suggestions">
          {['帮我阅读这个项目的代码结构', '找出代码中的 Bug 并修复', '帮我重构这个模块'].map(text => (
            <button key={text} className="suggestion-chip" onClick={() => {/* TODO: fill input */}}>
              {text}
            </button>
          ))}
        </div>
        <style>{`
          .empty-chat {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; height: 100%; padding: 40px 20px;
            text-align: center;
          }
          .empty-chat-icon { margin-bottom: 20px; }
          .empty-chat-title { font-size: 20px; font-weight: 600; color: #111; margin-bottom: 8px; }
          .empty-chat-desc { font-size: 15px; color: #999; margin-bottom: 24px; }
          .empty-chat-suggestions { display: flex; flex-direction: column; gap: 10px; max-width: 340px; width: 100%; }
          .suggestion-chip {
            padding: 12px 16px; background: #f7f7f8;
            border: 1px solid #e5e5e5; border-radius: 10px;
            font-size: 14px; color: #555; cursor: pointer;
            text-align: left; min-height: 44px;
            transition: all 0.15s; line-height: 1.4;
          }
          .suggestion-chip:hover { background: #f0f0f0; border-color: #ccc; }
          .suggestion-chip:active { background: #e8e8e8; }
          @media (max-width: 768px) {
            .empty-chat-suggestions { max-width: 100%; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="empty-welcome">
      <div className="welcome-logo">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#111" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="welcome-title">Cloud Code</h1>
      <p className="welcome-desc">移动端的 Claude Code 助手</p>
      <button onClick={onNewConversation} className="welcome-btn">+ 新建对话</button>
      <div className="welcome-features">
        <div className="welcome-feature">
          <span className="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </span>
          <span>对话交互 · 实时流式响应</span>
        </div>
        <div className="welcome-feature">
          <span className="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
          </span>
          <span>工具调用 · 可视化展示</span>
        </div>
        <div className="welcome-feature">
          <span className="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </span>
          <span>文件编辑 · Diff 对比</span>
        </div>
      </div>
      <style>{`
        .empty-welcome {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; padding: 40px 24px;
          text-align: center;
        }
        .welcome-logo { margin-bottom: 20px; }
        .welcome-title { font-size: 26px; font-weight: 700; color: #111; margin-bottom: 8px; letter-spacing: -0.5px; }
        .welcome-desc { font-size: 15px; color: #999; margin-bottom: 32px; }
        .welcome-btn {
          padding: 14px 36px; background: #111; color: #fff;
          border: none; border-radius: 12px; font-size: 16px;
          font-weight: 600; cursor: pointer; min-height: 50px;
          transition: all 0.2s; letter-spacing: 0.3px;
        }
        .welcome-btn:hover { background: #333; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .welcome-btn:active { transform: translateY(0); }
        .welcome-features {
          display: flex; flex-direction: column; gap: 10px;
          margin-top: 36px; max-width: 300px; width: 100%;
        }
        .welcome-feature {
          display: flex; align-items: center; gap: 12px;
          font-size: 14px; color: #666; padding: 12px 16px;
          background: #f7f7f8; border-radius: 10px;
          min-height: 46px; text-align: left;
          border: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .welcome-feature:hover { border-color: #e0e0e0; }
        .feature-icon { color: #888; display: flex; align-items: center; flex-shrink: 0; }
        @media (max-width: 768px) {
          .empty-welcome { padding: 32px 20px; }
          .welcome-features { max-width: 100%; }
          .welcome-title { font-size: 24px; }
        }
      `}</style>
    </div>
  )
}
