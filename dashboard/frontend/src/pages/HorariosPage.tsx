import { motion } from 'framer-motion'

const horariosSrc = `${import.meta.env.BASE_URL}horarios.jpeg`

export function HorariosPage() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        minHeight: 'calc(100vh - 52px)',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <img
        src={horariosSrc}
        alt="Horarios"
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 100px)',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          borderRadius: '8px',
          border: '1px solid #2e2b27',
          background: '#0f0e0d',
        }}
      />
    </motion.main>
  )
}
