// src/MainApp.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

export default function MainApp({ user, onSignOut }) {
  const [items, setItems] = useState([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemImage, setNewItemImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [score, setScore] = useState('50')
  const [uploadingItemId, setUploadingItemId] = useState(null)

  // Fetch items + ratings once
  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select(`id, name, image_url, ratings(user_id, score)`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error.message)
      return
    }

    const stats = data.map(item => {
      const allScores = item.ratings.map(r => r.score)
      const count     = allScores.length
      const average   = count
        ? Math.round(allScores.reduce((a,b)=>a+b,0)/count)
        : null
      const userRating = user
        ? item.ratings.find(r => r.user_id === user.id)?.score ?? null
        : null
      return { ...item, average, count, userRating }
    })

    setItems(stats)
  }

  // Add new item + optional image
  const addItem = async e => {
    e.preventDefault()
    if (!newItemName.trim()) return

    setLoading(true)
    let imageUrl = ''

    if (newItemImage) {
      const ext      = newItemImage.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase
        .storage
        .from('item-images')
        .upload(fileName, newItemImage)
      if (!uploadError) {
        const { data } = supabase
          .storage
          .from('item-images')
          .getPublicUrl(fileName)
        imageUrl = data.publicUrl
      } else {
        console.error(uploadError.message)
      }
    }

    const { data, error } = await supabase
      .from('items')
      .insert([{ name: newItemName, image_url: imageUrl }])
      .select()
    setLoading(false)

    if (error) {
      console.error(error.message)
    } else {
      setItems([
        ...items,
        {
          id: data[0].id,
          name: data[0].name,
          image_url: data[0].image_url,
          average: null,
          count: 0,
          userRating: null
        }
      ])
      setNewItemName('')
      setNewItemImage(null)
    }
  }

  // Open rating modal (only for logged-in)
  const openRating = item => {
    if (!user) {
      alert('Du måste vara inloggad för att betygsätta.')
      return
    }
    setSelectedItem(item)
    setScore(item.userRating != null ? item.userRating.toString() : '50')
  }

  // Submit or update rating
  const submitRating = async () => {
    const numeric = Number(score)
    if (!selectedItem) return
    if (isNaN(numeric) || numeric < 0 || numeric > 100) {
      alert('Score måste vara 0–100.')
      return
    }
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { item_id: selectedItem.id, user_id: user.id, score: numeric },
        { onConflict: ['user_id','item_id'] }
      )
    if (error) {
      console.error(error.message)
      alert('Kunde inte spara betyg.')
    } else {
      await fetchItems()
      setSelectedItem(null)
      setScore('50')
    }
  }

  // Large community average box
  const AvgBox = ({ avg }) => {
    const text = avg == null ? '—' : avg
    let bg = '#ddd'
    if (avg != null) {
      if (avg >= 70) bg = '#4caf50'
      else if (avg >= 40) bg = '#ffc107'
      else bg = '#f44336'
    }
    return (
      <div style={{
        backgroundColor: bg,
        color: '#000',
        borderRadius: '8px',
        padding: '0.5rem',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        textAlign: 'center',
        width: '60px',
        margin: '0.5rem auto 0 auto',
      }}>
        {text}
      </div>
    )
  }

  // Smaller personal score box
  const YouBox = ({ your }) => {
    if (your == null) return null
    return (
      <div style={{
        backgroundColor: '#eee',
        color: '#000',
        borderRadius: '6px',
        padding: '0.25rem 0.5rem',
        fontSize: '0.9rem',
        textAlign: 'center',
        width: '50px',
        margin: '0.25rem auto 0 auto',
      }}>
        {your}
      </div>
    )
  }

  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'sans-serif',
      background: '#fffbea',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      {user && (
        <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
          <button
            onClick={onSignOut}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffc107',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      )}

      <h1 style={{ color: '#ffc107' }}>🌟 Rate Anything</h1>

      {/* Add Item form only for logged-in */}
      {user && (
        <form onSubmit={addItem} style={{ margin: '1rem 0' }}>
          <input
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            placeholder="New item"
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={e => setNewItemImage(e.target.files[0])}
            style={{ marginLeft: '0.5rem' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              marginLeft: '.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#ffc107',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {loading ? 'Adding…' : 'Add Item'}
          </button>
        </form>
      )}

      {/* Always-visible item grid */}
      <ul style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
        gap: '1rem',
        padding: 0,
        listStyle: 'none'
      }}>
        {items.map(item => (
          <li key={item.id} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1rem',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div onClick={() => openRating(item)} style={{ cursor: 'pointer' }}>
              {item.image_url
                ? <img
                    src={item.image_url}
                    alt={item.name}
                    style={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      marginBottom: '0.5rem'
                    }}
                  />
                : <div style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    background: '#eee',
                    borderRadius: '6px',
                    marginBottom: '0.5rem'
                  }} />
              }
              <strong style={{ display: 'block', marginBottom: '0.75rem' }}>
                {item.name}
              </strong>
            </div>

            <AvgBox avg={item.average} />
            <YouBox your={item.userRating} />
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
              {item.count} ratings
            </div>
          </li>
        ))}
      </ul>

      {/* Rating modal only for logged-in */}
      {selectedItem && user && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '10px',
            width: '300px'
          }}>
            <h3 style={{ marginTop: 0 }}>Rate {selectedItem.name}</h3>
            <input
              type="number" min="0" max="100"
              value={score}
              onChange={e => setScore(e.target.value)}
              style={{ padding: '0.5rem', width: '80px', marginRight: '1rem' }}
            />
            <button onClick={submitRating} style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffc107',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Submit
            </button>
            <button onClick={() => setSelectedItem(null)} style={{
              marginLeft: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#ddd',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
