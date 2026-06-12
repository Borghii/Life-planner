import { motion } from 'framer-motion'
import { useGreeting } from '../../hooks/useGreeting'
import { useClock } from '../../hooks/useClock'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAYS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

interface Props {
  nombre?: string
}

export function HeroGreeting({ nombre }: Props) {
  const greeting = useGreeting(nombre)
  const now = useClock(60000)
  const dayName = DAYS_ES[now.getDay()]
  const dateStr = `${dayName}, ${now.getDate()} de ${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ marginBottom: 0 }}
    >
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '28px',
        fontWeight: 300,
        color: '#f0e6d3',
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      }}>
        {greeting}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        color: '#7a6e61',
        letterSpacing: '0.05em',
        marginTop: '4px',
        textTransform: 'lowercase',
      }}>
        {dateStr}
      </div>
    </motion.div>
  )
}
