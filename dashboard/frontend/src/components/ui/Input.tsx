interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, style, ...props }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{
          fontSize: '11px',
          color: '#7a6e61',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 500,
        }}>
          {label}
        </label>
      )}
      <input
        style={{
          background: '#211f1c',
          border: '1px solid #2e2b27',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '13px',
          color: '#f0e6d3',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          outline: 'none',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#d4943a'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#2e2b27'
        }}
        {...props}
      />
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: React.ReactNode
}

export function Select({ label, children, style, ...props }: SelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{
          fontSize: '11px',
          color: '#7a6e61',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 500,
        }}>
          {label}
        </label>
      )}
      <select
        style={{
          background: '#211f1c',
          border: '1px solid #2e2b27',
          borderRadius: '6px',
          padding: '8px 12px',
          fontSize: '13px',
          color: '#f0e6d3',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          outline: 'none',
          cursor: 'pointer',
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
