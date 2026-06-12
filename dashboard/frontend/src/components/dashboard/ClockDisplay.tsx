import { motion } from 'framer-motion'
import { useClock } from '../../hooks/useClock'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

interface Props {
  compact?: boolean
}

export function ClockDisplay({ compact = false }: Props) {
  const now = useClock(1000)
  const hours = pad(now.getHours())
  const minutes = pad(now.getMinutes())
  const seconds = pad(now.getSeconds())

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px',
          padding: '10px 12px 11px',
          borderRadius: '14px',
          border: '1px solid #26231f',
          background: 'linear-gradient(180deg, rgba(31, 28, 24, 0.92) 0%, rgba(22, 20, 18, 0.98) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#7a6e61',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Hora
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px',
          color: '#f0e6d3',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '22px',
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {hours}:{minutes}
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: '#d4943a',
            letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            :{seconds}
          </span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '14px',
        padding: '10px 12px 11px',
        borderRadius: '14px',
        border: '1px solid #26231f',
        background: 'linear-gradient(180deg, rgba(31, 28, 24, 0.92) 0%, rgba(22, 20, 18, 0.98) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#7a6e61',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '5px',
        }}>
          Hora actual
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          color: '#f0e6d3',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '30px',
            letterSpacing: '-0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {hours}:{minutes}
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: '#d4943a',
            letterSpacing: '0.08em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            :{seconds}
          </span>
        </div>
      </div>

      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '18px',
        color: '#c8a97e',
        lineHeight: 1,
        flexShrink: 0,
      }}>
        {now.getHours() >= 12 ? 'PM' : 'AM'}
      </div>
    </motion.div>
  )
}
