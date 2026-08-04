import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { listMessages, type ChatSummary, type Message } from '../api'
import { getSocket } from '../socket'

// Show a message's time like "14:32".
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatWindow({
  chat,
  currentUserId,
  onlineIds,
  onOpenDetails,
}: {
  chat: ChatSummary | null
  currentUserId: number
  onlineIds: Set<number>
  onOpenDetails: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  // Who is currently typing in this chat: { userId: username }
  const [typing, setTyping] = useState<Record<number, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)

  // Timers/flags for typing indicators.
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const amTypingRef = useRef(false)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load history when the chat changes; also reset my own "typing" flag.
  useEffect(() => {
    amTypingRef.current = false
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (!chat) {
      setMessages([])
      return
    }
    listMessages(chat.id).then((data) => setMessages(data.messages))
  }, [chat?.id])

  // Listen for live messages for the open chat.
  useEffect(() => {
    if (!chat) return
    const chatId = chat.id
    const socket = getSocket()
    function onNew({ message }: { message: Message }) {
      if (message.chatId === chatId) setMessages((prev) => [...prev, message])
    }
    socket.on('message:new', onNew)
    return () => {
      socket.off('message:new', onNew)
    }
  }, [chat?.id])

  // Listen for "X is typing" updates for the open chat.
  useEffect(() => {
    if (!chat) return
    const chatId = chat.id
    const socket = getSocket()
    const timers = typingTimers.current

    function onTyping(p: {
      chatId: number
      userId: number
      username: string
      isTyping: boolean
    }) {
      if (p.chatId !== chatId) return
      if (timers[p.userId]) clearTimeout(timers[p.userId])
      if (p.isTyping) {
        setTyping((prev) => ({ ...prev, [p.userId]: p.username }))
        // Safety net: drop them after a few seconds if no "stop" arrives.
        timers[p.userId] = setTimeout(() => {
          setTyping((prev) => {
            const next = { ...prev }
            delete next[p.userId]
            return next
          })
          delete timers[p.userId]
        }, 4000)
      } else {
        setTyping((prev) => {
          const next = { ...prev }
          delete next[p.userId]
          return next
        })
      }
    }

    socket.on('typing:update', onTyping)
    return () => {
      socket.off('typing:update', onTyping)
      Object.values(timers).forEach(clearTimeout)
      for (const key of Object.keys(timers)) delete timers[Number(key)]
      setTyping({})
    }
  }, [chat?.id])

  // Auto-scroll to the newest message (or when the typing line appears).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // As I type, tell the server (once), then send a "stop" shortly after I pause.
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setText(e.target.value)
    if (!chat) return
    const socket = getSocket()
    if (!amTypingRef.current) {
      amTypingRef.current = true
      socket.emit('typing:start', { chatId: chat.id })
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    stopTimerRef.current = setTimeout(() => {
      amTypingRef.current = false
      socket.emit('typing:stop', { chatId: chat.id })
    }, 1500)
  }

  function handleSend(e: FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content || !chat) return
    setText('')
    const socket = getSocket()
    socket.emit('message:send', { chatId: chat.id, content })
    // I've sent, so I'm no longer typing.
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    if (amTypingRef.current) {
      amTypingRef.current = false
      socket.emit('typing:stop', { chatId: chat.id })
    }
  }

  if (!chat) {
    return (
      <main className="chat-window empty">
        <p>Pick a chat on the left, or start a new one.</p>
      </main>
    )
  }

  // For a 1:1 chat, is the other person online?
  const other =
    chat.type === 'direct' ? chat.members.find((m) => m.id !== currentUserId) : undefined
  const otherOnline = other ? onlineIds.has(other.id) : false

  const typingNames = Object.values(typing)

  return (
    <main className="chat-window">
      <header className="chat-window-header">
        <button className="chat-title" onClick={onOpenDetails}>
          <span className="chat-title-main">
            {chat.type === 'group' ? '👥 ' : ''}
            {chat.name}
            {chat.type === 'direct' && (
              <span className={`presence-label ${otherOnline ? 'online' : ''}`}>
                {otherOnline ? 'online' : 'offline'}
              </span>
            )}
          </span>
          <span className="details-hint">details</span>
        </button>
      </header>

      <div className="messages">
        {messages.map((m) => {
          const mine = m.sender.id === currentUserId
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
              <div className="bubble">
                {chat.type === 'group' && !mine && (
                  <div className="sender">{m.sender.username}</div>
                )}
                <span className="msg-text">{m.content}</span>
                <span className="msg-time">{formatTime(m.createdAt)}</span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <div className="typing-indicator">
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : `${typingNames.join(', ')} are typing…`}
        </div>
      )}

      <form className="composer" onSubmit={handleSend}>
        <input placeholder="Write a message…" value={text} onChange={handleChange} />
        <button type="submit">Send</button>
      </form>
    </main>
  )
}
