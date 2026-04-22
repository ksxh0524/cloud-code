import { Component, type ReactNode } from 'react'
import { logger } from '../lib/logger'
import styles from './MessageErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class MessageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Message render error', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return <div className={styles.errorFallback}>消息渲染失败</div>
    }
    return this.props.children
  }
}
