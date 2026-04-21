import styles from './EmptyState.module.css'

interface EmptyStateProps {
  hasConversation: boolean
  onNewConversation: () => void
}

export default function EmptyState({ hasConversation, onNewConversation }: EmptyStateProps) {
  if (hasConversation) {
    return (
      <div className={styles.emptyChat}>
        <div className={styles.emptyChatIcon}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2 className={styles.emptyChatTitle}>开始对话</h2>
        <p className={styles.emptyChatDesc}>输入消息开始使用 Cloud Code</p>
        <div className={styles.emptyChatSuggestions}>
          {['帮我阅读这个项目的代码结构', '找出代码中的 Bug 并修复', '帮我重构这个模块'].map(text => (
            <button key={text} className={styles.suggestionChip} onClick={() => {/* TODO: fill input */}}>
              {text}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.emptyWelcome}>
      <div className={styles.welcomeLogo}>
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#111" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className={styles.welcomeTitle}>Cloud Code</h1>
      <p className={styles.welcomeDesc}>移动端的 Claude Code 助手</p>
      <button onClick={onNewConversation} className={styles.welcomeBtn}>+ 新建对话</button>
      <div className={styles.welcomeFeatures}>
        <div className={styles.welcomeFeature}>
          <span className={styles.featureIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </span>
          <span>对话交互 · 实时流式响应</span>
        </div>
        <div className={styles.welcomeFeature}>
          <span className={styles.featureIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
          </span>
          <span>工具调用 · 可视化展示</span>
        </div>
        <div className={styles.welcomeFeature}>
          <span className={styles.featureIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </span>
          <span>文件编辑 · Diff 对比</span>
        </div>
      </div>
    </div>
  )
}
