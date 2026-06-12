import { motion } from 'framer-motion'

interface Props {
  total: number
  done: number
  pct: number
}

export function DayProgressRing({ total, done, pct }: Props) {
  const SIZE = 96
  const strokeWidth = 5
  const R = (SIZE - strokeWidth) / 2
  const circumference = 2 * Math.PI * R

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        background: '#1a1917',
        borderRadius: '10px',
        border: '1px solid #2e2b27',
        marginBottom: '12px',
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#211f1c"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={pct === 100 ? '#5a8a6a' : '#d4943a'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (pct / 100) * circumference }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        {/* Percentage text */}
        <text
          x={SIZE / 2}
          y={SIZE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f0e6d3"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="16"
          fontWeight="500"
        >
          {pct}%
        </text>
      </svg>

      <div>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '22px',
          fontWeight: 300,
          color: '#f0e6d3',
          lineHeight: 1.1,
        }}>
          {done} <span style={{ color: '#7a6e61', fontSize: '14px' }}>de</span> {total}
        </div>
        <div style={{
          fontSize: '11px',
          color: '#7a6e61',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginTop: '2px',
        }}>
          tareas hoy
        </div>
        {pct === 100 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              marginTop: '4px',
              fontSize: '11px',
              color: '#8ab89a',
              letterSpacing: '0.05em',
            }}
          >
            ✦ jornada completa
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
