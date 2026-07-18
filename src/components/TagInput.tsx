import { useState, type KeyboardEvent } from 'react'
import { XIcon } from './Icons'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  autoFocus?: boolean
}

export function TagInput({ tags, onChange, placeholder = '添加标签', autoFocus = false }: TagInputProps) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const trimmed = input.trim().replace(/^#/, '')
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span key={tag} className="editable-tag">#{tag}<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}><XIcon /></button></span>
      ))}
      <input type="text" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} onBlur={addTag} placeholder={tags.length ? '' : placeholder} aria-label={placeholder} autoFocus={autoFocus} />
    </div>
  )
}
