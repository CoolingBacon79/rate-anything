// src/MainApp.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import './index.css'

const CATEGORIES = ['All', 'Movies', 'TV-Series', 'Food', 'Drinks', 'Music', 'Games', 'Other']
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
  const [inlineScores, setInlineScores] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortOption, setSortOption] = useState('recent')

  // Fetch items once (or when user changes)
  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await supabase
        .from('items')
        .select(`id, name, image_url, created_at, category, ratings(user_id, score)`)  
      if (error) return console.error(error.message)

      const stats = data.map(item => {
        const scores = item.ratings.map(r => r.score)
        const count = scores.length
        const avg = count ? Math.round(scores.reduce((a,b)=>a+b,0)/count) : null
        const you = user ? item.ratings.find(r=>r.user_id===user.id)?.score ?? null : null
        const variance = count > 1
          ? Math.round(scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / count)
          : 0
        return { ...item, average: avg, count, userRating: you, variance }
      })

      setAllItems(stats)
      const init = {}
      stats.forEach(i => { if (i.userRating != null) init[i.id] = i.userRating.toString() })
      setInlineScores(init)
    }
    fetchItems()
  }, [user])

  // Filter by category
  const filtered = allItems.filter(i => selectedCategory === 'All' || i.category === selectedCategory)

  // Exclude unrated for certain sorts
  let listToSort = filtered
  if (sortOption === 'highest' || sortOption === 'lowest') {
    listToSort = filtered.filter(i => i.count > 0)
  } else if (sortOption === 'controversial') {
    listToSort = filtered.filter(i => i.count > 1)
  }

  // Sort items
  const sorted = [...listToSort].sort((a, b) => {
    switch(sortOption) {
      case 'highest': return (b.average || 0) - (a.average || 0)
      case 'lowest': return (a.average || 0) - (b.average || 0)
      case 'controversial': return b.variance - a.variance
      case 'az': return a.name.localeCompare(b.name)
      case 'recent':
      default: return new Date(b.created_at) - new Date(a.created_at)
    }
  })

  // Handlers
  const addItem = async e => {
    e.preventDefault()
    if (!newItemName.trim()) return
    setLoading(true)

    let imageUrl = ''
    if (newItemImage) {
      const ext = newItemImage.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase
        .storage.from('item-images').upload(fileName, newItemImage)
      if (!upErr) {
        const { data } = supabase.storage.from('item-images').getPublicUrl(fileName)
        imageUrl = data.publicUrl
      } else console.error(upErr.message)
    }

    const { data, error } = await supabase
      .from('items')
      .insert([{ name: newItemName, image_url: imageUrl, category: newItemCategory }])
      .select()
    setLoading(false)
    if (error) console.error(error.message)
    else {
      const newItem = {
        ...data[0], ratings: [], average: null, count: 0, userRating: null, variance: 0
      }
      setAllItems([newItem, ...allItems])
      setNewItemName('')
      setNewItemImage(null)
      setNewItemCategory(CATEGORIES[1])
    }
  }

  const uploadImageForItem = async (itemId, file) => {
    if (!file) return
    setUploadingId(itemId)
    const ext = file.name.split('.').pop()
    const fileName = `item-${itemId}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase
      .storage.from('item-images').upload(fileName, file)
    if (!upErr) {
      const { data } = supabase.storage.from('item-images').getPublicUrl(fileName)
      await supabase.from('items').update({ image_url: data.publicUrl }).eq('id', itemId)
      setAllItems(allItems.map(it => it.id === itemId ? { ...it, image_url: data.publicUrl } : it))
    } else console.error(upErr.message)
    setUploadingId(null)
  }

  const startEdit = id => {
    if (!user) { setShowAuthModal(true); return }
    setEditingId(id)
  }

  const submitRating = async id => {
    const val = inlineScores[id]
    const num = Number(val)
    if (isNaN(num) || num < 0 || num > 100) return alert('Score måste vara 0–100.')
    const { error } = await supabase
      .from('ratings')
      .upsert({ item_id: id, user_id: user.id, score: num }, { onConflict: ['user_id','item_id'] })
    if (error) console.error(error.message)
    else {
      setEditingId(null)
      setAllItems(allItems.map(it => it.id === id ? { ...it, userRating: num } : it))
    }
  }

  const AvgBox = ({ avg }) => {
    const text = avg == null ? '—' : avg
    let bg = '#ddd'
    if (avg != null) bg = avg >= 70 ? '#4caf50' : avg >= 40 ? '#ffc107' : '#f44336'
    return <div className="avg-box" style={{ backgroundColor: bg }}>{text}</div>
  }

  return (
    <div className="main-app">
      <header className="app-header">
        <h1 className="title">🌟 Rate Anything</h1>
        {/* Category Filters */}
        <div className="controls" style={{ textAlign: 'center', margin: '1rem 0' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} style={buttonStyle(selectedCategory === cat)}>{cat}</button>
          ))}
        </div>
        {/* Sort Options */}
        <div className="controls" style={{ textAlign: 'center', margin: '0.5rem 0' }}>
          {SORT_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => setSortOption(opt.key)} style={buttonStyle(sortOption === opt.key)}>{opt.label}</button>
          ))}
        </div>
        {/* Auth Controls */}
        <div className="auth-controls">
          {user
            ? <button onClick={onSignOut} style={authBtnStyle}>Sign Out</button>
            : <button onClick={() => setShowAuthModal(true)} style={authBtnStyle}>Sign In</button>
          }
        </div>
      </header>
      {/* Add Item Form */}
      {user && (
        <form className="add-item-form" onSubmit={addItem} style={{ margin: '1rem 0', display: 'flex', gap: '0.5rem' }}>
          <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item name" />
          <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)}>
            {CATEGORIES.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input type="file" accept="image/*" onChange={e => setNewItemImage(e.target.files[0])} />
          <button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add Item'}</button>
        </form>
      )}
      {/* Item Grid */}
      <ul className="item-grid">
        {sorted.map(item => (
          <li key={item.id} className="item-card">
            {item.image_url
              ? <img src={item.image_url} alt={item.name} />
              : user && <div className="placeholder"><label htmlFor={`upload-${item.id}`}>{uploadingId===item.id ? 'Uploading…' : 'Add Image'}</label><input id={`upload-${item.id}`} type="file" accept="image/*" disabled={uploadingId===item.id} onChange={e => uploadImageForItem(item.id, e.target.files[0])} /></div>
            }
            <strong className="item-name">{item.name}</strong>
            <AvgBox avg={item.average} />
            {editingId === item.id
              ? <div className="inline-edit"><input type="number" min="0" max="100" value={inlineScores[item.id]||''} onChange={e => setInlineScores(s => ({ ...s, [item.id]: e.target.value }))} /><button onClick={() => submitRating(item.id)}>Submit</button></div>
              : <div className="you-box" onClick={() => !user ? setShowAuthModal(true) : startEdit(item.id)}>{user ? (item.userRating != null ? item.userRating : 'Rate') : 'Rate'}</div>
            }
            <div className="count">{item.count} ratings</div>
          </li>
        ))}
      </ul>
      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button><Auth onUser={u => { onSignIn(u); if (u) setShowAuthModal(false); }} /></div></div>
      )}
    </div>
  )
}

// Styles
const buttonStyle = selected => ({
  margin: '0 0.25rem',
  backgroundColor: selected ? '#ffc107' : '#eee',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '0.25rem',
  cursor: 'pointer'
})

const authBtnStyle = {
  backgroundColor: '#ffc107', position: 'absolute', top: '1rem', right: '1rem', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.25rem', cursor: 'pointer'
}
