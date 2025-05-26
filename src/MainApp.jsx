import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function MainApp({ user }) {
  const [items, setItems] = useState([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemImage, setNewItemImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [score, setScore] = useState(50)
  const [uploadingItemId, setUploadingItemId] = useState(null) // for existing image uploads

  useEffect(() => {
    if (user) fetchItems()
  }, [user])

  async function fetchItems() {
    const { data, error } = await supabase
      .from('items')
      .select('id, name, image_url, ratings(score)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching items:', error.message)
      return
    }

    const withAvg = data.map((i) => {
      const scores = i.ratings.map((r) => r.score)
      const average = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 'No ratings'
      return { ...i, average }
    })

    setItems(withAvg)
  }

  // Add new item with optional image
  const addItem = async (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    setLoading(true)
    let imageUrl = ''

    if (newItemImage) {
      const fileExt = newItemImage.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(fileName, newItemImage)

      if (uploadError) {
        console.error('Image upload failed:', uploadError.message)
      } else {
        const { data: publicUrlData } = supabase
          .storage
          .from('item-images')
          .getPublicUrl(fileName)

        imageUrl = publicUrlData.publicUrl
      }
    }

    const { data, error } = await supabase
      .from('items')
      .insert([{ name: newItemName, image_url: imageUrl }])
      .select()

    setLoading(false)

    if (error) {
      console.error('Error adding item:', error.message)
      return
    }

    setItems([data[0], ...items])
    setNewItemName('')
    setNewItemImage(null)
  }

  // Upload image for an existing item WITHOUT image
  const uploadImageForItem = async (itemId, file) => {
    if (!file) return
    setUploadingItemId(itemId)

    const fileExt = file.name.split('.').pop()
    const fileName = `item-${itemId}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('item-images')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Error uploading image:', uploadError.message)
      setUploadingItemId(null)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('item-images')
      .getPublicUrl(fileName)

    // Update item with new image_url
    const { error: updateError } = await supabase
      .from('items')
      .update({ image_url: publicUrlData.publicUrl })
      .eq('id', itemId)

    if (updateError) {
      console.error('Error updating item image_url:', updateError.message)
    } else {
      fetchItems()
    }

    setUploadingItemId(null)
  }

  const submitRating = async () => {
    if (!selectedItem?.id) return alert('Please select an item.')
    if (score < 1 || score > 100) return alert('Score must be 1–100.')
    if (!user?.id) return alert('You must be signed in.')

    const { error } = await supabase
      .from('ratings')
      .upsert(
        { item_id: selectedItem.id, user_id: user.id, score },
        { onConflict: ['user_id', 'item_id'] }
      )

    if (error) {
      console.error('Error submitting rating:', error.message)
      alert('Failed to submit rating.')
    } else {
      fetchItems()
      setSelectedItem(null)
    }
  }

  // Funktion för att skapa score-box med färg beroende på värdet
  function ScoreBox({ score }) {
    if (score === 'No ratings') {
      return <span style={{ color: '#888' }}>No ratings</span>
    }

    let bgColor = ''
    if (score >= 70) bgColor = '#4caf50' // grönt
    else if (score >= 40) bgColor = '#ffc107' // gult (samma gul som tema)
    else bgColor = '#f44336' // rött

    return (
      <div
        style={{
          display: 'inline-block',
          backgroundColor: bgColor,
          color: '#000',
          borderRadius: '6px',
          padding: '0.25rem 0.5rem',
          fontWeight: 'bold',
          minWidth: '40px',
          userSelect: 'none',
          marginTop: '0.5rem'
        }}
      >
        {score}
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '2rem',
        fontFamily: 'sans-serif',
        background: '#fffbea',
        minHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ color: '#ffc107' }}>🌟 Rate Anything</h1>

      <form onSubmit={addItem} style={{ marginBottom: '1.5rem' }}>
        <input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="New item"
          style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setNewItemImage(e.target.files[0])}
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
            color: '#000',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Adding…' : 'Add Item'}
        </button>
      </form>

      {selectedItem && (
        <div style={{ marginBottom: '2rem', padding: '1rem', background: '#fff3cd', borderRadius: '10px' }}>
          <h3>Rate: {selectedItem.name}</h3>
          <input
            type="number"
            min="1"
            max="100"
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            style={{ marginRight: '1rem', padding: '0.5rem', width: '80px' }}
          />
          <button
            onClick={submitRating}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffd54f',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Submit Rating
          </button>
          <button
            onClick={() => setSelectedItem(null)}
            style={{
              marginLeft: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#eee',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
          padding: 0,
          listStyle: 'none'
        }}
      >
        {items.map((i) => (
          <li
            key={i.id}
            style={{
              background: 'white',
              borderRadius: '10px',
              padding: '1rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            {i.image_url ? (
              <img
                src={i.image_url}
                alt={i.name}
                style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }}
                onClick={() => setSelectedItem(i)}
              />
            ) : (
              <div style={{ marginBottom: '0.5rem' }}>
                <label
                  htmlFor={`upload-${i.id}`}
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ffc107',
                    color: '#000',
                    borderRadius: '6px',
                    cursor: uploadingItemId === i.id ? 'wait' : 'pointer'
                  }}
                >
                  {uploadingItemId === i.id ? 'Uploading...' : 'Add Image'}
                </label>
                <input
                  type="file"
                  id={`upload-${i.id}`}
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={uploadingItemId === i.id}
                  onChange={(e) => uploadImageForItem(i.id, e.target.files[0])}
                />
              </div>
            )}

            <strong onClick={() => setSelectedItem(i)} style={{ userSelect: 'none' }}>
              {i.name}
            </strong>
            <br />
            <ScoreBox score={i.average} />
          </li>
        ))}
      </ul>
    </div>
  )
}
