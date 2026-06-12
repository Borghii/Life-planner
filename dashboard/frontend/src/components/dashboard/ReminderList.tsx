import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboardStore } from '../../store/useDashboardStore'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DAYS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`
}

interface Props {
  selectedDate?: string | null
  onClearDate?: () => void
}

export function ReminderList({ selectedDate, onClearDate }: Props) {
  const { reminders, removeReminder, addReminder } = useDashboardStore()
  const [open, setOpen] = useState(false)
  const [fecha, setFecha] = useState('')
  const [texto, setTexto] = useState('')

  function openModal(prefillDate?: string) {
    setFecha(prefillDate ?? '')
    setTexto('')
    setOpen(true)
  }

  async function handleAdd() {
    if (!fecha || !texto.trim()) return
    await addReminder(fecha, texto.trim())
    setFecha('')
    setTexto('')
    setOpen(false)
  }

  // Si hay un día seleccionado, mostramos solo los de ese día
  const displayed = selectedDate
    ? reminders.filter((r) => r.fecha === selectedDate)
    : reminders

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: '#7a6e61', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            Recordatorios
          </span>
          {selectedDate && (
            <button
              onClick={onClearDate}
              style={{ fontSize: '9px', color: '#5a7ab5', background: 'none', border: '1px solid #5a7ab544', borderRadius: '4px', padding: '1px 6px', cursor: 'pointer' }}
            >
              {formatDateLabel(selectedDate)} ×
            </button>
          )}
        </div>
        <button
          onClick={() => openModal(selectedDate ?? undefined)}
          style={{ background: 'none', border: '1px solid #2e2b27', borderRadius: '4px', color: '#7a6e61', cursor: 'pointer', fontSize: '11px', padding: '2px 8px' }}
        >
          + nuevo
        </button>
      </div>

      <AnimatePresence mode="popLayout">
        {displayed.length === 0 && (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ fontSize: '12px', color: '#3d3830', margin: 0, fontStyle: 'italic' }}
          >
            {selectedDate ? 'Sin recordatorios este día' : 'Sin recordatorios este mes'}
          </motion.p>
        )}
        {displayed.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: '4px', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 8px', background: '#1a1917', borderRadius: '6px', border: '1px solid #2e2b27' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#f0e6d3' }}>{r.texto}</div>
                {!selectedDate && (
                  <div style={{ fontSize: '10px', color: '#5a7ab5', fontFamily: "'JetBrains Mono', monospace", marginTop: '2px' }}>
                    {formatDateLabel(r.fecha)}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeReminder(r.id)}
                style={{ background: 'none', border: 'none', color: '#3d3830', cursor: 'pointer', fontSize: '12px', padding: '0', lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo recordatorio">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Input
            label="Texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="¿Qué querés recordar?"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <Button variant="primary" onClick={handleAdd}>Guardar</Button>
        </div>
      </Modal>
    </div>
  )
}
