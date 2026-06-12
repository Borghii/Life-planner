import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: number
}

export function Modal({ open, onClose, title, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 100,
              backdropFilter: 'blur(4px)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 101,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
              style={{
                pointerEvents: 'auto',
                width: '100%',
                maxWidth: `${width}px`,
                maxHeight: 'calc(100vh - 32px)',
                background: '#1a1917',
                border: '1px solid #2e2b27',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {title && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #2e2b27',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: '18px',
                      color: '#f0e6d3',
                    }}
                  >
                    {title}
                  </span>
                  <button
                    onClick={onClose}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#7a6e61',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '4px',
                      lineHeight: 1,
                    }}
                  >
                    {'\u2715'}
                  </button>
                </div>
              )}

              <div style={{ padding: '20px', overflowY: 'auto' }}>
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
