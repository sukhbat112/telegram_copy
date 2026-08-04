import type { ChatSummary, User } from '../api'

// The left column: who I am, a "new chat" button, and my list of chats.
export function Sidebar({
  me,
  chats,
  selectedId,
  onlineIds,
  onSelect,
  onNewChat,
  onLogout,
}: {
  me: User
  chats: ChatSummary[]
  selectedId: number | null
  onlineIds: Set<number>
  onSelect: (id: number) => void
  onNewChat: () => void
  onLogout: () => void
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="app-name">✈️ Mini Telegram</div>
          <div className="me">@{me.username}</div>
        </div>
        <button className="logout" onClick={onLogout}>
          Log out
        </button>
      </div>

      <button className="new-chat" onClick={onNewChat}>
        + New chat
      </button>

      <div className="chat-list">
        {chats.length === 0 && <p className="empty-hint">No chats yet. Start one!</p>}

        {chats.map((chat) => {
          // For a 1:1 chat, work out whether the other person is online.
          const other =
            chat.type === 'direct' ? chat.members.find((m) => m.id !== me.id) : undefined
          const online = other ? onlineIds.has(other.id) : false

          return (
            <button
              key={chat.id}
              className={`chat-item ${chat.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(chat.id)}
            >
              <div className="chat-avatar">
                {chat.type === 'group' ? '👥' : chat.name[0]?.toUpperCase()}
                {/* Green dot when the other person is online */}
                {online && <span className="online-dot" />}
              </div>
              <div className="chat-item-text">
                <div className="chat-item-name">{chat.name}</div>
                <div className="chat-item-preview">
                  {chat.lastMessage ? chat.lastMessage.content : 'No messages yet'}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
