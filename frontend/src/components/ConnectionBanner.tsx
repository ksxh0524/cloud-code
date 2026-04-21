import styles from './ConnectionBanner.module.css'

interface ConnectionBannerProps {
  isConnected: boolean
  hasConnected: boolean
}

export default function ConnectionBanner({ isConnected, hasConnected }: ConnectionBannerProps) {
  // 只在曾经连接过之后又断开时才显示，避免初始连接阶段闪烁
  if (isConnected || !hasConnected) return null

  return (
    <div className={styles.banner}>
      <span className={styles.dot} />
      <span>连接已断开，正在重连...</span>
    </div>
  )
}
