// src/Auth.jsx
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Auth({ onUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      onUser(u)
    })

    // Listen for login/logout
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      onUser(u)
    })
    const subscription = data.subscription

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) alert(error.message)
    else alert('Check your email for a confirmation link.')
  }

  const signIn = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) alert(error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  if (user) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <p>Signed in as {user.email}</p>
        <button onClick={signOut}>Sign Out</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h2>Please Sign In</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ display: 'block', marginBottom: '.5rem' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: '.5rem' }}
      />
      <button onClick={signIn} disabled={loading} style={{ marginRight: '1rem' }}>
        Sign In
      </button>
      <button onClick={signUp} disabled={loading}>
        Sign Up
      </button>
    </div>
  )
}