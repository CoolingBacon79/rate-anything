// src/MainApp.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import InlineRating from './InlineRating'
import ImageUploader from './ImageUploader'
import './index.css'

// Component to display average score
function AvgBox({ avg }) {
  const text = avg == null ? '—' : avg
  const bg = avg == null
    ? '#ddd'
    : avg >= 70
      ? '#4caf50'
      : avg >= 40
        ? '#ffc107'
        : '#f44336'
  return (
    <div className="avg-box" style={{ backgroundColor: bg }}>
      {text}
    </div>
  )
}

const CATEGORIES = [
  'All',
  'Movies',
  'TV-Series',
  'Food',
  'Drinks',
  'Music',
  'Games',
  'Other'
]
const SORT_OPTIONS = [
  { key: 'recent', label: 'Recently Added' },
  { key: 'highest', label: 'Highest Rating' },
  { key: 'lowest', label: 'Lowest Rating' },
  { key: 'controversial', label: 'Controversial' },
  { key: 'az', label: 'A–Z' }
]

export default function MainApp({ user, onSignOut, onSignIn }) {
  const [allItems, setAllItems] = useState([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemImage, setNewItemImage] = useState(null)
  const [newItemCategory, setNewItemCategory] = useState(CATEGORIES[1])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortOption, setSortOption] = useState('recent')

  // Fetch items + compute stats
  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('items')
      .select(`id, name, image_url, created_at, category, ratings(user_id, score)`)
    if (error) {
      console.error('fetchItems error:', error)
      return
    }
    const stats = data.map(item => {
      const scores = item.ratings.map(r => r.score)
      const count = scores.length
      const average = count
        ? Math.round(scores.reduce((a, b) => a + b, 0) / count)
        : null
      const userRating = user
        ? item.ratings.find(r => r.user_id === user.id)?.score ?? null
        : null
      const variance = count > 1
        ? Math.round(
            scores.reduce((sum, s) => sum + (s - average) ** 2, 0) / count
          )
        : 0
      return { ...item, average, count, userRating, variance }
    })
    setAllItems(stats)
  }, [user])

  // initial + on user change
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Filter & sort
  const filtered = allItems.filter(i =>
    selectedCategory === 'All' ? true : i.category === selectedCategory
  )
  let listToSort = filtered
  if (sortOption === 'highest' || sortOption === 'lowest') {
    listToSort = filtered.filter(i => i.count > 0)
  } else if (sortOption === 'controversial') {
    listToSort = filtered.filter(i => i.count > 1)
  }
  const sorted = editingId
    ? filtered
    : [...listToSort].sort((a, b) => {
        switch (sortOption) {
          case 'highest':
            return (b.average || 0) - (a.average || 0)
          case 'lowest':
            return (a.average || 0) - (b.average || 0)
          case 'controversial':
            return b.variance - a.variance
          case 'az':
            return a.name.localeCompare(b.name)
          case 'recent':
          default:
            return new Date(b.created_at) - new Date(a.created_at)
        }
      })

  // Add new item
  const addItem = async e => {
    e.preventDefault()
    if (!newItemName.trim()) return
    setLoading(true)
    let imageUrl = ''
    if (newItemImage) {
      const ext = newItemImage.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase
        .storage
        .from('item-images')
        .upload(fileName, newItemImage, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase
          .storage
          .from('item-images')
          .getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      } else {
        console.error(upErr)
      }
    }
    const { data, error } = await supabase
      .from('items')
      .insert([{
        name: newItemName,
        image_url: imageUrl,
        category: newItemCategory
      }])
      .select()
    setLoading(false)
    if (error) {
      console.error('addItem error:', error)
    } else {
      setNewItemName('')
      setNewItemImage(null)
      setNewItemCategory(CATEGORIES[1])
      // refresh list
      fetchItems()
    }
  }

  // Submit rating then refresh list
  const handleRatingSubmit = async (itemId, score) => {
    await supabase
      .from('ratings')
      .upsert(
        { item_id: itemId, user_id: user.id, score },
        { onConflict: ['user_id', 'item_id'] }
      )
    setEditingId(null)
    fetchItems()
  }

  return (
    <div className="main-app">
      <header className="app-header">
        <h1 className="title">🌟 Rate Anything</h1>
        <div className="controls" style={{ textAlign: 'center', margin: '1rem 0' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={buttonStyle(selectedCategory === cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="controls" style={{ textAlign: 'center', margin: '0.5rem 0' }}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortOption(opt.key)}
              style={buttonStyle(sortOption === opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="auth-controls">
          {user ? (
            <button onClick={onSignOut} style={authBtnStyle}>
              Sign Out
            </button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={authBtnStyle}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {user && (
        <form
          className="add-item-form"
          onSubmit={addItem}
          style={{ margin: '1rem 0', display: 'flex', gap: '0.5rem' }}
        >
          <input
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            placeholder="Item name"
          />
          <select
            value={newItemCategory}
            onChange={e => setNewItemCategory(e.target.value)}
          >
            {CATEGORIES.slice(1).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={e => setNewItemImage(e.target.files[0])}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Adding…' : 'Add Item'}
          </button>
        </form>
      )}

      <ul className="item-grid">
        {sorted.map(item => (
          <li key={item.id} className="item-card">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} />
            ) : (
              user && (
                <ImageUploader
                  itemId={item.id}
                  onComplete={(id, url) => {
                    fetchItems()
                  }}
                />
              )
            )}
            <strong className="item-name">{item.name}</strong>
            <AvgBox avg={item.average} />

            {editingId === item.id ? (
              <InlineRating
                itemId={item.id}
                initialScore={item.userRating}
                onSubmit={handleRatingSubmit}
                onEditDone={() => setEditingId(null)}
              />
            ) : (
              <div
                className="you-box"
                onClick={() =>
                  !user ? setShowAuthModal(true) : setEditingId(item.id)
                }
              >
                {item.userRating ?? 'Rate'}
              </div>
            )}

            <div className="count">{item.count} ratings</div>
          </li>
        ))}
      </ul>

      {showAuthModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="modal-close"
              onClick={() => setShowAuthModal(false)}
            >
              ×
            </button>
            <Auth
              onUser={u => {
                onSignIn(u)
                if (u) setShowAuthModal(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Styles & helpers
const buttonStyle = selected => ({
  margin: '0 0.25rem',
  backgroundColor: selected ? '#ffc107' : '#eee',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '0.25rem',
  cursor: 'pointer'
})
const authBtnStyle = {
  backgroundColor: '#ffc107',
  position: 'absolute',
  top: '1rem',
  right: '1rem',
  padding: '0.5rem 1rem',
  border: 'none',
  borderRadius: '0.25rem',
  cursor: 'pointer'
}
