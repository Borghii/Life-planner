import { motion } from 'framer-motion'
import { useState } from 'react'
import { useLibraryStore } from '../../store/useLibraryStore'
import type { Apartado } from '../../api/types'

const COLORS = [
  '#7a9e87', '#7bafc4', '#9b8ec4', '#e8956d',
  '#c4a27b', '#7a9eb5', '#9e7a9e', '#c4c47a',
  '#7ab5a2', '#b57a7a', '#a2b57a', '#7a90b5',
]

interface Props {
  apartado: Apartado
  isSelected: boolean
  onSelect: () => void
}

export function ApartadoCard({ apartado, isSelected, onSelect }: Props) {
  const { updateApartado, deleteApartado } = useLibraryStore()
  const [editing, setEditing] = useState(false)
  const [nombre, setNombre] = useState(apartado.nombre)
  const [color, setColor] = useState(apartado.color)
  const cachedTasks = useLibraryStore((s) => s.tareas[apartado.id])
  const taskCountLabel = cachedTasks ? `${cachedTasks.length} tareas` : 'sin cargar'

  async function handleSave() {
    const trimmed = nombre.trim()
    if (!trimmed) return
    await updateApartado(apartado.id, { nombre: trimmed, color })
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm(`Eliminar "${apartado.nombre}" y todas sus tareas?`)) return
    await deleteApartado(apartado.id)
  }

  return (
    <motion.div
      layout
      style={{
        minHeight: editing ? 'auto' : '150px',
        background: isSelected
          ? `linear-gradient(180deg, ${apartado.color}22 0%, #1b1a18 100%)`
          : 'linear-gradient(180deg, #1a1917 0%, #161513 100%)',
        borderRadius: '14px',
        border: `1px solid ${isSelected ? `${apartado.color}66` : '#2e2b27'}`,
        boxShadow: isSelected ? `0 18px 42px ${apartado.color}14` : '0 10px 30px rgba(0, 0, 0, 0.18)',
        overflow: 'hidden',
      }}
    >
      {editing ? (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={eyebrowStyle}>Editar apartado</div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                onClick={() => setColor(swatch)}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  background: swatch,
                  border: color === swatch ? '2px solid #f0e6d3' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setEditing(false); setNombre(apartado.nombre); setColor(apartado.color) }} style={ghostBtn}>
              Cancelar
            </button>
            <button onClick={handleSave} style={primaryBtn}>
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onSelect}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            minHeight: '150px',
            padding: '16px',
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '999px',
                  background: apartado.color,
                  boxShadow: `0 0 0 6px ${apartado.color}20`,
                  flexShrink: 0,
                  marginTop: '8px',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={eyebrowStyle}>Apartado</div>
                <div style={titleStyle}>{apartado.nombre}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setEditing(true)} style={toolBtn}>
                editar
              </button>
              <button onClick={handleDelete} style={{ ...toolBtn, color: '#c45a3a' }}>
                borrar
              </button>
            </div>
          </div>

          <div style={{ color: '#8b7e70', fontSize: '13px', lineHeight: 1.45 }}>
            {isSelected
              ? 'Abierto en el panel de detalle para editar tareas y acciones.'
              : 'Toca para abrir este apartado y trabajar sus tareas sin encerrar la biblioteca.'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginTop: 'auto' }}>
            <span style={metaPill}>{taskCountLabel}</span>
            <span
              style={{
                ...metaPill,
                color: isSelected ? '#f0e6d3' : '#7a6e61',
                borderColor: isSelected ? `${apartado.color}66` : '#332f2a',
                background: isSelected ? `${apartado.color}1c` : '#201e1b',
              }}
            >
              {isSelected ? 'activo' : 'abrir'}
            </span>
          </div>
        </button>
      )}
    </motion.div>
  )
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontFamily: "'JetBrains Mono', monospace",
}

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  color: '#f0e6d3',
  lineHeight: 1.1,
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#211f1c',
  border: '1px solid #d4943a',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '14px',
  color: '#f0e6d3',
  outline: 'none',
  marginTop: '2px',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
}

const metaPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 9px',
  borderRadius: '999px',
  border: '1px solid #332f2a',
  background: '#1f1d1a',
  color: '#8b7e70',
  fontSize: '10px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

const toolBtn: React.CSSProperties = {
  background: '#211f1c',
  border: '1px solid #332f2a',
  color: '#7a6e61',
  borderRadius: '999px',
  padding: '4px 9px',
  cursor: 'pointer',
  fontSize: '10px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

const ghostBtn: React.CSSProperties = {
  background: '#211f1c',
  border: '1px solid #332f2a',
  color: '#7a6e61',
  borderRadius: '999px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
}

const primaryBtn: React.CSSProperties = {
  background: '#d4943a',
  border: 'none',
  color: '#11100e',
  borderRadius: '999px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
}
