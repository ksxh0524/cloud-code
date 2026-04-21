import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppConfig } from '../types'
import { authFetch } from '../lib/fetch'
import { logger } from '../lib/logger'
import styles from './Settings.module.css'

export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    try {
      setError(null)
      const res = await authFetch('/api/config')
      if (!res.ok) throw new Error(`加载失败 (${res.status})`)
      setConfig(await res.json())
    } catch (err) {
      logger.error('Failed to load config', { error: String(err) })
      setError(err instanceof Error ? err.message : '加载配置失败')
    }
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await authFetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
      else throw new Error(`保存失败 (${res.status})`)
    } catch (err) {
      logger.error('Failed to save config', { error: String(err) })
      setError(err instanceof Error ? err.message : '保存失败')
    } finally { setSaving(false) }
  }

  return (
    <div className={styles.settingsPage}>
      <header className={styles.settingsHeader}>
        <Link to="/" className={styles.backLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          返回
        </Link>
        <h1>设置</h1>
      </header>
      <main className={styles.settingsContent}>
        {error && <div className={styles.settingsError}>{error}</div>}
        {config ? (
          <>
            <section className={styles.settingsSection}>
              <div className={styles.sectionTitle}>工作目录</div>
              <div className={styles.formGroup}>
                <label>默认工作目录</label>
                <input type="text" value={config.defaultWorkDir} onChange={(e) => setConfig({ ...config, defaultWorkDir: e.target.value })} placeholder="/Users/yourname/codes" />
                <small>创建新会话时默认使用的工作目录</small>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <div className={styles.sectionTitle}>关于</div>
              <div className={styles.aboutCard}>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>版本</span>
                  <span className={styles.aboutValue}>1.0.0</span>
                </div>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>项目</span>
                  <span className={styles.aboutValue}>Cloud Code</span>
                </div>
                <div className={styles.aboutRow}>
                  <span className={styles.aboutLabel}>引擎</span>
                  <span className={styles.aboutValue}>Claude Agent SDK</span>
                </div>
              </div>
            </section>

            <div className={styles.settingsActions}>
              <button className={`${styles.saveButton} ${saved ? styles.saved : ''}`} onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
              </button>
            </div>
          </>
        ) : !error ? <p>加载中...</p> : null}
      </main>
    </div>
  )
}
