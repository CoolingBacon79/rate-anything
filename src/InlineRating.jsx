// src/InlineRating.jsx
import { useState, useEffect } from 'react'

export default function InlineRating({ itemId, initialScore, onSubmit, onEditDone }) {
  const [score, setScore] = useState(initialScore ?? '')

  useEffect(() => {
    setScore(initialScore ?? '')
  }, [initialScore])

  return (
    <div className="inline-edit">
      <input
        type="number"
        min="0"
        max="100"
        value={score}
        onChange={e => setScore(e.target.value)}
      />
      <button
        onClick={() => {
          onSubmit(itemId, Number(score))
          onEditDone()
        }}
      >
        Submit
      </button>
    </div>
  )
}