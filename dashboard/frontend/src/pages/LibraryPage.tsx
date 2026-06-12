import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore } from '../store/useLibraryStore'
import { ApartadoCard } from '../components/library/ApartadoCard'
import { TaskList } from '../components/library/TaskList'

const COLORS = ['#7a9e87', '#7bafc4', '#9b8ec4', '#e8956d', '#c4a27b', '#7a9eb5']
const DESKTOP_BREAKPOINT = 1100
const LIBRARY_SURFACE_WIDTH = 'min(100%, 1460px)'
const DETAIL_PANEL_WIDTH = '390px'

export function LibraryPage() {
  const {
    apartados,
    selectedId,
    fetchApartados,
    createApartado,
    selectApartado,
    loadingApartados,
  } = useLibraryStore()

  const [showNew, setShowNew] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < DESKTOP_BREAKPOINT : false
  )

  useEffect(() => {
    fetchApartados()
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsCompact(window.innerWidth < DESKTOP_BREAKPOINT)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const hasValidSelection = selectedId !== null && apartados.some((apartado) => apartado.id === selectedId)

    if (!isCompact && apartados.length > 0 && !hasValidSelection) {
      selectApartado(apartados[0].id)
      return
    }

    if (apartados.length === 0 && selectedId !== null) {
      selectApartado(null)
    }
  }, [apartados, isCompact, selectedId, selectApartado])

  const selectedApartado = apartados.find((apartado) => apartado.id === selectedId) ?? null
  const shouldRenderDetail = !isCompact || Boolean(selectedApartado) || apartados.length === 0

  async function handleCreate() {
    const trimmed = newNombre.trim()
    if (!trimmed) return

    const created = await createApartado({ nombre: trimmed, color: newColor, orden: apartados.length })
    setNewNombre('')
    setNewColor(COLORS[0])
    setShowNew(false)
    selectApartado(created.id)
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px 24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ width: LIBRARY_SURFACE_WIDTH, margin: '0 auto 28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <h1 style={pageTitle}>Biblioteca</h1>
            <p style={pageSubtitle}>
              Apartados a la vista. Tareas y acciones en un panel aparte para usar mejor el ancho.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={infoChip}>
              <span style={chipLabel}>apartados</span>
              <span style={chipValue}>{apartados.length}</span>
            </div>
            <div style={infoChip}>
              <span style={chipLabel}>seleccion</span>
              <span style={{ ...chipValue, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedApartado?.nombre ?? 'ninguna'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        layout
        transition={{ layout: { duration: 0.28, ease: 'easeInOut' } }}
        style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : `minmax(0, 1fr) ${DETAIL_PANEL_WIDTH}`,
          gap: '24px',
          width: LIBRARY_SURFACE_WIDTH,
          margin: '0 auto',
          alignItems: 'start',
        }}
      >
        <motion.section layout style={libraryColumnStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div>
              <div style={sectionLabel}>Coleccion</div>
              <div style={sectionTitle}>Apartados</div>
            </div>
            <div style={sectionHint}>
              {isCompact ? 'Selecciona un apartado para ver el detalle abajo.' : 'Selecciona un apartado y trabajalo en el panel derecho.'}
            </div>
          </div>

          {loadingApartados && apartados.length === 0 ? (
            <div style={loadingStyle}>Cargando biblioteca...</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
                gap: '14px',
              }}
            >
              <AnimatePresence initial={false}>
                {apartados.map((apartado) => (
                  <motion.div
                    key={apartado.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.24 }}
                  >
                    <ApartadoCard
                      apartado={apartado}
                      isSelected={selectedId === apartado.id}
                      onSelect={() => selectApartado(apartado.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {showNew ? (
                  <motion.div
                    key="new-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={newCardStyle}
                  >
                    <div style={sectionLabel}>Nuevo apartado</div>
                    <input
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                      placeholder="Nombre del apartado..."
                      autoFocus
                      style={newInputStyle}
                    />

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewColor(color)}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '999px',
                            background: color,
                            border: newColor === color ? '2px solid #f0e6d3' : '2px solid transparent',
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                          }}
                        />
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button onClick={() => setShowNew(false)} style={secondaryBtn}>
                        Cancelar
                      </button>
                      <button onClick={handleCreate} style={createBtn}>
                        Crear
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="new-cta"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={() => setShowNew(true)}
                    style={newApartadoCta}
                  >
                    <span style={sectionLabel}>Nuevo apartado</span>
                    <span style={{ ...sectionTitle, marginTop: '4px' }}>Agregar uno mas</span>
                    <span style={{ color: '#8b7e70', fontSize: '13px', lineHeight: 1.45, marginTop: 'auto' }}>
                      Crea un apartado nuevo sin encerrar toda la biblioteca en una sola columna.
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.section>

        <AnimatePresence mode="wait">
          {shouldRenderDetail && (
            <motion.aside
              key={selectedApartado?.id ?? 'empty'}
              initial={{ opacity: 0, x: isCompact ? 0 : 18, y: isCompact ? 12 : 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: isCompact ? 0 : 18, y: isCompact ? 12 : 0 }}
              transition={{ duration: 0.24 }}
              style={{
                position: isCompact ? 'relative' : 'sticky',
                top: isCompact ? undefined : '24px',
                width: isCompact ? '100%' : DETAIL_PANEL_WIDTH,
                ...detailPanelStyle,
              }}
            >
              {selectedApartado ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '18px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={sectionLabel}>Detalle activo</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '999px',
                            background: selectedApartado.color,
                            boxShadow: `0 0 0 6px ${selectedApartado.color}20`,
                            flexShrink: 0,
                          }}
                        />
                        <h2 style={detailTitle}>{selectedApartado.nombre}</h2>
                      </div>
                      <p style={detailSubtitle}>
                        Tareas y acciones del apartado seleccionado. Todo el detalle vive aca, sin romper la grilla.
                      </p>
                    </div>

                    {isCompact && (
                      <button onClick={() => selectApartado(null)} style={secondaryBtn}>
                        Cerrar
                      </button>
                    )}
                  </div>

                  <TaskList apartadoId={selectedApartado.id} />
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={sectionLabel}>Detalle</div>
                  <div style={detailTitle}>Sin apartado abierto</div>
                  <p style={detailSubtitle}>
                    {apartados.length === 0
                      ? 'Crea tu primer apartado para empezar a cargar tareas y acciones.'
                      : 'Selecciona un apartado para abrir su panel de detalle.'}
                  </p>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

const pageTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '36px',
  fontWeight: 300,
  color: '#f0e6d3',
  margin: 0,
  letterSpacing: '-0.02em',
}

const pageSubtitle: React.CSSProperties = {
  color: '#7a6e61',
  fontSize: '13px',
  margin: '6px 0 0',
}

const infoChip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  borderRadius: '999px',
  border: '1px solid #2f2b26',
  background: '#191816',
}

const chipLabel: React.CSSProperties = {
  fontSize: '10px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

const chipValue: React.CSSProperties = {
  fontSize: '11px',
  color: '#d4943a',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

const libraryColumnStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(27, 25, 22, 0.92) 0%, rgba(20, 19, 17, 0.98) 100%)',
  borderRadius: '20px',
  border: '1px solid #26231f',
  padding: '18px',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '28px',
  color: '#f0e6d3',
  lineHeight: 1.05,
}

const sectionHint: React.CSSProperties = {
  color: '#8b7e70',
  fontSize: '12px',
  maxWidth: '320px',
  lineHeight: 1.45,
}

const loadingStyle: React.CSSProperties = {
  color: '#7a6e61',
  fontSize: '13px',
  padding: '32px 18px',
  textAlign: 'center',
  borderRadius: '14px',
  border: '1px dashed #2f2b26',
  background: '#171614',
}

const newCardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #1c1a17 0%, #171513 100%)',
  borderRadius: '14px',
  border: '1px solid #d4943a33',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  minHeight: '150px',
}

const newInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#211f1c',
  border: '1px solid #d4943a',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '14px',
  color: '#f0e6d3',
  outline: 'none',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
}

const secondaryBtn: React.CSSProperties = {
  background: '#211f1c',
  border: '1px solid #332f2a',
  borderRadius: '999px',
  color: '#7a6e61',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
}

const createBtn: React.CSSProperties = {
  background: '#d4943a',
  border: 'none',
  borderRadius: '999px',
  color: '#11100e',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
}

const newApartadoCta: React.CSSProperties = {
  background: 'linear-gradient(180deg, #181715 0%, #151412 100%)',
  border: '1px dashed #3b352d',
  borderRadius: '14px',
  minHeight: '150px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  textAlign: 'left',
  color: '#f0e6d3',
  cursor: 'pointer',
}

const detailPanelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(27, 25, 22, 0.95) 0%, rgba(17, 16, 14, 0.98) 100%)',
  borderRadius: '20px',
  border: '1px solid #26231f',
  padding: '18px',
  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22)',
}

const detailTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '28px',
  color: '#f0e6d3',
  lineHeight: 1.05,
}

const detailSubtitle: React.CSSProperties = {
  margin: 0,
  color: '#8b7e70',
  fontSize: '13px',
  lineHeight: 1.5,
}
