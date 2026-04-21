interface ConnectionBannerProps {
  isConnected: boolean
}

export default function ConnectionBanner({ isConnected }: ConnectionBannerProps) {
  if (isConnected) return null

  return (
    <div className="connection-banner">
      <span className="connection-banner-dot" />
      <span>连接已断开，正在重连...</span>
      <style>{`
        .connection-banner {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 8px 16px;
          background: #fffbeb; border-bottom: 1px solid #fcd34d;
          font-size: 13px; color: #92400e;
          animation: toast-in 0.2s ease-out;
        }
        .connection-banner-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #d97706;
          animation: blink 1.5s infinite;
        }
      `}</style>
    </div>
  )
}
