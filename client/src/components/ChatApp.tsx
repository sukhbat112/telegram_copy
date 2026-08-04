import { useState, useEffect } from 'react'
import './chat.css'
import { listChats, type ChatSummary, type User } from '../api'
import { getSocket } from '../socket'
import { Sidebar } from './Sidebar'
import { ChatWindow } from './ChatWindow'
import { NewChatDialog } from './NewChatDialog'
import { ChatDetails } from './ChatDetails'

// The whole logged-in experience: a sidebar of chats + the open conversation.
export function ChatApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  // The set of user ids who are currently online.
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    refreshChats()
  }, [])

  async function refreshChats() {
    const data = await listChats()
    setChats(data.chats)
  }

  // Refresh the sidebar when the server says something changed.
  useEffect(() => {
    const socket = getSocket()
    const refresh = () => refreshChats()
    socket.on('message:new', refresh)
    socket.on('chats:changed', refresh)
    return () => {
      socket.off('message:new', refresh)
      socket.off('chats:changed', refresh)
    }
  }, [])

  // Track who's online. The server sends the full list once on connect
  // ('presence:list') and a small update whenever someone comes/goes.
  useEffect(() => {
    const socket = getSocket()
    function onList({ online }: { online: number[] }) {
      setOnlineIds(new Set(online))
    }
    function onUpdate({ userId, online }: { userId: number; online: boolean }) {
      setOnlineIds((prev) => {
        const next = new Set(prev)
        if (online) next.add(userId)
        else next.delete(userId)
        return next
      })
    }
    socket.on('presence:list', onList)
    socket.on('presence:update', onUpdate)
    return () => {
      socket.off('presence:list', onList)
      socket.off('presence:update', onUpdate)
    }
  }, [])

  function handleCreated(chat: ChatSummary) {
    setShowNewChat(false)
    setSelectedId(chat.id)
    refreshChats()
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null

  return (
    <div className="chat-app">
      <Sidebar
        me={user}
        chats={chats}
        selectedId={selectedId}
        onlineIds={onlineIds}
        onSelect={setSelectedId}
        onNewChat={() => setShowNewChat(true)}
        onLogout={onLogout}
      />

      <ChatWindow
        chat={selectedChat}
        currentUserId={user.id}
        onlineIds={onlineIds}
        onOpenDetails={() => setShowDetails(true)}
      />

      {showNewChat && (
        <NewChatDialog onCreated={handleCreated} onCancel={() => setShowNewChat(false)} />
      )}

      {showDetails && selectedChat && (
        <ChatDetails
          chat={selectedChat}
          currentUserId={user.id}
          onClose={() => setShowDetails(false)}
          onChanged={refreshChats}
          onLeft={() => {
            setShowDetails(false)
            setSelectedId(null)
            refreshChats()
          }}
        />
      )}
    </div>
  )
}
