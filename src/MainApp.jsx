// src/MainApp.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

export default function MainApp({ user, onSignOut }) {
  const [items, setItems]         = useState([])
  const [newItemName, setNewItemName]   = useState('')
  const [newItemImage, setNewItemImage] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [inlineScores, setInlineScores] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    const { data, error } = await supabase
      .from('items')
      .select(`id, name, image_url, ratings(user_id, score)`)
      .order('created_at', { ascending: false })
    if (error) return console.error(error.message)

    const stats = data.map(item => {
      const all = item.ratings.map(r => r.score)
      const cnt = all.length
      const avg = cnt ? Math.round(all.reduce((a,b)=>a+b,0)/cnt) : null
      const you = user
        ? item.ratings.find(r=>r.user_id===user.id)?.score ?? null
        : null
      return { ...item, average: avg, count: cnt, userRating: you }
    })

    setItems(stats)
    const init = {}
    stats.forEach(i => { if (i.userRating!=null) init[i.id] = i.userRating.toString() })
    setInlineScores(init)
  }

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
        const { data } = supabase
          .storage.from('item-images').getPublicUrl(fileName)
        imageUrl = data.publicUrl
      } else console.error(upErr.message)
    }

    const { data, error } = await supabase
      .from('items')
      .insert([{ name: newItemName, image_url: imageUrl }])
      .select()
    setLoading(false)
    if (error) console.error(error.message)
    else {
      setItems([...items, {
        id: data[0].id,
        name: data[0].name,
        image_url: data[0].image_url,
        average: null,
        count: 0,
        userRating: null
      }])
      setNewItemName('')
      setNewItemImage(null)
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
      const { error: updateErr } = await supabase
        .from('items')
        .update({ image_url: data.publicUrl })
        .eq('id', itemId)
      if (updateErr) console.error(updateErr.message)
      else await loadItems()
    } else console.error(upErr.message)
    setUploadingId(null)
  }

  const startEdit = id => {
    if (!user) return alert('Logga in för att ge betyg.')
    setEditingId(id)
  }

  const submitRating = async id => {
    const val = inlineScores[id]
    const num = Number(val)
    if (isNaN(num) || num < 0 || num > 100) {
      alert('Score måste vara 0–100.')
      return
    }
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { item_id: id, user_id: user.id, score: num },
        { onConflict: ['user_id','item_id'] }
      )
    if (error) {
      console.error(error.message)
      alert('Kunde inte spara betyg.')
    } else {
      await loadItems()
      setEditingId(null)
    }
  }

  const AvgBox = ({ avg }) => {
  const text = avg == null ? '—' : avg
  let bg = '#ddd'
  if (avg != null) {
    bg = avg >= 70
      ? '#4caf50'
      : avg >= 40
        ? '#ffc107'
        : '#f44336'
  }
  return (
    <div
      className="avg-box"
      style={{ backgroundColor: bg }}   // <-- override CSS bg here
    >
      {text}
    </div>
  )
}

  return (
    <div className="main-app">
      {user && (
        <div className="sign-out">
          <button onClick={onSignOut}>Sign Out</button>
        </div>
      )}

      <h1 className="title">🌟 Rate Anything</h1>

      {user && (
        <form className="add-item-form" onSubmit={addItem}>
          <input
            value={newItemName}
            onChange={e=>setNewItemName(e.target.value)}
            placeholder="New item"
          />
          <input
            type="file"
            accept="image/*"
            onChange={e=>setNewItemImage(e.target.files[0])}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Adding…' : 'Add Item'}
          </button>
        </form>
      )}

      <ul className="item-grid">
        {items.map(item => (
          <li key={item.id} className="item-card">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} />
            ) : (
              <div className="placeholder">
                <label htmlFor={`upload-${item.id}`}>
                  {uploadingId===item.id ? 'Uploading…' : 'Add Image'}
                </label>
                <input
                  id={`upload-${item.id}`}
                  type="file"
                  accept="image/*"
                  disabled={uploadingId===item.id}
                  onChange={e=>uploadImageForItem(item.id,e.target.files[0])}
                />
              </div>
            )}

            <strong className="item-name">{item.name}</strong>

            <AvgBox avg={item.average} />

            {user && (
              editingId === item.id ? (
                <div className="inline-edit">
                  <input
                    type="number"
                    min="0" max="100"
                    value={inlineScores[item.id]||''}
                    onChange={e=>setInlineScores(s=>({...s,[item.id]:e.target.value}))}
                  />
                  <button onClick={()=>submitRating(item.id)}>Submit</button>
                </div>
              ) : (
                <div
                  className="you-box"
                  onClick={()=>startEdit(item.id)}
                >
                  {item.userRating!=null ? item.userRating : 'You'}
                </div>
              )
            )}

            <div className="count">{item.count} ratings</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
