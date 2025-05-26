// src/MainApp.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function MainApp({ user }) {
  const [items, setItems] = useState([])
  const [newItemName, setNewItemName] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState('')
  const [score, setScore] = useState(50)

  // Fetch items whenever the user changes
  useEffect(() => {
    if (user) fetchItems()
  }, [user])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, ratings(score)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching items:', error.message)
      return
    }

    const withAvg = data.map((i) => {
      const scores = i.ratings.map((r) => r.score)
      const average = scores.length
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 'No ratings'
      return { ...i, average }
    })

    setItems(withAvg)
  }

  const addItem = async (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    setLoading(true)
    const { data, error } = await supabase
      .from('items')
      .insert([{ name: newItemName }])
      .select()
    setLoading(false)

    if (error) {
      console.error('Error adding item:', error.message)
      return
    }
    setItems([data[0], ...items])
    setNewItemName('')
  }

  const submitRating = async () => {
    if (!selectedItemId) return alert('Please select an item.')
    if (score < 1 || score > 100) return alert('Score must be 1–100.')
    if (!user?.id) return alert('You must be signed in.')

    const { error } = await supabase
      .from('ratings')
      .upsert(
        { item_id: selectedItemId, user_id: user.id, score },
        { onConflict: ['user_id', 'item_id'] }
      )

    if (error) {
      console.error('Error submitting rating:', error.message)
      alert('Failed to submit rating.')
    } else {
      fetchItems()
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Rate Anything</h1>

      <form onSubmit={addItem} style={{ marginBottom: '1rem' }}>
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="New item"
        />
        <button type="submit" disabled={loading} style={{ marginLeft: '.5rem' }}>
          {loading ? 'Adding…' : 'Add Item'}
        </button>
      </form>

      <div style={{ marginBottom: '2rem' }}>
        <select
          value={selectedItemId}
          onChange={(e) => setSelectedItemId(e.target.value)}
        >
          <option value="">-- Select item --</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="1"
          max="100"
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          style={{ marginLeft: '.5rem', width: '60px' }}
        />

        <button onClick={submitRating} style={{ marginLeft: '.5rem' }}>
          Submit Rating
        </button>
      </div>

      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <strong>{i.name}</strong> — Avg: {i.average}
          </li>
        ))}
      </ul>
    </div>
  )
}
