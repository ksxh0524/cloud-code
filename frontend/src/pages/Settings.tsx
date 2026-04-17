import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppConfig } from '../types'
import { authFetch } from '../lib/fetch'

export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('api_key') || '')

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      setError(null)
      const res = await authFetch('/api/config')
      if (!res.ok) throw new Error(`加载失败 (${res.status})`)
      const data = await res.json()
      setConfig(data)
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
      const res = await authFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        throw new Error(`保存失败 (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return <div className="settings-page">
      <div className="settings-header">
        <Link to="/" className="back-link">← 返回</Link>
        <h1>设置</h1>
      </div>
      <div className="settings-content">
        {error ? (
          <div className="settings-error">
            <p>{error}</p>
            <button onClick={loadConfig}>重试</button>
          </div>
        ) : (
          <p>加载中...</p>
        )}
      </div>
      <style>{settingsStyles}</style>
    </div>
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/" className="back-link">← 返回</Link>
        <h1>设置</h1>
      </header>

      <main className="settings-content">
        {error && <div className="settings-error">{error}</div>}

        <section className="settings-section">
          <h2>API 认证</h2>
          <p className="section-desc">配置 API Key 用于访问后端服务（可选，服务端未设置 API_KEY 时可留空）</p>

          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                localStorage.setItem('api_key', e.target.value)
              }}
              placeholder="留空则不使用认证"
            />
            <small>与服务端 .env 中的 API_KEY 对应</small>
          </div>
        </section>

        <section className="settings-section">
          <h2>飞书配置</h2>
          <p className="section-desc">配置飞书机器人以在飞书中使用 Cloud Code（可选）</p>

          <div className="form-group">
            <label>App ID</label>
            <input
              type="text"
              value={config.feishu.appId}
              onChange={(e) => setConfig({
                ...config,
                feishu: { ...config.feishu, appId: e.target.value }
              })}
              placeholder="cli_xxxxxxxxx"
            />
            <small>飞书应用的 App ID</small>
          </div>

          <div className="form-group">
            <label>App Secret</label>
            <input
              type="password"
              value={config.feishu.appSecret}
              onChange={(e) => setConfig({
                ...config,
                feishu: { ...config.feishu, appSecret: e.target.value }
              })}
              placeholder="输入新的 Secret 以更新"
            />
            <small>飞书应用的 App Secret</small>
          </div>

          <details className="advanced-settings">
            <summary>高级设置（通常不需要配置）</summary>
            <div className="form-group">
              <label>Verify Token（可选）</label>
              <input
                type="text"
                value={config.feishu.verifyToken}
                onChange={(e) => setConfig({
                  ...config,
                  feishu: { ...config.feishu, verifyToken: e.target.value }
                })}
                placeholder="验证令牌"
              />
              <small>用于验证飞书请求，非必须</small>
            </div>

            <div className="form-group">
              <label>Encrypt Key（可选）</label>
              <input
                type="password"
                value={config.feishu.encryptKey}
                onChange={(e) => setConfig({
                  ...config,
                  feishu: { ...config.feishu, encryptKey: e.target.value }
                })}
                placeholder="加密密钥"
              />
              <small>用于加密飞书消息，非必须</small>
            </div>
          </details>
        </section>

        <section className="settings-section">
          <h2>其他设置</h2>

          <div className="form-group">
            <label>默认工作目录</label>
            <input
              type="text"
              value={config.defaultWorkDir}
              onChange={(e) => setConfig({
                ...config,
                defaultWorkDir: e.target.value
              })}
              placeholder="/Users/yourname/codes"
            />
            <small>创建新会话时默认使用的工作目录</small>
          </div>
        </section>

        <div className="settings-actions">
          <button
            className={`save-button ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </main>

      <style>{settingsStyles}</style>
    </div>
  )
}

const settingsStyles = `
  .settings-page {
    min-height: 100vh;
    background: #ffffff;
  }

  .settings-header {
    background: #ffffff;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e5e5;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .back-link {
    color: #675676;
    text-decoration: none;
    font-size: 14px;
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 8px;
    margin: -8px;
  }

  .back-link:hover {
    color: #000;
  }

  .back-link:active {
    opacity: 0.6;
  }

  .settings-header h1 {
    font-size: 18px;
    font-weight: 600;
    color: #000;
  }

  .settings-content {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px 20px;
  }

  .settings-error {
    padding: 12px 16px;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .settings-section {
    background: #ffffff;
    padding: 24px 0;
    margin-bottom: 16px;
  }

  .settings-section h2 {
    font-size: 16px;
    font-weight: 600;
    color: #000;
    margin-bottom: 4px;
  }

  .section-desc {
    color: #8e8ea0;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #2e2e2e;
    margin-bottom: 8px;
  }

  .form-group input {
    width: 100%;
    padding: 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    font-size: 16px;
    color: #2e2e2e;
    outline: none;
    transition: all 0.2s;
    background: #ffffff;
    min-height: 48px;
    box-sizing: border-box;
  }

  .form-group input:focus {
    border-color: #2e2e2e;
  }

  .form-group input::placeholder {
    color: #c7c7c8;
  }

  .form-group small {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #8e8ea0;
  }

  .advanced-settings {
    margin-top: 16px;
    padding: 16px;
    background: #f7f7f8;
    border-radius: 8px;
  }

  .advanced-settings summary {
    cursor: pointer;
    font-size: 13px;
    color: #675676;
    font-weight: 500;
    user-select: none;
  }

  .advanced-settings[open] summary {
    margin-bottom: 16px;
  }

  .advanced-settings .form-group {
    margin-bottom: 16px;
  }

  .settings-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid #e5e5e5;
  }

  .save-button {
    padding: 12px 24px;
    background: #3b82f6;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    min-height: 48px;
  }

  .save-button:hover:not(:disabled) {
    background: #2563eb;
  }

  .save-button:active:not(:disabled) {
    background: #1d4ed8;
  }

  .save-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .save-button.saved {
    background: #10b981;
  }

  @media (max-width: 768px) {
    .settings-content {
      padding: 16px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }

    .settings-header {
      padding-top: max(16px, env(safe-area-inset-top));
    }

    .form-group input {
      font-size: 16px;
    }
  }
`
