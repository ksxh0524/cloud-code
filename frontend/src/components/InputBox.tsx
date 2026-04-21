import { useRef, useEffect, useState } from 'react'
import { matchCommands, type SlashCommand } from '../lib/commands'
import styles from './InputBox.module.css'

interface InputBoxProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onInterrupt?: () => void
  isStreaming?: boolean
  disabled?: boolean
  placeholder?: string
}

export default function InputBox({ value, onChange, onSend, onInterrupt, isStreaming, disabled, placeholder = '发送消息...' }: InputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(Math.max(textarea.scrollHeight, 44), 120) + 'px'
    }
  }, [value])

  useEffect(() => {
    if (value.startsWith('/')) {
      const commands = matchCommands(value.split(/\s/)[0])
      if (commands.length > 0 && commands[0].name !== value.trim().toLowerCase()) {
        setFilteredCommands(commands)
        setCommandMenuOpen(true)
        setSelectedIndex(0)
      } else {
        setCommandMenuOpen(false)
      }
    } else {
      setCommandMenuOpen(false)
    }
  }, [value])

  const handleSend = () => {
    if (!value.trim() || disabled) return
    setCommandMenuOpen(false)
    onSend()
  }

  const selectCommand = (cmd: SlashCommand) => {
    onChange(cmd.name + ' ')
    setCommandMenuOpen(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (commandMenuOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filteredCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        selectCommand(filteredCommands[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setCommandMenuOpen(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.inputBoxContainer}>
      {commandMenuOpen && filteredCommands.length > 0 && (
        <div className={styles.commandMenu}>
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.name}
              className={`${styles.commandItem} ${i === selectedIndex ? styles.commandSelected : ''}`}
              onMouseDown={e => { e.preventDefault(); selectCommand(cmd) }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className={styles.commandName}>{cmd.name}</span>
              <span className={styles.commandDesc}>{cmd.description}</span>
            </button>
          ))}
        </div>
      )}
      <div className={styles.inputBoxWrapper}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={isStreaming ? '生成中...' : placeholder}
          disabled={disabled || isStreaming}
          onKeyDown={handleKeyDown}
          className={styles.inputTextarea}
          rows={1}
          style={{ WebkitAppearance: 'none', appearance: 'none' }}
        />
        {isStreaming ? (
          <button onClick={() => onInterrupt?.()} className={`${styles.sendButton} ${styles.interrupt}`} title="中断生成">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          </button>
        ) : (
          <button onClick={handleSend} disabled={!value.trim() || disabled} className={`${styles.sendButton} ${value.trim() ? styles.active : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
    </div>
  )
}
