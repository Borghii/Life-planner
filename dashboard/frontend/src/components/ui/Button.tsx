import { motion } from 'framer-motion'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

export function Button({ variant = 'secondary', size = 'md', children, className, style, ...props }: Props) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    borderRadius: '6px',
    letterSpacing: '0.01em',
    transition: 'background 0.15s, color 0.15s, opacity 0.15s',
    fontSize: size === 'sm' ? '12px' : '13px',
    padding: size === 'sm' ? '5px 10px' : '7px 14px',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: '#d4943a',
      color: '#0f0e0d',
    },
    secondary: {
      background: '#211f1c',
      color: '#c8a97e',
      border: '1px solid #2e2b27',
    },
    ghost: {
      background: 'transparent',
      color: '#7a6e61',
    },
    danger: {
      background: '#4a2218',
      color: '#c45a3a',
    },
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ opacity: 0.85 }}
      style={{ ...base, ...variants[variant], ...style }}
      className={className}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  )
}
