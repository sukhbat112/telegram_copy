import { useState, useEffect } from 'react'
import { listUsers, createChat, type ChatSummary, type User } from '../api'

// A small popup to start a chat. Pick ONE person for a 1:1, or several
// (plus a name) for a group.
export function NewChatDialog({
  onCreated,
  onCancel,
}: {
  onCreated: (chat: ChatSummary) => void
  onCancel: () => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [groupName, setGroupName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Load the list of people I can chat with.
  useEffect(() => {
    listUsers().then((data) => setUsers(data.users))
  }, [])

  // Add or remove a user id from the selection.
  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const isGroup = selected.length > 1

  async function handleCreate() {
    if (selected.length === 0) {
      setError('Pick at least one person.')
      return
    }
    if (isGroup && groupName.trim().length === 0) {
      setError('Give your group a name.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const { chat } = await createChat(selected, isGroup ? groupName.trim() : undefined)
      onCreated(chat)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    // Clicking the dark backdrop cancels.
    <div className="modal-backdrop" onClick={onCancel}>
      {/* stopPropagation keeps clicks inside the box from closing it. */}
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New chat</h3>

        {users.length === 0 ? (
          <p className="empty-hint">
            No other users yet. Register a second account to chat with!
          </p>
        ) : (
          <div className="user-list">
            {users.map((u) => (
              <label key={u.id} className="user-row">
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={() => toggle(u.id)}
                />
                <span>{u.username}</span>
              </label>
            ))}
          </div>
        )}

        {/* Only groups (2+ people) need a name. */}
        {isGroup && (
          <input
            className="group-name"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={busy || users.length === 0}>
            {busy ? 'Starting…' : isGroup ? 'Create group' : 'Start chat'}
          </button>
        </div>
      </div>
    </div>
  )
}
