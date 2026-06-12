import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore } from '../../store/useLibraryStore'
import { ejecutarAccion } from '../../api/library'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input, Select } from '../ui/Input'

interface ActionModalState {
  open: boolean
  tareaId: number | null
  editId: number | null
}

interface Props {
  apartadoId: number
}

export function TaskList({ apartadoId }: Props) {
  const {
    tareas,
    acciones,
    fetchTareas,
    createTarea,
    updateTarea,
    deleteTarea,
    fetchAcciones,
    createAccion,
    updateAccion,
    deleteAccion,
    loadingTareas,
  } = useLibraryStore()

  const taskList = tareas[apartadoId]
  const currentTasks = taskList ?? []

  const [newNombre, setNewNombre] = useState('')
  const [newPrio, setNewPrio] = useState(3)
  const [newPomos, setNewPomos] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [expandedTask, setExpandedTask] = useState<number | null>(null)
  const [editingTask, setEditingTask] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editPrio, setEditPrio] = useState(3)
  const [editPomos, setEditPomos] = useState(1)
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, tareaId: null, editId: null })
  const [acLabel, setAcLabel] = useState('')
  const [acTipo, setAcTipo] = useState<'url' | 'app' | 'file'>('url')
  const [acValor, setAcValor] = useState('')

  useEffect(() => {
    if (!taskList) fetchTareas(apartadoId)
  }, [apartadoId, taskList, fetchTareas])

  async function handleCreate() {
    const trimmed = newNombre.trim()
    if (!trimmed) return
    await createTarea({ apartado_id: apartadoId, nombre: trimmed, prioridad: newPrio, pomodoros: newPomos })
    setNewNombre('')
    setNewPrio(3)
    setNewPomos(1)
    setShowForm(false)
  }

  async function handleUpdate(id: number) {
    const trimmed = editNombre.trim()
    if (!trimmed) return
    await updateTarea(id, { nombre: trimmed, prioridad: editPrio, pomodoros: editPomos })
    setEditingTask(null)
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar esta tarea?')) return
    await deleteTarea(id)
    if (expandedTask === id) setExpandedTask(null)
  }

  async function handleExecuteAction(actionId: number) {
    try {
      await ejecutarAccion(actionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      window.alert(`No se pudo ejecutar accion: ${message}`)
    }
  }

  function ensureActionsLoaded(tareaId: number) {
    if (!acciones[tareaId]) {
      void fetchAcciones(tareaId)
    }
  }

  function toggleActions(tareaId: number) {
    ensureActionsLoaded(tareaId)
    setExpandedTask((current) => (current === tareaId ? null : tareaId))
  }

  function startCreatingAction(tareaId: number) {
    ensureActionsLoaded(tareaId)
    setExpandedTask(tareaId)
    openActionModal(tareaId)
  }

  function openActionModal(tareaId: number, editId?: number) {
    const action = editId ? acciones[tareaId]?.find((item) => item.id === editId) : null
    setAcLabel(action?.label ?? '')
    setAcTipo(action?.tipo ?? 'url')
    setAcValor(action?.valor ?? '')
    setActionModal({ open: true, tareaId, editId: editId ?? null })
  }

  async function handleSaveAction() {
    const { tareaId, editId } = actionModal
    if (!tareaId) return

    const label = acLabel.trim()
    const value = acValor.trim()
    if (!label || !value) return

    if (editId) {
      await updateAccion(editId, { label, tipo: acTipo, valor: value })
    } else {
      await createAccion({ tarea_id: tareaId, label, tipo: acTipo, valor: value })
    }

    setExpandedTask(tareaId)
    setActionModal({ open: false, tareaId: null, editId: null })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={sectionMeta}>{currentTasks.length} tareas</span>
        {!showForm && (
          <button onClick={() => setShowForm(true)} style={addTaskBtn}>
            + nueva tarea
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={formCard}
          >
            <Input
              label="Nombre"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Nombre de la tarea..."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <Select label="Prioridad" value={newPrio} onChange={(e) => setNewPrio(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>P{p}</option>)}
              </Select>
              <div>
                <div style={formLabel}>Horas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => setNewPomos(Math.max(1, newPomos - 1))} style={stepBtn}>-</button>
                  <span style={hoursValue}>{newPomos}h</span>
                  <button onClick={() => setNewPomos(newPomos + 1)} style={stepBtn}>+</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={ghostBtn}>
                Cancelar
              </button>
              <button onClick={handleCreate} style={primaryBtn}>
                Crear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loadingTareas && !taskList && (
        <div style={emptyStateStyle}>Cargando tareas...</div>
      )}

      {!loadingTareas && taskList && currentTasks.length === 0 && (
        <div style={emptyStateStyle}>
          Este apartado todavia no tiene tareas. Agrega la primera desde este panel.
        </div>
      )}

      <AnimatePresence initial={false}>
        {currentTasks.map((task) => {
          const taskActions = acciones[task.id] ?? []
          const isExpanded = expandedTask === task.id
          const isEditing = editingTask === task.id

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={taskCard}
            >
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Input
                    label="Nombre"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    placeholder="Nombre de la tarea..."
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                    <Select label="Prioridad" value={editPrio} onChange={(e) => setEditPrio(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>P{p}</option>)}
                    </Select>
                    <div>
                      <div style={formLabel}>Horas</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => setEditPomos(Math.max(1, editPomos - 1))} style={stepBtn}>-</button>
                        <span style={hoursValue}>{editPomos}h</span>
                        <button onClick={() => setEditPomos(editPomos + 1)} style={stepBtn}>+</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => setEditingTask(null)} style={ghostBtn}>
                      Cancelar
                    </button>
                    <button onClick={() => handleUpdate(task.id)} style={primaryBtn}>
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={priorityStyle(task.prioridad)}>P{task.prioridad}</span>
                        <span style={hoursTag}>{task.pomodoros}h</span>
                      </div>
                      <div style={{ color: '#f0e6d3', fontSize: '14px', lineHeight: 1.4 }}>
                        {task.nombre}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => toggleActions(task.id)}
                        style={{ ...toolBtn, color: isExpanded ? '#d4943a' : '#7a6e61' }}
                      >
                        {isExpanded ? 'cerrar' : 'acciones'}
                      </button>
                      <button
                        onClick={() => startCreatingAction(task.id)}
                        style={{ ...toolBtn, color: '#d4943a' }}
                      >
                        + accion
                      </button>
                      <button
                        onClick={() => {
                          setEditingTask(task.id)
                          setEditNombre(task.nombre)
                          setEditPrio(task.prioridad)
                          setEditPomos(task.pomodoros)
                        }}
                        style={toolBtn}
                      >
                        editar
                      </button>
                      <button onClick={() => handleDelete(task.id)} style={{ ...toolBtn, color: '#c45a3a' }}>
                        borrar
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={actionsPanel}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {taskActions.map((action) => (
                              <div key={action.id} style={actionChip}>
                                <button onClick={() => void handleExecuteAction(action.id)} style={actionRunBtn}>
                                  {action.tipo.toUpperCase()} {action.label}
                                </button>
                                <button onClick={() => openActionModal(task.id, action.id)} style={chipToolBtn}>
                                  editar
                                </button>
                                <button onClick={() => deleteAccion(action.id)} style={{ ...chipToolBtn, color: '#c45a3a' }}>
                                  borrar
                                </button>
                              </div>
                            ))}

                            <button onClick={() => openActionModal(task.id)} style={addActionBtn}>
                              + accion
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      <Modal
        open={actionModal.open}
        onClose={() => setActionModal({ open: false, tareaId: null, editId: null })}
        title={actionModal.editId ? 'Editar accion' : 'Nueva accion'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label="Etiqueta"
            value={acLabel}
            onChange={(e) => setAcLabel(e.target.value)}
            placeholder="ej: PDF, Anki, VSCode..."
          />
          <Select label="Tipo" value={acTipo} onChange={(e) => setAcTipo(e.target.value as 'url' | 'app' | 'file')}>
            <option value="url">URL</option>
            <option value="app">Aplicacion</option>
            <option value="file">Archivo</option>
          </Select>
          <Input
            label="Valor"
            value={acValor}
            onChange={(e) => setAcValor(e.target.value)}
            placeholder={acTipo === 'url' ? 'https://...' : acTipo === 'app' ? 'C:\\...\\app.exe' : 'C:\\...'}
          />
          <Button variant="primary" onClick={handleSaveAction}>
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  )
}

const sectionMeta: React.CSSProperties = {
  color: '#7a6e61',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

const addTaskBtn: React.CSSProperties = {
  background: '#d4943a',
  border: 'none',
  color: '#11100e',
  borderRadius: '999px',
  padding: '7px 12px',
  cursor: 'pointer',
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
}

const formCard: React.CSSProperties = {
  background: '#1d1b18',
  borderRadius: '12px',
  border: '1px solid #d4943a33',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const formLabel: React.CSSProperties = {
  color: '#7a6e61',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '6px',
  fontFamily: "'JetBrains Mono', monospace",
}

const hoursValue: React.CSSProperties = {
  minWidth: '36px',
  textAlign: 'center',
  color: '#c8a97e',
  fontSize: '13px',
  fontFamily: "'JetBrains Mono', monospace",
}

const stepBtn: React.CSSProperties = {
  background: '#27241f',
  border: '1px solid #3a342d',
  borderRadius: '8px',
  padding: '5px 10px',
  color: '#c8a97e',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: "'JetBrains Mono', monospace",
}

const emptyStateStyle: React.CSSProperties = {
  background: '#171614',
  border: '1px dashed #302c27',
  borderRadius: '12px',
  padding: '18px 14px',
  color: '#7a6e61',
  fontSize: '13px',
  lineHeight: 1.5,
}

const taskCard: React.CSSProperties = {
  background: '#171614',
  border: '1px solid #2c2823',
  borderRadius: '14px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const hoursTag: React.CSSProperties = {
  color: '#7a6e61',
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

const actionsPanel: React.CSSProperties = {
  marginTop: '2px',
  paddingTop: '12px',
  borderTop: '1px solid #24211c',
}

const actionChip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 8px',
  background: '#221f1b',
  borderRadius: '999px',
  border: '1px solid #332f2a',
  flexWrap: 'wrap',
}

const actionRunBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#c8a97e',
  cursor: 'pointer',
  padding: 0,
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
}

const chipToolBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#7a6e61',
  cursor: 'pointer',
  padding: 0,
  fontSize: '10px',
  fontFamily: "'JetBrains Mono', monospace",
}

const addActionBtn: React.CSSProperties = {
  background: 'none',
  border: '1px dashed #3a342d',
  color: '#7a6e61',
  borderRadius: '999px',
  padding: '5px 9px',
  cursor: 'pointer',
  fontSize: '10px',
  textTransform: 'uppercase',
  fontFamily: "'JetBrains Mono', monospace",
}

function priorityStyle(priority: number): React.CSSProperties {
  const colors: Record<number, string> = {
    1: '#c45a3a',
    2: '#d4943a',
    3: '#c8a97e',
    4: '#5a7ab5',
    5: '#5a8a6a',
  }

  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    color: colors[priority] ?? '#7a6e61',
    border: `1px solid ${(colors[priority] ?? '#7a6e61')}33`,
    borderRadius: '999px',
    padding: '3px 7px',
    flexShrink: 0,
  }
}
