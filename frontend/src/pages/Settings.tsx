import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppConfig } from '../types'
import { authFetch } from '../lib/fetch'

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
      setError(err instanceof Error ? err.message : '保存失败')
    } finally { setSaving(false) }
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/" className="back-link">← 返回</Link>
        <h1>设置</h1>
      </header>
      <main className="settings-content">
        {error && <div className="settings-error">{error}</div>}
        {config ? (
          <>
            <section className="settings-section">
              <div className="form-group">
                <label>默认工作目录</label>
                <input type="text" value={config.defaultWorkDir} onChange={(e) => setConfig({ ...config, defaultWorkDir: e.target.value })} placeholder="/Users/yourname/codes" />
                <small>创建新会话时默认使用的工作目录</small>
              </div>
            </section>
            <div className="settings-actions">
              <button className={`save-button ${saved ? 'saved' : ''}`} onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
              </button>
            </div>
          </>
        ) : !error ? <p>加载中...</p> : null}
      </main>
      <style>{`
        .settings-page { min-height: 100vh; background: #fff; }
        .settings-header { background: #f7f7f8; padding: 16px 20px; border-bottom: 1px solid #e5e5e5; display: flex; align-items: center; gap: 16px; }
        .back-link { color: #666; text-decoration: none; font-size: 14px; display: flex; align-items: center; min-height: 44px; padding: 8px; margin: -8px; }
        .back-link:hover { color: #111; }
        .settings-header h1 { font-size: 18px; font-weight: 600; color: #111; }
        .settings-content { max-width: 600px; margin: 0 auto; padding: 24px 20px; }
        .settings-error { padding: 12px 16px; background: #f7f7f8; color: #111; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
        .settings-section { padding: 24px 0; margin-bottom: 16px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-size: 14px; font-weight: 500; color: #111; margin-bottom: 8px; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 16px; color: #111; outline: none; transition: border-color 0.2s; background: #f7f7f8; min-height: 48px; box-sizing: border-box; }
        .form-group input:focus { border-color: #999; }
        .form-group input::placeholder { color: #999; }
        .form-group small { display: block; margin-top: 4px; font-size: 12px; color: #666; }
        .settings-actions { display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #e5e5e5; }
        .save-button { padding: 12px 24px; background: #111; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s; min-height: 48px; }
        .save-button:hover:not(:disabled) { background: #333; }
        .save-button:disabled { opacity: 0.4; cursor: not-allowed; }
        .save-button.saved { background: #333; }
        @media (max-width: 768px) {
          .settings-content { padding: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom)); }
          .settings-header { padding-top: max(16px, env(safe-area-inset-top)); }
        }
      `}</style>
    </div>
  )
}
