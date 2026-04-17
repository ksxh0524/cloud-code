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

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

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
          align-items: flex-start;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
          padding-top: calc(16px + env(safe-area-inset-top));
          overflow-y: auto;
        }

        .modal-content {
          background: #ffffff;
          border-radius: 12px;
          padding: 24px;
          min-width: 320px;
          max-width: 90vw;
          max-height: calc(90vh - 32px - env(safe-area-inset-top));
          overflow-y: auto;
          position: relative;
          margin: auto 0;
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
          z-index: 1;
        }

        .modal-close:hover {
          color: #2e2e2e;
        }

        .modal-close:active {
          opacity: 0.6;
        }

        @media (max-width: 768px) {
          .modal-overlay {
            padding: 8px;
            padding-top: calc(8px + env(safe-area-inset-top));
            align-items: flex-start;
          }

          .modal-content {
            min-width: auto;
            width: 100%;
            max-width: 100%;
            max-height: calc(100vh - 16px - env(safe-area-inset-top));
            padding: 16px;
            margin: 0;
            border-radius: 12px;
          }

          .modal-header {
            font-size: 16px;
            margin-bottom: 12px;
            padding-right: 40px;
          }
        }
      `}</style>
    </div>
  )
}