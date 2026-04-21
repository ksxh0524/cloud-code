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
          gap: 8px; padding: 10px 16px;
          background: #fef2f2; border-bottom: 1px solid #fecaca;
          font-size: 13px; color: #991b1b; font-weight: 500;
          animation: slide-down 0.2s ease-out;
        }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: translateY(0); } }
        .connection-banner-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #dc2626;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}
