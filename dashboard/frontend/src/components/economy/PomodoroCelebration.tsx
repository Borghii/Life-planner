import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, type CSSProperties } from 'react'
import type { PomodoroCompletionEvent } from '../../store/usePomodoroStore'
import { CoinAmount, CoinIcon } from './CoinAmount'

interface Props {
  event: PomodoroCompletionEvent | null
  onClose: () => void
}

const PARTICLES = [
  { x: -104, y: -76, rotate: -28, delay: 0.04 },
  { x: -75, y: -116, rotate: 18, delay: 0.1 },
  { x: -24, y: -130, rotate: -12, delay: 0.16 },
  { x: 44, y: -126, rotate: 32, delay: 0.08 },
  { x: 92, y: -89, rotate: -20, delay: 0.14 },
  { x: 112, y: -32, rotate: 26, delay: 0.2 },
  { x: -118, y: -22, rotate: -36, delay: 0.18 },
  { x: 78, y: 2, rotate: 14, delay: 0.24 },
]

export function PomodoroCelebration({ event, onClose }: Props) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!event) return
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onClose()
    }
    const timeout = window.setTimeout(onClose, event.type === 'task' ? 6500 : 4200)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [event, onClose])

  return (
    <AnimatePresence>
      {event ? (
        <motion.div
          key={event.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pomodoro-celebration-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={backdrop}
        >
          <motion.section
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
            style={card}
          >
            <div style={halo} />
            {!reduceMotion ? PARTICLES.map((particle, index) => (
              <motion.span
                key={`${event.id}-${index}`}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: particle.x,
                  y: particle.y,
                  scale: [0.4, 1, 0.7],
                  rotate: particle.rotate,
                }}
                transition={{ duration: 1.15, delay: particle.delay, ease: 'easeOut' }}
                style={particleStyle}
              />
            )) : null}

            <motion.div
              initial={reduceMotion ? false : { scale: 0.3, rotate: -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.08 }}
              style={coinWrap}
            >
              <CoinIcon size={92} />
            </motion.div>

            <div style={kicker}>
              {event.type === 'task' ? 'Recompensa acreditada' : 'Bloque completado'}
            </div>
            <h2 id="pomodoro-celebration-title" style={title}>
              {event.type === 'task' ? 'Tarea completada' : 'Foco completado'}
            </h2>
            <p style={taskName}>{event.taskName ?? 'Pomodoro libre'}</p>

            {event.type === 'task' && event.coinsDelta > 0 ? (
              <>
                <div style={coinsReward}>
                  <span style={wonLabel}>Ganaste</span>
                  <CoinAmount value={event.coinsDelta} showSign size="large" />
                </div>
                <div style={newBalance}>
                  Nuevo saldo
                  <CoinAmount value={event.balance} size="small" />
                </div>
              </>
            ) : (
              <p style={focusMessage}>
                {event.type === 'task'
                  ? 'La tarea ya estaba acreditada. Tu saldo no cambio.'
                  : `Completaste ${event.completedFocusSessions} de ${event.totalFocusSessions}. El descanso ya empezo.`}
              </p>
            )}

            <button type="button" onClick={onClose} style={continueButton}>
              Seguir al descanso
            </button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 120,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'rgba(7, 6, 5, 0.76)',
  backdropFilter: 'blur(7px)',
}

const card: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 430px)',
  minHeight: 430,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '38px 28px 28px',
  border: '1px solid #6b4a22',
  borderRadius: 18,
  overflow: 'hidden',
  background: 'radial-gradient(circle at 50% 18%, rgba(240,184,85,0.18), transparent 35%), linear-gradient(155deg, #241d14 0%, #171411 58%, #100f0d 100%)',
  boxShadow: '0 30px 90px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,226,166,0.1)',
  textAlign: 'center',
}

const halo: CSSProperties = {
  position: 'absolute',
  top: 34,
  width: 210,
  height: 210,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(240,184,85,0.2), rgba(240,184,85,0.04) 48%, transparent 70%)',
  filter: 'blur(2px)',
  pointerEvents: 'none',
}

const particleStyle: CSSProperties = {
  position: 'absolute',
  top: 138,
  left: '50%',
  width: 7,
  height: 14,
  borderRadius: 2,
  background: 'linear-gradient(180deg, #ffe09a, #d4943a)',
  pointerEvents: 'none',
}

const coinWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginBottom: 18,
  filter: 'drop-shadow(0 16px 22px rgba(212,148,58,0.28))',
}

const kicker: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  color: '#d4943a',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

const title: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  margin: '7px 0 0',
  color: '#f0e6d3',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 42,
  fontWeight: 400,
  lineHeight: 0.95,
}

const taskName: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: 330,
  margin: '11px 0 0',
  color: '#a69380',
  fontSize: 13,
  lineHeight: 1.4,
}

const coinsReward: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 238,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  marginTop: 22,
  padding: '13px 18px',
  border: '1px solid rgba(240,184,85,0.3)',
  borderRadius: 999,
  background: 'rgba(42,30,13,0.82)',
  boxShadow: 'inset 0 1px 0 rgba(255,226,166,0.08)',
}

const wonLabel: CSSProperties = {
  color: '#c8a97e',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 22,
}

const newBalance: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 12,
  color: '#6f655a',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const focusMessage: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: 320,
  margin: '20px 0 0',
  color: '#c8a97e',
  fontSize: 13,
  lineHeight: 1.55,
}

const continueButton: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: 24,
  padding: '10px 18px',
  border: '1px solid #d4943a',
  borderRadius: 8,
  background: '#d4943a',
  color: '#100f0d',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}
