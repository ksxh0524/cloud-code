import { StreamEvent } from '../../../shared/types.js'

/**
 * 解析 Claude Code CLI 的流式输出
 * 检测工具调用、消息内容等
 */
export class StreamParser {
  private buffer = ''

  parse(chunk: string): StreamEvent[] {
    this.buffer += chunk
    const events: StreamEvent[] = []

    // 检测工具调用开始
    const toolStartMatch = this.buffer.match(/Using tool: (\w+)/)
    if (toolStartMatch && !this.buffer.includes('TOOL_START')) {
      events.push({
        type: 'tool_start',
        toolName: toolStartMatch[1]
      })
      this.buffer = this.buffer.replace(/Using tool: \w+/, '[TOOL_START]')
    }

    // 检测工具调用结束
    if (this.buffer.includes('Tool completed')) {
      events.push({
        type: 'tool_end'
      })
      this.buffer = this.buffer.replace(/\[TOOL_START\][\s\S]*?Tool completed/, '[TOOL_END]')
    }

    // 提取文本内容（去除工具调用的部分）
    let textContent = this.buffer
      .replace(/\[TOOL_START\][\s\S]*?\[TOOL_END\]/g, '')
      .replace(/Using tool: \w+/g, '')
      .replace(/Tool completed/g, '')

    // 如果有新文本，发送文本事件
    if (textContent.trim() && textContent.trim() !== this.getLastText()) {
      events.push({
        type: 'text',
        content: textContent.trim()
      })
    }

    // 检测错误
    if (this.buffer.includes('Error:') || this.buffer.includes('error:')) {
      events.push({
        type: 'error',
        content: this.buffer
      })
    }

    // 清理 buffer
    this.buffer = textContent

    return events
  }

  private lastText = ''

  private getLastText(): string {
    return this.lastText
  }

  reset() {
    this.buffer = ''
    this.lastText = ''
  }
}

/**
 * ANSI 转义序列清理器
 * 移除终端颜色代码和控制字符
 */
export function cleanAnsi(text: string): string {
  return text
    // 移除 ANSI 颜色代码
    .replace(/\x1b\[[0-9;]*m/g, '')
    // 移除光标控制
    .replace(/\x1b\[[0-9]*[A-G]/g, '')
    // 移除其他控制字符
    .replace(/[\x00-\x1F\x7F]/g, '')
    // 清理多余空行
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * 检测工具调用的输入和输出
 */
export function parseToolCall(output: string): { input?: any; output?: string } {
  const result: { input?: any; output?: string } = {}

  // 尝试解析 JSON 输入
  const inputMatch = output.match(/Input: ({[\s\S]*?})\n/)
  if (inputMatch) {
    try {
      result.input = JSON.parse(inputMatch[1])
    } catch {
      // 忽略解析错误
    }
  }

  // 获取输出
  const outputMatch = output.match(/Output:([\s\S]*?)(?=\n\n|$)/)
  if (outputMatch) {
    result.output = outputMatch[1].trim()
  }

  return result
}
