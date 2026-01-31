import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { Task, WorkerLogMessage } from '../types'
import clsx from 'clsx'

interface LogModalProps {
  task: Task
  onClose: () => void
}

export function LogModal({ task, onClose }: LogModalProps) {
  // Parse logs from task.logs JSON string
  const messages = useMemo((): WorkerLogMessage[] => {
    if (!task.logs) return []
    try {
      return JSON.parse(task.logs)
    } catch {
      return []
    }
  }, [task.logs])

  const isDone = task.status === 'done'
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [autoFollow, setAutoFollow] = useState(true)
  const prevMessagesLengthRef = useRef(messages.length)
  const isAutoScrollingRef = useRef(false)

  // Scroll to bottom on initial mount when messages exist
  useEffect(() => {
    if (messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM is rendered before scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when new messages arrive (if autoFollow is enabled)
  useEffect(() => {
    if (autoFollow && messages.length > prevMessagesLengthRef.current) {
      // Set flag to prevent handleScroll from disabling autoFollow during programmatic scroll
      isAutoScrollingRef.current = true
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      // Clear the flag after scroll animation completes
      setTimeout(() => {
        isAutoScrollingRef.current = false
      }, 500)
    }
    prevMessagesLengthRef.current = messages.length
  }, [messages, autoFollow])

  // Detect user scrolling up to disable autoFollow
  const handleScroll = useCallback(() => {
    // Ignore scroll events triggered by programmatic auto-scrolling
    if (isAutoScrollingRef.current) return

    const container = messagesContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    // If user manually scrolled up (not at bottom), disable auto-follow
    if (!isAtBottom && autoFollow) {
      setAutoFollow(false)
    }
  }, [autoFollow])

  // Handle auto-follow checkbox change - scroll to bottom when re-enabling
  const handleAutoFollowChange = useCallback((checked: boolean) => {
    setAutoFollow(checked)
    if (checked) {
      // Scroll to bottom immediately when re-enabling auto-follow
      isAutoScrollingRef.current = true
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => {
        isAutoScrollingRef.current = false
      }, 500)
    }
  }, [])

  // Handle ESC key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose()
    }
  }

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4"
    >
      <div className="bg-slate-800 sm:rounded-xl shadow-2xl w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[80vh] flex flex-col border-0 sm:border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div
              className={clsx(
                'w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full flex-shrink-0',
                isDone ? 'bg-green-500' : 'bg-green-500 animate-pulse'
              )}
            />
            <h2 className="text-base sm:text-lg font-semibold text-slate-100 truncate">
              {task.title}
            </h2>
            <span className="text-xs sm:text-sm text-slate-400 flex-shrink-0 hidden sm:inline">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 flex-shrink-0 cursor-pointer"
            title="Close (ESC)"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4"
        >
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm sm:text-base">
              {isDone
                ? 'No messages logged.'
                : 'No messages yet. Waiting for worker activity...'}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={clsx(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[90%] sm:max-w-[85%] rounded-lg px-3 sm:px-4 py-2 sm:py-3',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-100'
                  )}
                >
                  <div className="text-xs text-opacity-70 mb-1 font-medium">
                    {msg.role === 'user' ? 'User' : 'Assistant'}
                  </div>
                  <div className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {truncateMessage(msg.content)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2 sm:py-3 border-t border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoFollow}
              onChange={(e) => handleAutoFollowChange(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-slate-400">Auto-scroll</span>
          </label>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Press ESC or click outside to close
          </span>
        </div>
      </div>
    </div>
  )
}

// Truncate very long messages for readability
function truncateMessage(content: string, maxLength = 2000): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '\n\n... [truncated]'
}
