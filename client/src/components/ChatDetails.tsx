import { useState, useEffect } from 'react'
import { listUsers, addMembers, leaveChat, type ChatSummary, type User } from '../api'

// A popup showing who's in a chat. For groups, you can also add people or leave.
export function ChatDetails({
  chat,
  currentUserId,
  onClose,
  onChanged,
  onLeft,
}: {
  chat: ChatSummary
  currentUserId: number
  onClose: () => void
  onChanged: () => void // refresh the chat list after a change
  onLeft: () => void // called after we leave (so the app can deselect it)
}) {
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [toAdd, setToAdd] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // For groups, load the full user list so we can offer people to add.
  useEffect(() => {
    if (chat.type === 'group') {
      listUsers().then((data) => setAllUsers(data.users))
    }
  }, [chat.id])

  // Who can we add? Everyone who isn't already a member.
  const memberIds = new Set(chat.members.map((m) => m.id))
  const addable = allUsers.filter((u) => !memberIds.has(u.id))

  function toggle(id: number) {
    setToAdd((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleAdd() {
    if (toAdd.length === 0) return
    setBusy(true)
    setError('')
    try {
      await addMembers(chat.id, toAdd)
      setToAdd([])
      onChanged() // pull the fresh member list
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLeave() {
    setBusy(true)
    setError('')
    try {
      await leaveChat(chat.id)
      onLeft()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{chat.type === 'group' ? chat.name : `Chat with ${chat.name}`}</h3>

        <div className="detail-section">
          <div className="detail-label">Members ({chat.members.length})</div>
          <ul className="member-names">
            {chat.members.map((m) => (
              <li key={m.id}>
                {m.username}
                {m.id === currentUserId && <span className="you-tag"> (you)</span>}
              </li>
            ))}
          </ul>
        </div>

        {/* Group-only controls */}
        {chat.type === 'group' && (
          <>
            <div className="detail-section">
              <div className="detail-label">Add people</div>
              {addable.length === 0 ? (
                <p className="empty-hint">Everyone's already here.</p>
              ) : (
                <>
                  <div className="user-list">
                    {addable.map((u) => (
                      <label key={u.id} className="user-row">
                        <input
                          type="checkbox"
                          checked={toAdd.includes(u.id)}
                          onChange={() => toggle(u.id)}
                        />
                        <span>{u.username}</span>
                      </label>
                    ))}
                  </div>
                  <button onClick={handleAdd} disabled={busy || toAdd.length === 0}>
                    Add selected
                  </button>
                </>
              )}
            </div>

            <button className="danger" onClick={handleLeave} disabled={busy}>
              Leave group
            </button>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
