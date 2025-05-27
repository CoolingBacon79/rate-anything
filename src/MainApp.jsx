// src/MainApp.jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './index.css'

export default function MainApp({ user, onSignOut }) {
  const [items, setItems] = useState([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemImage, setNewItemImage] = useState(null)
  const [loading, setLoading] = useState(false)
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
    stats.forEach(i => {
      if (i.userRating != null) init[i.id] = i.userRating.toString()
    })
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
    const txt = avg == null ? '—' : avg
    let bg = '#ddd'
    if (avg != null) bg = avg >= 70 ? '#4caf50' : avg >= 40 ? '#ffc107' : '#f44336'
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
        margin: '0.5rem auto 0'
      }}>
        {txt}
      </div>
    )
  }

  return (
    <div style={{
      padding:'2rem',
      fontFamily:'sans-serif',
      background:'#fffbea',
      minHeight:'100vh'
    }}>
      {user && (
        <div style={{ textAlign:'right', marginBottom:'1rem' }}>
          <button onClick={onSignOut} style={{
            padding:'0.5rem 1rem',
            backgroundColor:'#ffc107',
            border:'none',
            borderRadius:'6px',
            cursor:'pointer'
          }}>
            Sign Out
          </button>
        </div>
      )}

      <h1 style={{ color:'#ffc107' }}>🌟 Rate Anything</h1>

      {user && (
        <form onSubmit={addItem} style={{ margin:'1rem 0' }}>
          <input
            value={newItemName}
            onChange={e=>setNewItemName(e.target.value)}
            placeholder="New item"
            style={{ padding:'0.5rem',borderRadius:'6px',border:'1px solid #ccc' }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={e=>setNewItemImage(e.target.files[0])}
            style={{ marginLeft:'0.5rem' }}
          />
          <button type="submit" disabled={loading} style={{
            marginLeft:'.5rem',
            padding:'0.5rem 1rem',
            backgroundColor:'#ffc107',
            border:'none',
            borderRadius:'6px',
            cursor:'pointer'
          }}>
            {loading?'Adding…':'Add Item'}
          </button>
        </form>
      )}

      <ul style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',
        gap:'1rem',
        listStyle:'none',
        padding:0
      }}>
        {items.map(item => (
          <li key={item.id} style={{
            background:'white',
            borderRadius:'10px',
            padding:'1rem',
            boxShadow:'0 2px 6px rgba(0,0,0,0.1)',
            textAlign:'center'
          }}>
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                style={{
                  width:'100%',
                  aspectRatio:'1/1',
                  objectFit:'cover',
                  borderRadius:'6px',
                  marginBottom:'0.5rem'
                }}
              />
            ) : (
              <div style={{
                position: 'relative',
                width:'100%',
                aspectRatio:'1/1',
                background:'#eee',
                borderRadius:'6px',
                marginBottom:'0.5rem'
              }}>
                <label
                  htmlFor={`upload-${item.id}`}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    padding:'0.5rem 1rem',
                    backgroundColor:'#ffc107',
                    color:'#000',
                    borderRadius:'6px',
                    cursor: uploadingId===item.id ? 'wait' : 'pointer'
                  }}
                >
                  {uploadingId===item.id?'Uploading…':'Add Image'}
                </label>
                <input
                  id={`upload-${item.id}`}
                  type="file"
                  accept="image/*"
                  style={{ display:'none' }}
                  disabled={uploadingId===item.id}
                  onChange={e=>uploadImageForItem(item.id,e.target.files[0])}
                />
              </div>
            )}

            <strong style={{
              color:'#000',
              fontSize:'1rem',
              whiteSpace:'normal',
              overflowWrap:'break-word',
              display:'block',
              marginBottom:'0.5rem'
            }}>
              {item.name}
            </strong>

            <AvgBox avg={item.average} />

            {user && (
              editingId === item.id ? (
                <div style={{ marginTop:'0.5rem' }}>
                  <input
                    type="number" min="0" max="100"
                    value={inlineScores[item.id]||''}
                    onChange={e=>setInlineScores(s=>({...s,[item.id]:e.target.value}))}
                    style={{
                      width:'50px',
                      padding:'0.25rem',
                      textAlign:'center',
                      background:'#fff',
                      border:'1px solid #ccc',
                      borderRadius:'6px'
                    }}
                  />
                  <button
                    onClick={()=>submitRating(item.id)}
                    style={{
                      marginLeft:'0.5rem',
                      padding:'0.3rem .6rem',
                      backgroundColor:'#ffc107',
                      border:'none',
                      borderRadius:'6px',
                      cursor:'pointer'
                    }}
                  >
                    Submit
                  </button>
                </div>
              ) : (
                <div
                  onClick={()=>startEdit(item.id)}
                  style={{
                    background:'#eee',
                    padding:'0.5rem',
                    borderRadius:'6px',
                    width:'50px',
                    margin:'0.5rem auto 0',
                    cursor:'pointer'
                  }}
                >
                  {item.userRating!=null ? item.userRating : 'You'}
                </div>
              )
            )}

            <div style={{
              fontSize:'0.8rem',
              color:'#666',
              marginTop:'0.5rem'
            }}>
              {item.count} ratings
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
