'use client'

interface AmountInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
}

export function AmountInput({
  value, onChange, placeholder = '0', disabled
}: AmountInputProps) {
  return (
    <div className="relative">
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        color: '#4a6178', fontSize: '0.875rem', fontWeight: 500, pointerEvents: 'none',
      }}>₹</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          paddingLeft: 28,
          backgroundColor: '#0f1a27',
          border: '1px solid #1e2d40',
          color: '#c9d5e0',
          borderRadius: 8,
          padding: '8px 12px 8px 28px',
          fontSize: '0.875rem',
          width: '100%',
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)' }}
        onBlur={e => { e.target.style.borderColor = '#1e2d40'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}
