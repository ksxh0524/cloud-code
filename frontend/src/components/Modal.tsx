import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {title && <div className="modal-header">{title}</div>}
        <div className="modal-body">{children}</div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        }

        .modal-content {
          background: #ffffff;
          border-radius: 12px;
          padding: 24px;
          min-width: 320px;
          max-width: 90vw;
          max-height: 85vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-header {
          font-size: 18px;
          font-weight: 600;
          color: #2e2e2e;
          margin-bottom: 16px;
          padding-right: 30px;
        }

        .modal-body {
          color: #2e2e2e;
        }

        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 20px;
          color: #8e8ea0;
          cursor: pointer;
          padding: 8px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          color: #2e2e2e;
        }

        .modal-close:active {
          opacity: 0.6;
        }

        @media (max-width: 768px) {
          .modal-content {
            min-width: auto;
            width: calc(100vw - 16px);
            max-width: calc(100vw - 16px);
            max-height: calc(100vh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
            padding: 16px 12px;
            margin: 8px;
            border-radius: 12px;
          }

          .modal-header {
            font-size: 16px;
            margin-bottom: 16px;
            padding-right: 40px;
          }
          
          .modal-overlay {
            padding: 0;
            align-items: center;
          }
        }
        
        @media (max-width: 480px) {
          .modal-content {
            width: calc(100vw - 16px);
            max-width: calc(100vw - 16px);
            max-height: 100vh;
            margin: 8px;
            border-radius: 12px;
            padding: 16px 12px calc(16px + env(safe-area-inset-bottom));
          }
          
          .modal-overlay {
            align-items: center;
          }
        }
      `}</style>
    </div>
  )
}