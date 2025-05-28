// src/ImageUploader.jsx
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ImageUploader({ itemId, onComplete }) {
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `item-${itemId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase
        .storage.from('item-images').upload(fileName, file, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData, error: urlErr } = supabase
        .storage.from('item-images').getPublicUrl(fileName)
      if (urlErr) throw urlErr

      const { error: dbErr } = await supabase
        .from('items')
        .update({ image_url: urlData.publicUrl })
        .eq('id', itemId)
      if (dbErr) throw dbErr

      onComplete(itemId, urlData.publicUrl)
    } catch (err) {
      console.error('Upload failed', err)
      alert('Image upload failed; see console for details.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="placeholder">
      <label htmlFor={`upload-${itemId}`}>{uploading ? 'Uploading…' : 'Add Image'}</label>
      <input
        id={`upload-${itemId}`}
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={handleFile}
      />
    </div>
  )
}
