import { useState } from 'react'
import Auth from './Auth'
import MainApp from './MainApp'

export default function App() {
  const [user, setUser] = useState(null)
  return (
    <>
      <Auth onUser={setUser} />
      {user && <MainApp user={user} />}
    </>
  )
}
