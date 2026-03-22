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
          z-index: 1000;
        }

        .modal-content {
          background: #ffffff;
          border-radius: 12px;
          padding: 24px;
          min-width: 320px;
          max-width: 90vw;
          position: relative;
        }

        .modal-header {
          font-size: 18px;
          font-weight: 600;
          color: #2e2e2e;
          margin-bottom: 16px;
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
          padding: 4px;
        }

        .modal-close:hover {
          color: #2e2e2e;
        }
      `}</style>
    </div>
  )
}
