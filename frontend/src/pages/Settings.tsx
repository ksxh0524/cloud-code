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
        <Link to="/" className="back-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          返回
        </Link>
        <h1>设置</h1>
      </header>
      <main className="settings-content">
        {error && <div className="settings-error">{error}</div>}
        {config ? (
          <>
            <section className="settings-section">
              <div className="section-title">工作目录</div>
              <div className="form-group">
                <label>默认工作目录</label>
                <input type="text" value={config.defaultWorkDir} onChange={(e) => setConfig({ ...config, defaultWorkDir: e.target.value })} placeholder="/Users/yourname/codes" />
                <small>创建新会话时默认使用的工作目录</small>
              </div>
            </section>

            <section className="settings-section">
              <div className="section-title">关于</div>
              <div className="about-card">
                <div className="about-row">
                  <span className="about-label">版本</span>
                  <span className="about-value">1.0.0</span>
                </div>
                <div className="about-row">
                  <span className="about-label">项目</span>
                  <span className="about-value">Cloud Code</span>
                </div>
                <div className="about-row">
                  <span className="about-label">引擎</span>
                  <span className="about-value">Claude Agent SDK</span>
                </div>
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
        .settings-header { background: #fff; padding: 12px 16px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 12px; }
        .back-link { color: #666; text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 4px 8px; margin: -4px -8px; border-radius: 8px; transition: background 0.15s; }
        .back-link:hover { background: #f5f5f5; color: #111; }
        .settings-header h1 { font-size: 18px; font-weight: 600; color: #111; }
        .settings-content { max-width: 600px; margin: 0 auto; padding: 20px 20px; }
        .settings-error { padding: 12px 16px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 10px; font-size: 14px; margin-bottom: 16px; }
        .settings-section { margin-bottom: 24px; }
        .section-title { font-size: 12px; font-weight: 600; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-size: 14px; font-weight: 500; color: #111; margin-bottom: 8px; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #e5e5e5; border-radius: 10px; font-size: 16px; color: #111; outline: none; transition: all 0.2s; background: #f7f7f8; min-height: 48px; box-sizing: border-box; }
        .form-group input:focus { border-color: #999; box-shadow: 0 0 0 3px rgba(0,0,0,0.04); }
        .form-group input::placeholder { color: #999; }
        .form-group small { display: block; margin-top: 6px; font-size: 12px; color: #999; }
        .about-card { background: #f7f7f8; border-radius: 10px; border: 1px solid #f0f0f0; overflow: hidden; }
        .about-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; }
        .about-row:last-child { border-bottom: none; }
        .about-label { font-size: 14px; color: #666; }
        .about-value { font-size: 14px; color: #111; font-weight: 500; }
        .settings-actions { display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #f0f0f0; }
        .save-button { padding: 12px 28px; background: #111; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s; min-height: 48px; }
        .save-button:hover:not(:disabled) { background: #333; }
        .save-button:disabled { opacity: 0.4; cursor: not-allowed; }
        .save-button.saved { background: #16a34a; }
        @media (max-width: 768px) {
          .settings-content { padding: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom)); }
          .settings-header { padding-top: max(12px, env(safe-area-inset-top)); }
        }
      `}</style>
    </div>
  )
}
