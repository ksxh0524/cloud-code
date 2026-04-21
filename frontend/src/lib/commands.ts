export interface SlashCommand {
  name: string
  description: string
  usage?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/clear', description: '清空当前对话消息' },
  { name: '/compact', description: '压缩对话历史以节省 token' },
  { name: '/help', description: '显示可用命令列表' },
  { name: '/model', description: '查看当前模型信息' },
  { name: '/cost', description: '查看本次会话的 token 使用量' },
  { name: '/status', description: '查看连接和会话状态' },
]

export function parseSlashCommand(input: string): { command: string; args: string } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const parts = trimmed.split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1).join(' ')
  return { command, args }
}

export function isKnownCommand(command: string): boolean {
  return SLASH_COMMANDS.some(c => c.name === command)
}

export function matchCommands(partial: string): SlashCommand[] {
  if (!partial.startsWith('/')) return []
  const lower = partial.toLowerCase()
  return SLASH_COMMANDS.filter(c => c.name.startsWith(lower))
}
