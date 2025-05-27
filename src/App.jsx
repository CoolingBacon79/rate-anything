import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import MainApp from './MainApp'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Lyssna på auth-ändringar
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    // Viktigt: Avsluta prenumerationen korrekt
    return () => {
      listener.subscription?.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error.message)
    } else {
      setUser(null)
    }
  }

  if (loading) {
  return <div style={{ background: 'yellow', height: '100vh' }}>Loading...</div>
}

if (!user) {
  return <Auth onUser={setUser} />
}

return <MainApp user={user} onSignOut={signOut} />

}
