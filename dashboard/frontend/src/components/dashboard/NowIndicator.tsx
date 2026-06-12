import { motion } from 'framer-motion'

interface Props {
  top: number
  labelWidth: number
}

export function NowIndicator({ top, labelWidth }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${top}px`,
        display: 'flex',
        alignItems: 'center',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      {/* Label */}
      <div style={{
        width: `${labelWidth}px`,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#d4943a',
            boxShadow: '0 0 8px rgba(212, 148, 58, 0.6)',
          }}
        />
      </div>

      {/* Line */}
      <div style={{
        flex: 1,
        height: '1px',
        background: 'linear-gradient(to right, #d4943a, rgba(212,148,58,0.15))',
      }} />
    </motion.div>
  )
}
