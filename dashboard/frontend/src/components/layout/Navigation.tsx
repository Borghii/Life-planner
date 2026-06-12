import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEconomyStore } from '../../store/useEconomyStore'

const links = [
  { to: '/', label: 'Hoy' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/recompensas', label: 'Recompensas' },
  { to: '/planificacion', label: 'Planificación' },
  { to: '/biblioteca', label: 'Biblioteca' },
  { to: '/horarios', label: 'Horarios' },
  { to: '/historial', label: 'Historial' },
]

export function Navigation() {
  const { pathname } = useLocation()
  const balance = useEconomyStore((state) => state.balance)

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: '52px',
        background: 'rgba(15, 14, 13, 0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #2e2b27',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '4px',
      }}
    >
      {/* Logo */}
      <span style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: '18px',
        fontWeight: 400,
        color: '#d4943a',
        letterSpacing: '-0.02em',
        marginRight: '32px',
        flexShrink: 0,
      }}>
        Life Planner
      </span>

      {/* Nav links */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0, gap: '2px', overflowX: 'auto' }}>
        {links.map(({ to, label }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              style={{
                position: 'relative',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: isActive ? '#f0e6d3' : '#7a6e61',
                textDecoration: 'none',
                transition: 'color 0.2s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#c8a97e'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#7a6e61'
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-pill"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '6px',
                    background: '#211f1c',
                    border: '1px solid #2e2b27',
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>
            </Link>
          )
        })}
      </div>

      <Link
        to="/recompensas"
        style={{
          marginLeft: 'auto',
          flexShrink: 0,
          padding: '5px 10px',
          border: `1px solid ${balance < 0 ? '#7d493b' : '#4a3923'}`,
          borderRadius: '999px',
          background: balance < 0 ? '#251612' : '#211a11',
          color: balance < 0 ? '#d98a70' : '#f0b855',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          textDecoration: 'none',
        }}
      >
        {balance} pts
      </Link>
    </nav>
  )
}
