// src/Auth.jsx
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './Auth.css'

export default function Auth({ onUser }) {
  const [mode, setMode]         = useState('signIn') // or 'signUp'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      onUser(session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      onUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [onUser])

  const valid =
    email.trim() !== '' &&
    password.trim() !== '' &&
    (mode === 'signIn' || password === confirm)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signUp') {
      if (password !== confirm) {
        setError("Passwords don't match.")
        setLoading(false)
        return
      }
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) setError(err.message)
      else setError('Check your email for a confirmation link.')
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-tabs">
          <button
            className={mode === 'signIn' ? 'active' : ''}
            onClick={() => { setMode('signIn'); setError('') }}
          >
            Sign In
          </button>
          <button
            className={mode === 'signUp' ? 'active' : ''}
            onClick={() => { setMode('signUp'); setError('') }}
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {mode === 'signUp' && (
            <label>
              Confirm Password
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </label>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-submit"
            disabled={!valid || loading}
          >
            {loading
              ? 'Processing…'
              : mode === 'signUp'
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
