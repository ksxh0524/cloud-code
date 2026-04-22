import { useState, useEffect } from 'react'
import styles from './Toast.module.css'

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

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener = (t: ToastItem[]) => setToasts(t)
    listeners.add(listener)
    
    return () => {
      listeners.delete(listener)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} role="alert">
          <span className={`${styles.icon} ${styles[t.type]}`}>{iconMap[t.type]}</span>
          <span className={styles.message}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
