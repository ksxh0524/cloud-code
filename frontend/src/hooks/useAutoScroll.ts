import { useEffect, useRef, useCallback, useState } from 'react'

interface UseAutoScrollOptions {
  /** 依赖项，变化时触发滚动 */
  dependency: unknown
  /** 是否正在流式输出 */
  isStreaming?: boolean
  /** 滚动延迟（毫秒） */
  delay?: number
  /** 滚动行为 */
  behavior?: ScrollBehavior
  /**
   * 是否在流式输出时使用即时滚动
   * true: 流式时用 'auto'，否则用 'smooth'
   * false: 总是使用指定的 behavior
   */
  fastScrollOnStreaming?: boolean
}

/**
 * useAutoScroll Hook
 *
 * 自动滚动到底部的功能
 * 适用于聊天消息列表等需要自动滚动的场景
 *
 * @param options - 配置选项
 * @returns {
 *   scrollRef: 需要滚动到的元素的 ref
 *   scrollToBottom: 手动触发滚动到底部
 *   isNearBottom: 用户是否接近底部
 * }
 */
export function useAutoScroll(options: UseAutoScrollOptions) {
  const {
    dependency,
    isStreaming = false,
    delay = 100,
    behavior = 'smooth',
    fastScrollOnStreaming = true,
  } = options

  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)

  // 获取容器元素（滚动 ref 的父元素）
  useEffect(() => {
    if (scrollRef.current) {
      containerRef.current = scrollRef.current.parentElement
    }
  }, [])

  /**
   * 检查是否接近底部
   */
  const checkNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const threshold = 100 // 距离底部 100px 内视为接近底部
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    return distanceFromBottom < threshold
  }, [])

  /**
   * 滚动到底部
   */
  const scrollToBottom = useCallback((immediate = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    timerRef.current = setTimeout(() => {
      scrollRef.current?.scrollIntoView({
        behavior: immediate ? 'auto' : behavior,
      })
    }, delay)
  }, [delay, behavior])

  // 监听依赖变化自动滚动
  useEffect(() => {
    // 只有用户接近底部时才自动滚动
    if (checkNearBottom()) {
      const shouldUseFastScroll = fastScrollOnStreaming && isStreaming
      scrollToBottom(shouldUseFastScroll)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [dependency, isStreaming, scrollToBottom, fastScrollOnStreaming, checkNearBottom])

  // 监听滚动事件更新 isNearBottom
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsNearBottom(checkNearBottom())
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [checkNearBottom])

  return {
    scrollRef,
    scrollToBottom,
    isNearBottom,
  }
}
