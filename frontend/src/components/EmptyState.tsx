interface EmptyStateProps {
  hasConversation: boolean
  onNewConversation: () => void
}

export default function EmptyState({ hasConversation, onNewConversation }: EmptyStateProps) {
  if (hasConversation) {
    return (
      <div className="empty-chat">
        <div className="empty-chat-icon">💬</div>
        <h2 className="empty-chat-title">开始对话</h2>
        <p className="empty-chat-desc">输入消息开始使用 Claude Code</p>
        <div className="empty-chat-hints">
          <div className="empty-hint">让 Claude 帮你阅读代码、修复 Bug、重构项目</div>
        </div>
        <style>{`
          .empty-chat {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; height: 100%; padding: 40px 20px;
            text-align: center;
          }
          .empty-chat-icon { font-size: 40px; margin-bottom: 16px; }
          .empty-chat-title { font-size: 20px; font-weight: 600; color: #111; margin-bottom: 8px; }
          .empty-chat-desc { font-size: 14px; color: #999; margin-bottom: 20px; }
          .empty-chat-hints { display: flex; flex-direction: column; gap: 8px; max-width: 300px; }
          .empty-hint {
            padding: 10px 14px; background: #f7f7f8;
            border-radius: 8px; font-size: 13px; color: #666;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="empty-welcome">
      <div className="welcome-logo">⚡</div>
      <h1 className="welcome-title">Cloud Code</h1>
      <p className="welcome-desc">移动端的 Claude Code 助手</p>
      <button onClick={onNewConversation} className="welcome-btn">+ 新建对话</button>
      <div className="welcome-features">
        <div className="welcome-feature">对话交互 · 实时流式响应</div>
        <div className="welcome-feature">工具调用 · 可视化展示</div>
        <div className="welcome-feature">文件编辑 · Diff 对比</div>
      </div>
      <style>{`
        .empty-welcome {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; padding: 40px 20px;
          text-align: center;
        }
        .welcome-logo { font-size: 48px; margin-bottom: 16px; }
        .welcome-title { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px; }
        .welcome-desc { font-size: 15px; color: #999; margin-bottom: 32px; }
        .welcome-btn {
          padding: 14px 32px; background: #111; color: #fff;
          border: none; border-radius: 10px; font-size: 16px;
          font-weight: 500; cursor: pointer; min-height: 48px;
          transition: background 0.2s;
        }
        .welcome-btn:hover { background: #333; }
        .welcome-features {
          display: flex; flex-direction: column; gap: 8px;
          margin-top: 32px; max-width: 280px;
        }
        .welcome-feature {
          font-size: 13px; color: #aaa; padding: 8px 12px;
          background: #f9f9f9; border-radius: 6px;
        }
      `}</style>
    </div>
  )
}
