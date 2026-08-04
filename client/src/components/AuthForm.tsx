import { useState, type FormEvent } from 'react'
import { register, login, setToken, type User } from '../api'

// This component shows the login / sign-up form.
// When auth succeeds it calls onAuth(user) so the parent (App) knows
// we're now logged in.
export function AuthForm({ onAuth }: { onAuth: (user: User) => void }) {
  // Which mode are we in — logging in, or creating an account?
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // "Controlled inputs": React holds the value of each field in state.
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault() // stop the browser from reloading the page on submit
    setError('')
    setBusy(true)
    try {
      // Pick the right API call based on the mode.
      const action = mode === 'login' ? login : register
      const { token, user } = await action(username, password)
      setToken(token) // remember the token so we stay logged in
      onAuth(user) // tell App we're in
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>

      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />

      {/* Only show the error line when there is one */}
      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
      </button>

      <p className="switch">
        {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </form>
  )
}
