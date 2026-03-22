/**
 * 飞书卡片 - 会话选择
 */

export interface Card {
  header?: CardHeader
  elements: CardElement[]
}

export interface CardHeader {
  title: TextContent
  template?: 'blue' | 'wathet' | 'turquoise' | 'green' | 'yellow' | 'orange' | 'red' | 'carmine' | 'violet' | 'purple' | 'indigo' | 'grey'
}

export interface CardElement {
  tag: 'div' | 'hr' | 'action' | 'button' | 'select_static' | 'markdown'
  text?: TextContent
  fields?: CardElement[]
  actions?: CardAction[]
  placeholder?: TextContent
  options?: SelectOption[]
  content?: string
}

export interface TextContent {
  tag: 'plain_text' | 'lark_md'
  content: string
}

export interface CardAction {
  tag: 'button' | 'select_static'
  text?: TextContent
  type?: 'primary' | 'default' | 'danger'
  url?: string
  value?: any
  placeholder?: TextContent
  options?: SelectOption[]
}

export interface SelectOption {
  text: TextContent
  value: string
}

/**
 * 创建会话选择卡片
 */
export function createSessionSelectCard(conversations: Array<{ id: string; name: string }>): Card {
  return {
    header: {
      title: { tag: 'plain_text', content: '选择会话' },
      template: 'blue'
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: '请选择要操作的会话，或创建新会话：' }
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '+ 新建会话' },
            type: 'primary',
            value: { action: 'create_session' }
          }
        ]
      },
      ...(conversations.length > 0 ? [{
        tag: 'hr' as const
      }, {
        tag: 'action' as const,
        actions: [
          {
            tag: 'select_static' as const,
            placeholder: { tag: 'plain_text', content: '选择现有会话' },
            options: conversations.map(c => ({
              text: { tag: 'plain_text', content: c.name },
              value: c.id
            })),
            value: { action: 'select_session' }
          }
        ]
      }] : [])
    ]
  }
}

/**
 * 创建新建会话卡片
 */
export function createNewSessionCard(): Card {
  return {
    header: {
      title: { tag: 'plain_text', content: '新建会话' },
      template: 'turquoise'
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'lark_md', content: '请输入会话信息：' }
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '输入名称' },
            type: 'default',
            value: { action: 'input_name' }
          }
        ]
      }
    ]
  }
}

/**
 * 创建消息展示卡片
 */
export function createMessageCard(content: string, toolCalls?: Array<{ name: string; status: string }>): Card {
  const elements: CardElement[] = [
    {
      tag: 'div',
      text: { tag: 'lark_md', content: `**Claude:**\n${content}` }
    }
  ]

  if (toolCalls && toolCalls.length > 0) {
    elements.push({ tag: 'hr' })
    elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: '**工具调用:**\n' + toolCalls.map(t => `- \`${t.name}\` ${t.status === 'completed' ? '✅' : t.status === 'running' ? '⏳' : '❌'}`).join('\n')
      }
    })
  }

  return { elements }
}

/**
 * 创建确认操作卡片
 */
export function createConfirmCard(prompt: string, actionType: string): Card {
  return {
    header: {
      title: { tag: 'plain_text', content: '确认操作' },
      template: 'orange'
    },
    elements: [
      {
        tag: 'div',
        text: { tag: 'plain_text', content: prompt }
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '确认' },
            type: 'primary',
            value: { action: actionType, confirmed: true }
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '取消' },
            type: 'default',
            value: { action: actionType, confirmed: false }
          }
        ]
      }
    ]
  }
}
