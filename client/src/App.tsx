import { useState, useEffect } from 'react'
import './App.css'
import { AuthForm } from './components/AuthForm'
import { ChatApp } from './components/ChatApp'
import { fetchMe, clearToken, getToken, type User } from './api'
import { disconnectSocket } from './socket'

function App() {
  // Who's logged in (null = nobody yet).
  const [user, setUser] = useState<User | null>(null)
  // While we check the saved token on startup, show a loading state.
  const [loading, setLoading] = useState(true)

  // On page load: if we have a saved token, ask the server "who am I?".
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    fetchMe()
      .then((data) => setUser(data.user))
      .catch(() => clearToken()) // token was invalid or expired
      .finally(() => setLoading(false))
  }, [])

  function handleLogout() {
    disconnectSocket() // close the realtime connection
    clearToken()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="app">
        <p className="tagline">Loading…</p>
      </div>
    )
  }

  // Logged out → the narrow auth screen.
  if (!user) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="logo">✈️</div>
          <h1>Mini Telegram</h1>
          <p className="tagline">Phase 3 — realtime</p>
        </header>
        <AuthForm onAuth={setUser} />
      </div>
    )
  }

  // Logged in → the full chat app.
  return <ChatApp user={user} onLogout={handleLogout} />
}

export default App
