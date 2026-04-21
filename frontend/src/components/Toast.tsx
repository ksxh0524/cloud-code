import { useState, useRef } from 'react'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

let toastIdCounter = 0

const listeners: Set<(toasts: ToastItem[]) => void> = new Set()
let currentToasts: ToastItem[] = []

function emitChange() {
  listeners.forEach(fn => fn([...currentToasts]))
}

function addToast(type: ToastItem['type'], message: string) {
  const id = `toast-${++toastIdCounter}`
  currentToasts = [...currentToasts, { id, type, message }]
  emitChange()
  setTimeout(() => {
    currentToasts = currentToasts.filter(t => t.id !== id)
    emitChange()
  }, 3000)
}

export const toast = {
  success: (msg: string) => addToast('success', msg),
  error: (msg: string) => addToast('error', msg),
  warning: (msg: string) => addToast('warning', msg),
  info: (msg: string) => addToast('info', msg),
}

const iconMap: Record<ToastItem['type'], string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
}

const colorMap: Record<ToastItem['type'], { bg: string; border: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a' },
  error: { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706' },
  info: { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb' },
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const fnRef = useRef<(t: ToastItem[]) => void>(undefined)
  if (!fnRef.current) {
    fnRef.current = (t: ToastItem[]) => setToasts(t)
    listeners.add(fnRef.current)
  }

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      top: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: 'min(90vw, 360px)',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const c = colorMap[t.type]
        return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              fontSize: 14,
              color: '#1a1a1a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              pointerEvents: 'auto',
              animation: 'toast-in 0.2s ease-out',
            }}
          >
            <span style={{ color: c.icon, fontWeight: 700, fontSize: 15 }}>{iconMap[t.type]}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
