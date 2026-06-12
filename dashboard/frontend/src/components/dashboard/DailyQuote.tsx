import { motion } from 'framer-motion'
import { useDailyQuote } from '../../hooks/useDailyQuote'

export function DailyQuote() {
  const quote = useDailyQuote()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      style={{
        padding: '12px 14px',
        borderLeft: '2px solid #2a1e0d',
        marginBottom: '16px',
      }}
    >
      <p style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '14px',
        fontStyle: 'italic',
        color: '#7a6e61',
        margin: 0,
        lineHeight: 1.5,
        fontWeight: 300,
      }}>
        "{quote}"
      </p>
    </motion.div>
  )
}
