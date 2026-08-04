// A small wrapper around fetch() for talking to our backend.
// It attaches the login token, sends/parses JSON, and turns error
// responses into thrown Errors so components can catch them.

const TOKEN_KEY = 'token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export type User = { id: number; username: string }

// The core request helper used by everything below.
async function request(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Attach the token if we have one (this is how the server knows it's us).
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Our backend sends { error: "..." } when something goes wrong.
    throw new Error(data.error || 'Request failed')
  }
  return data
}

export function register(username: string, password: string) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }) as Promise<{ token: string; user: User }>
}

export function login(username: string, password: string) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }) as Promise<{ token: string; user: User }>
}

export function fetchMe() {
  return request('/api/auth/me') as Promise<{ user: User }>
}

// --- Users & chats (Phase 2) ---

export type ChatSummary = {
  id: number
  type: 'direct' | 'group'
  name: string
  members: User[]
  lastMessage: { content: string; createdAt: string } | null
}

export type Message = {
  id: number
  chatId: number
  content: string
  createdAt: string
  sender: User
}

// Everyone except me — for starting new chats.
export function listUsers() {
  return request('/api/users') as Promise<{ users: User[] }>
}

// The chats I'm a member of.
export function listChats() {
  return request('/api/chats') as Promise<{ chats: ChatSummary[] }>
}

// Start a new chat. 1 person => direct, 2+ => group (name required).
export function createChat(memberIds: number[], name?: string) {
  return request('/api/chats', {
    method: 'POST',
    body: JSON.stringify({ memberIds, name }),
  }) as Promise<{ chat: ChatSummary }>
}

// Full message history for a chat. (Sending is realtime now — see socket.ts.)
export function listMessages(chatId: number) {
  return request(`/api/chats/${chatId}/messages`) as Promise<{ messages: Message[] }>
}

// Add people to a group chat.
export function addMembers(chatId: number, userIds: number[]) {
  return request(`/api/chats/${chatId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  }) as Promise<{ chat: ChatSummary }>
}

// Leave a group chat.
export function leaveChat(chatId: number) {
  return request(`/api/chats/${chatId}/leave`, { method: 'POST' }) as Promise<{ ok: true }>
}
