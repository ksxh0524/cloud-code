import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppConfig } from '../../../shared/types'

export default function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    const res = await fetch('/api/config')
    const data = await res.json()
    setConfig(data)
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
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
        <p>加载中...</p>
      </div>
    </div>
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <Link to="/" className="back-link">← 返回</Link>
        <h1>设置</h1>
      </header>

      <main className="settings-content">
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
              placeholder="xxxxxxxxxxxx"
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

      <style>{`
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
        }

        .back-link:hover {
          color: #000;
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
          padding: 10px 12px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 14px;
          color: #2e2e2e;
          outline: none;
          transition: all 0.2s;
          background: #ffffff;
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
          padding: 10px 20px;
          background: #3b82f6;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .save-button:hover:not(:disabled) {
          background: #1a1a1a;
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .save-button.saved {
          background: #3b82f6;
        }

        @media (max-width: 768px) {
          .settings-content {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  )
}
