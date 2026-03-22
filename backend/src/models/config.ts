import getDb, { saveDb } from '../db/index.js'
import { AppConfig } from '../../../shared/types.js'

const DEFAULT_CONFIG: AppConfig = {
  feishu: {
    appId: '',
    appSecret: '',
    verifyToken: '',
    encryptKey: ''
  },
  defaultWorkDir: process.cwd()
}

export function getConfig(): AppConfig {
  const db = getDb()
  const results = db.exec('SELECT * FROM config')

  const config = { ...DEFAULT_CONFIG }

  if (results.length > 0) {
    const columns = results[0].columns
    results[0].values.forEach(values => {
      const row: any = {}
      columns.forEach((col, i) => {
        row[col] = values[i]
      })

      const keys = row.key.split('.')
      let current: any = config
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {}
        current = current[keys[i]]
      }
      try {
        current[keys[keys.length - 1]] = JSON.parse(row.value)
      } catch {
        current[keys[keys.length - 1]] = row.value
      }
    })
  }

  return config
}

export function setConfig(key: string, value: any): void {
  const db = getDb()
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
  db.run(`INSERT OR REPLACE INTO config (key, value) VALUES ('${key}', '${valueStr.replace(/'/g, "''")}')`)
  saveDb()
}

export function updateFeishuConfig(config: Partial<AppConfig['feishu']>): void {
  if (config.appId !== undefined) setConfig('feishu.appId', config.appId)
  if (config.appSecret !== undefined) setConfig('feishu.appSecret', config.appSecret)
  if (config.verifyToken !== undefined) setConfig('feishu.verifyToken', config.verifyToken)
  if (config.encryptKey !== undefined) setConfig('feishu.encryptKey', config.encryptKey)
}
