import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useConfigStore } from '../store/useConfigStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { usePlanningStore } from '../store/usePlanningStore'
import type { PlanTask, Tarea } from '../api/types'

const DAYS_ES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const PLANNING_BASE_HOUR_PX = 56
const PLANNING_HOUR_LABEL_WIDTH = 34
const MIN_TIMELINE_HEIGHT = 280

const PRIORITY_COLORS: Record<number, string> = {
  1: '#c45a3a',
  2: '#d4943a',
  3: '#c8a97e',
  4: '#5a7ab5',
  5: '#5a8a6a',
}

function formatDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]}`
}

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatHour(hour: number) {
  return `${String(Math.floor(hour)).padStart(2, '0')}:00`
}

function splitTasksByWindow(tasks: PlanTask[], dayStart: number, dayEnd: number) {
  const visible: PlanTask[] = []
  const overflow: PlanTask[] = []

  tasks.forEach((task) => {
    const start = task.start_hour ?? dayStart
    const end = task.end_hour ?? (start + task.duration_hours)
    const fitsWindow = start >= dayStart && end <= dayEnd

    if (fitsWindow) {
      visible.push(task)
      return
    }

    overflow.push(task)
  })

  return { visible, overflow }
}

export function PlanningPage() {
  const {
    weekPayload,
    poolTasks,
    poolSearch,
    init,
    prevWeek,
    nextWeek,
    setPoolSearch,
    addTask,
    addManualTask,
    removeTask,
    toggleTaskDone,
    changeRepeticiones,
    updateNote,
    reorder,
    fetchWeek,
  } = usePlanningStore()
  const { config, fetch: fetchConfig, update: updateConfig } = useConfigStore()
  const { apartados, fetchApartados } = useLibraryStore()

  const [configOpen, setConfigOpen] = useState(false)
  const [cfgDayStart, setCfgDayStart] = useState('')
  const [cfgDayEnd, setCfgDayEnd] = useState('')
  const [cfgCiudad, setCfgCiudad] = useState('')
  const [cfgNombre, setCfgNombre] = useState('')

  const [manualOpen, setManualOpen] = useState(false)
  const [manualDate, setManualDate] = useState('')
  const [manualNombre, setManualNombre] = useState('')
  const [manualPomos, setManualPomos] = useState('1')
  const [manualPrio, setManualPrio] = useState('3')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteTask, setNoteTask] = useState<PlanTask | null>(null)
  const [noteText, setNoteText] = useState('')

  const [dragTaskId, setDragTaskId] = useState<number | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [dragPlanId, setDragPlanId] = useState<string | null>(null)
  const [dragPlanDate, setDragPlanDate] = useState<string | null>(null)
  const [dragOverPlanId, setDragOverPlanId] = useState<string | null>(null)
  const [taskHeights, setTaskHeights] = useState<Record<string, number>>({})
  const taskResizeObservers = useRef<Map<string, ResizeObserver>>(new Map())

  useEffect(() => {
    void init()
    void fetchConfig()
    void fetchApartados()
  }, [fetchApartados, fetchConfig, init])

  useEffect(() => {
    if (!config) return
    setCfgDayStart(String(config.day_start))
    setCfgDayEnd(String(config.day_end))
    setCfgCiudad(config.ciudad)
    setCfgNombre(config.nombre ?? '')
  }, [config])

  const grouped = (() => {
    const query = poolSearch.toLowerCase()
    const filtered = poolTasks.filter((task) => task.nombre.toLowerCase().includes(query))
    const map: Record<string, Tarea[]> = {}
    filtered.forEach((task) => {
      const key = task.apartado_nombre ?? 'General'
      ;(map[key] = map[key] ?? []).push(task)
    })
    return map
  })()

  async function handleSaveConfig() {
    await updateConfig({
      day_start: Number(cfgDayStart),
      day_end: Number(cfgDayEnd),
      ciudad: cfgCiudad,
      nombre: cfgNombre,
    })
    await fetchWeek()
    setConfigOpen(false)
  }

  function openManualModal(fecha: string) {
    setManualDate(fecha)
    setManualNombre('')
    setManualPomos('1')
    setManualPrio('3')
    setManualOpen(true)
  }

  async function handleCreateManualTask() {
    const nombre = manualNombre.trim()
    if (!manualDate || !nombre) return

    await addManualTask({
      fecha: manualDate,
      nombre,
      prioridad: Number(manualPrio),
      pomodoros: Math.max(1, Number(manualPomos) || 1),
    })
    setManualOpen(false)
  }

  function openNoteModal(task: PlanTask) {
    setNoteTask(task)
    setNoteText(task.note ?? '')
    setNoteOpen(true)
  }

  async function handleSaveNote() {
    if (!noteTask) return

    await updateNote(noteTask.plan_dia_id, noteText)
    setNoteOpen(false)
    setNoteTask(null)
    setNoteText('')
  }

  function resetDragState() {
    setDragTaskId(null)
    setDragOverDate(null)
    setDragPlanId(null)
    setDragPlanDate(null)
    setDragOverPlanId(null)
  }

  function handleDragStart(tareaId: number) {
    setDragTaskId(tareaId)
    setDragPlanId(null)
    setDragPlanDate(null)
    setDragOverPlanId(null)
  }

  async function handleDayDrop(fecha: string, orderedIds: string[]) {
    if (dragTaskId !== null && dragPlanId === null) {
      await addTask(dragTaskId, fecha)
      resetDragState()
      return
    }

    if (dragPlanId === null || dragPlanDate !== fecha) return

    const reorderedIds = orderedIds.filter((id) => id !== dragPlanId)
    reorderedIds.push(dragPlanId)

    if (reorderedIds.join('|') !== orderedIds.join('|')) {
      await reorder(fecha, reorderedIds)
    }

    resetDragState()
  }

  async function handleInsertDrop(fecha: string, orderedIds: string[], targetPlanId: string) {
    if (dragPlanId === null || dragPlanDate !== fecha) return

    const fromIdx = orderedIds.indexOf(dragPlanId)
    const toIdx = orderedIds.indexOf(targetPlanId)
    if (fromIdx === -1 || toIdx === -1) {
      resetDragState()
      return
    }

    const reorderedIds = [...orderedIds]
    reorderedIds.splice(fromIdx, 1)

    const insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx
    reorderedIds.splice(insertAt, 0, dragPlanId)

    if (reorderedIds.join('|') !== orderedIds.join('|')) {
      await reorder(fecha, reorderedIds)
    }

    resetDragState()
  }

  const today = toDateStr(new Date())
  const dayStart = weekPayload?.day_start ?? config?.day_start ?? 6
  const dayEnd = weekPayload?.day_end ?? config?.day_end ?? 22
  const safeDayEnd = Math.max(dayEnd, dayStart + 1)
  const timelineHours = Array.from(
    { length: Math.max(0, safeDayEnd - dayStart) + 1 },
    (_, index) => dayStart + index,
  )
  const visibleWeekTasks = useMemo(
    () => weekPayload?.days.flatMap((day) => splitTasksByWindow(day.tasks, dayStart, safeDayEnd).visible) ?? [],
    [dayStart, safeDayEnd, weekPayload],
  )
  const hourPx = Math.ceil(Math.max(
    PLANNING_BASE_HOUR_PX,
    ...visibleWeekTasks.map((task) => {
      const measuredHeight = taskHeights[task.plan_dia_id] ?? 0
      return measuredHeight > 0
        ? (measuredHeight + 14) / Math.max(1, task.duration_hours)
        : PLANNING_BASE_HOUR_PX
    }),
  ))
  const timelineHeight = Math.max((safeDayEnd - dayStart) * hourPx, MIN_TIMELINE_HEIGHT)

  const measureTaskCard = useCallback((planId: string) => (node: HTMLDivElement | null) => {
    taskResizeObservers.current.get(planId)?.disconnect()
    taskResizeObservers.current.delete(planId)
    if (!node) return

    const updateHeight = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height)
      setTaskHeights((current) => (
        current[planId] === nextHeight ? current : { ...current, [planId]: nextHeight }
      ))
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    taskResizeObservers.current.set(planId, observer)
  }, [])

  useEffect(() => () => {
    taskResizeObservers.current.forEach((observer) => observer.disconnect())
    taskResizeObservers.current.clear()
  }, [])

  return (
    <div style={{ height: 'calc(100vh - 52px)', display: 'flex', overflow: 'hidden' }}>
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          width: '220px',
          flexShrink: 0,
          borderRight: '1px solid #2e2b27',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid #2e2b27' }}>
          <div style={poolTitle}>
            Tareas
          </div>
          <input
            value={poolSearch}
            onChange={(e) => setPoolSearch(e.target.value)}
            placeholder="Buscar..."
            style={poolSearchInput}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {Object.entries(grouped).map(([apartName, tasks]) => {
            const apartado = apartados.find((item) => item.nombre === apartName)
            return (
              <div key={apartName} style={{ marginBottom: '12px' }}>
                <div style={groupLabel}>
                  {apartado && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: apartado.color,
                        display: 'inline-block',
                      }}
                    />
                  )}
                  {apartName}
                </div>

                {tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onDragEnd={resetDragState}
                    style={{
                      padding: '6px 8px',
                      marginBottom: '3px',
                      background: '#1a1917',
                      borderRadius: '5px',
                      border: '1px solid #2e2b27',
                      borderLeft: `2px solid ${apartado?.color ?? '#3d3830'}`,
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: dragTaskId === task.id ? 0.4 : 1,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: '12px', color: '#f0e6d3' }}>{task.nombre}</span>
                    <span style={priorityPill(task.prioridad)}>P{task.prioridad}</span>
                  </div>
                ))}
              </div>
            )
          })}

          {Object.keys(grouped).length === 0 && (
            <p style={{ fontSize: '12px', color: '#3d3830', textAlign: 'center', marginTop: '24px' }}>
              Sin resultados
            </p>
          )}
        </div>
      </motion.aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={weekHeader}>
          <button onClick={prevWeek} style={navBtn}>{'<'}</button>
          <span style={weekTitle}>
            {weekPayload ? `${formatDate(weekPayload.week_start)} - ${formatDate(weekPayload.week_end)}` : 'Cargando...'}
          </span>
          <button onClick={nextWeek} style={navBtn}>{'>'}</button>
          <button onClick={() => setConfigOpen(true)} style={configBtn}>
            Config
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', padding: '12px' }}>
          {weekPayload ? weekPayload.days.map((day, index) => {
            const isToday = day.date === today
            const canDropInDay = dragTaskId !== null || (dragPlanId !== null && dragPlanDate === day.date)
            const isOver = dragOverDate === day.date && dragOverPlanId === null
            const orderedIds = day.tasks.map((task) => task.plan_dia_id)
            const { visible, overflow } = splitTasksByWindow(day.tasks, dayStart, safeDayEnd)
            const totalPlannedHours = day.tasks.reduce((sum, task) => sum + task.duration_hours, 0)

            const renderTaskCard = (task: PlanTask, options?: { top?: number; height?: number; overflow?: boolean }) => {
              const isOverflowCard = options?.overflow ?? false
              const isDragSource = dragPlanId === task.plan_dia_id
              const isInsertTarget = dragOverPlanId === task.plan_dia_id && dragPlanId !== task.plan_dia_id
              const containerStyle: CSSProperties = isOverflowCard
                ? {
                  background: '#1d1b18',
                  borderRadius: '8px',
                  border: '1px solid #2e2b27',
                  borderLeft: `3px solid ${task.apartado.color}`,
                  padding: '8px 9px',
                  marginBottom: '6px',
                  cursor: 'grab',
                  opacity: isDragSource ? 0.4 : task.done ? 0.62 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s, transform 0.15s',
                  borderTop: isInsertTarget ? '2px solid #c8a97e' : undefined,
                }
                : {
                  position: 'absolute',
                  top: `${options?.top ?? 0}px`,
                  left: `${PLANNING_HOUR_LABEL_WIDTH + 8}px`,
                  right: '6px',
                  height: `${options?.height ?? 52}px`,
                  background: '#211f1c',
                  borderRadius: '8px',
                  border: '1px solid #2e2b27',
                  borderLeft: `3px solid ${task.apartado.color}`,
                  cursor: 'grab',
                  opacity: isDragSource ? 0.4 : task.done ? 0.62 : 1,
                  transition: 'opacity 0.15s, border-color 0.15s, transform 0.15s',
                  boxShadow: isInsertTarget ? '0 0 0 1px rgba(200, 169, 126, 0.28)' : 'none',
                  borderTop: isInsertTarget ? '2px solid #c8a97e' : undefined,
                  boxSizing: 'border-box',
                }

              return (
                <motion.div
                  key={task.plan_dia_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: containerStyle.opacity ?? 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation()
                    setDragPlanId(task.plan_dia_id)
                    setDragPlanDate(day.date)
                    setDragTaskId(null)
                    setDragOverPlanId(null)
                  }}
                  onDragEnd={resetDragState}
                  onDragOver={(event) => {
                    if (dragPlanId === null || dragPlanDate !== day.date) return
                    event.preventDefault()
                    event.stopPropagation()
                    setDragOverDate(null)
                    setDragOverPlanId(task.plan_dia_id)
                  }}
                  onDragLeave={(event) => {
                    if (dragPlanId === null || dragPlanDate !== day.date) return
                    const related = event.relatedTarget
                    if (related instanceof Node && event.currentTarget.contains(related)) return
                    setDragOverPlanId((current) => current === task.plan_dia_id ? null : current)
                  }}
                  onDrop={(event) => {
                    if (dragPlanId === null || dragPlanDate !== day.date) return
                    event.preventDefault()
                    event.stopPropagation()
                    void handleInsertDrop(day.date, orderedIds, task.plan_dia_id)
                  }}
                  style={containerStyle}
                >
                  <div
                    ref={!isOverflowCard ? measureTaskCard(task.plan_dia_id) : undefined}
                    style={taskCardContent}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          aria-label={task.done ? `Desmarcar ${task.name}` : `Marcar ${task.name}`}
                          aria-pressed={task.done}
                          onPointerDown={(event) => {
                            event.stopPropagation()
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            void toggleTaskDone(task.plan_dia_id, !task.done)
                          }}
                          style={timelineCheckBtn(task.done)}
                        >
                          {task.done && (
                            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                              <path
                                d="M1.6 5L4 7.3L8.4 2.5"
                                stroke="#8ab89a"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={task.note ? `Editar nota de ${task.name}` : `Agregar nota a ${task.name}`}
                          onPointerDown={(event) => {
                            event.stopPropagation()
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            openNoteModal(task)
                          }}
                          style={noteTimelineBtn(Boolean(task.note))}
                        >
                          Nota
                        </button>
                        <button
                          type="button"
                          onPointerDown={(event) => {
                            event.stopPropagation()
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            void removeTask(task.plan_dia_id)
                          }}
                          style={removeTimelineBtn}
                        >
                          x
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '7px',
                        fontSize: '12px',
                        color: task.done ? '#7a6e61' : '#f0e6d3',
                        textDecoration: task.done ? 'line-through' : 'none',
                        lineHeight: 1.35,
                      }}
                    >
                      {task.name}
                    </div>

                    {task.note && (
                      <div style={taskNotePreview}>
                        {task.note}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '7px', flexWrap: 'wrap' }}>
                      {task.source === 'manual' && (
                        <span style={manualBadge}>{task.apartado.name}</span>
                      )}
                      <span style={tinyPriority(task.priority)}>P{task.priority}</span>
                      <span style={hoursMeta}>{task.duration_hours}h</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            void changeRepeticiones(task.plan_dia_id, Math.max(1, task.repeticiones - 1))
                          }}
                          style={miniBtn}
                        >
                          -
                        </button>
                        <span style={repsText}>{task.repeticiones}x</span>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            void changeRepeticiones(task.plan_dia_id, task.repeticiones + 1)
                          }}
                          style={miniBtn}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            }

            return (
              <motion.div
                key={day.date}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onDragOver={(event) => {
                  if (!canDropInDay) return
                  event.preventDefault()
                  setDragOverDate(day.date)
                  if (dragPlanId !== null && dragPlanDate === day.date) {
                    setDragOverPlanId(null)
                  }
                }}
                onDragLeave={(event) => {
                  const related = event.relatedTarget
                  if (related instanceof Node && event.currentTarget.contains(related)) return
                  setDragOverDate(null)
                  setDragOverPlanId(null)
                }}
                onDrop={(event) => {
                  if (!canDropInDay) return
                  event.preventDefault()
                  void handleDayDrop(day.date, orderedIds)
                }}
                style={{
                  flex: '0 0 220px',
                  minWidth: '220px',
                  marginRight: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: isOver ? '#211f1c' : '#1a1917',
                  borderRadius: '10px',
                  border: `1px solid ${isToday ? '#d4943a33' : isOver ? '#c8a97e33' : '#2e2b27'}`,
                  transition: 'background 0.15s, border-color 0.15s',
                  overflow: 'hidden',
                  height: '100%',
                }}
              >
                <div style={{ padding: '10px 10px 9px', borderBottom: '1px solid #211f1c', background: isToday ? '#2a1e0d' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={dayLabel(isToday)}>{DAYS_ES[index]}</div>
                      <div style={dayDate(isToday)}>{formatDate(day.date)}</div>
                    </div>
                    <button onClick={() => openManualModal(day.date)} style={dayAddBtn}>
                      + random
                    </button>
                  </div>

                  <div style={dayMetaRow}>
                    <span>{day.tasks.length} tareas</span>
                    <span>{totalPlannedHours}h plan</span>
                    <span>{formatHour(dayStart)} - {formatHour(safeDayEnd)}</span>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}>
                  <div style={timelineFrame(isOver)}>
                    <div style={{ position: 'relative', minHeight: `${timelineHeight}px` }}>
                      {timelineHours.map((hour) => {
                        const y = (hour - dayStart) * hourPx
                        return (
                          <div
                            key={`${day.date}-${hour}`}
                            style={{
                              position: 'absolute',
                              top: `${y}px`,
                              left: 0,
                              right: 0,
                              display: 'flex',
                              alignItems: 'flex-start',
                              pointerEvents: 'none',
                            }}
                          >
                            <div style={timelineHourLabel}>
                              {formatHour(hour)}
                            </div>
                            <div style={timelineHourLine} />
                          </div>
                        )
                      })}

                      <div style={timelineTaskLayer}>
                        <AnimatePresence>
                          {visible.map((task) => {
                            const taskStart = task.start_hour ?? dayStart
                            const taskTop = Math.max(0, (taskStart - dayStart) * hourPx)
                            const taskHeight = Math.max(task.duration_hours * hourPx, 54)
                            return renderTaskCard(task, { top: taskTop, height: taskHeight })
                          })}
                        </AnimatePresence>
                      </div>

                      {day.tasks.length === 0 && (
                        <div style={emptyTimelineState(isOver)}>
                          <span>{isOver ? 'Soltar aqui' : 'Arrastrar tareas para ver su bloque horario'}</span>
                          <button onClick={() => openManualModal(day.date)} style={emptyRandomBtn}>
                            + tarea random
                          </button>
                        </div>
                      )}

                      {day.tasks.length > 0 && visible.length === 0 && (
                        <div style={emptyTimelineHint}>
                          Todo queda fuera de la jornada visible.
                        </div>
                      )}
                    </div>
                  </div>

                  {overflow.length > 0 && (
                    <div style={overflowSection}>
                      <div style={overflowLabel}>
                        Fuera de jornada
                      </div>
                      {overflow.map((task) => renderTaskCard(task, { overflow: true }))}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          }) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3830' }}>
              Cargando semana...
            </div>
          )}
        </div>
      </main>

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Configuracion" width={420}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input label="Tu nombre (para el saludo)" value={cfgNombre} onChange={(e) => setCfgNombre(e.target.value)} placeholder="ej: Tomas" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input label="Inicio de jornada" type="number" min={0} max={23} value={cfgDayStart} onChange={(e) => setCfgDayStart(e.target.value)} />
            <Input label="Fin de jornada" type="number" min={0} max={23} value={cfgDayEnd} onChange={(e) => setCfgDayEnd(e.target.value)} />
          </div>
          <Input label="Ciudad" value={cfgCiudad} onChange={(e) => setCfgCiudad(e.target.value)} placeholder="ej: Baigorria" />
          <Button variant="primary" onClick={handleSaveConfig}>Guardar configuracion</Button>
        </div>
      </Modal>

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title={manualDate ? `Nueva tarea random - ${formatDate(manualDate)}` : 'Nueva tarea random'}
        width={420}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Nombre"
            value={manualNombre}
            onChange={(e) => setManualNombre(e.target.value)}
            placeholder="ej: leer algo, practicar, estudiar..."
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input
              label="Horas"
              type="number"
              min={1}
              value={manualPomos}
              onChange={(e) => setManualPomos(e.target.value)}
            />
            <Select label="Prioridad" value={manualPrio} onChange={(e) => setManualPrio(e.target.value)}>
              {[1, 2, 3, 4, 5].map((priority) => (
                <option key={priority} value={priority}>
                  P{priority}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCreateManualTask} disabled={!manualNombre.trim()}>
              Agregar al dia
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={noteTask ? `Nota - ${noteTask.name}` : 'Nota'}
        width={460}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={noteLabel}>
            Comentario de esta planificacion
          </label>
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Ej: repasar solo ejercicios dificiles, llevar apuntes, hacerlo despues de comer..."
            autoFocus
            rows={6}
            style={noteTextarea}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="ghost" onClick={() => setNoteText('')} disabled={!noteText.trim()}>
              Borrar
            </Button>
            <Button variant="primary" onClick={handleSaveNote}>
              Guardar nota
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const poolTitle: CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '18px',
  color: '#f0e6d3',
  fontWeight: 300,
  marginBottom: '8px',
}

const poolSearchInput: CSSProperties = {
  width: '100%',
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '12px',
  color: '#f0e6d3',
  outline: 'none',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
}

const groupLabel: CSSProperties = {
  fontSize: '10px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '4px',
  paddingLeft: '4px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const weekHeader: CSSProperties = {
  padding: '10px 16px',
  borderBottom: '1px solid #2e2b27',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexShrink: 0,
}

const weekTitle: CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '20px',
  color: '#f0e6d3',
  fontWeight: 300,
  flex: 1,
  textAlign: 'center',
}

const navBtn: CSSProperties = {
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '6px',
  padding: '4px 12px',
  color: '#c8a97e',
  fontSize: '18px',
  cursor: 'pointer',
  lineHeight: 1,
}

const configBtn: CSSProperties = {
  padding: '5px 12px',
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '6px',
  color: '#7a6e61',
  fontSize: '12px',
  cursor: 'pointer',
}

function dayLabel(isToday: boolean): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    color: isToday ? '#d4943a' : '#7a6e61',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  }
}

function dayDate(isToday: boolean): CSSProperties {
  return {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '20px',
    color: isToday ? '#f0b855' : '#c8a97e',
    fontWeight: 300,
    lineHeight: 1.1,
  }
}

const dayMetaRow: CSSProperties = {
  marginTop: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  flexWrap: 'wrap',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  color: '#7a6e61',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

function priorityPill(priority: number): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    color: PRIORITY_COLORS[priority],
  }
}

function tinyPriority(priority: number): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '8px',
    color: PRIORITY_COLORS[priority],
  }
}

const timelineCheckBtn = (done: boolean): CSSProperties => ({
  width: '22px',
  height: '22px',
  borderRadius: '999px',
  border: done ? '2px solid #5a8a6a' : '2px solid #3d3830',
  background: done ? '#2d4a38' : 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
})

const removeTimelineBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#4b443b',
  cursor: 'pointer',
  fontSize: '12px',
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
}

function noteTimelineBtn(hasNote: boolean): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '8px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: hasNote ? '#f0b855' : '#7a6e61',
    background: hasNote ? '#2a1e0d' : '#1b1815',
    border: `1px solid ${hasNote ? '#d4943a55' : '#332f2a'}`,
    borderRadius: '999px',
    cursor: 'pointer',
    padding: '3px 7px',
    lineHeight: 1,
    flexShrink: 0,
  }
}

const taskNotePreview: CSSProperties = {
  marginTop: '6px',
  color: '#a69380',
  fontSize: '11px',
  lineHeight: 1.35,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const noteLabel: CSSProperties = {
  fontSize: '11px',
  color: '#7a6e61',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 500,
}

const noteTextarea: CSSProperties = {
  width: '100%',
  minHeight: '140px',
  resize: 'vertical',
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  color: '#f0e6d3',
  lineHeight: 1.45,
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  outline: 'none',
}

const hoursMeta: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  color: '#7a6e61',
  letterSpacing: '0.04em',
}

const repsText: CSSProperties = {
  fontSize: '9px',
  color: '#7a6e61',
  fontFamily: "'JetBrains Mono', monospace",
}

const miniBtn: CSSProperties = {
  background: 'none',
  border: '1px solid #2e2b27',
  borderRadius: '3px',
  color: '#7a6e61',
  fontSize: '10px',
  cursor: 'pointer',
  padding: '0 3px',
  lineHeight: 1.4,
}

const dayAddBtn: CSSProperties = {
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '999px',
  color: '#8b7e70',
  fontSize: '9px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  padding: '4px 8px',
  flexShrink: 0,
}

const manualBadge: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  color: '#8b7e70',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  border: '1px solid #332f2a',
  borderRadius: '999px',
  padding: '1px 5px',
}

function timelineFrame(isOver: boolean): CSSProperties {
  return {
    position: 'relative',
    borderRadius: '8px',
    border: `1px solid ${isOver ? '#3d3830' : '#24211d'}`,
    background: isOver
      ? 'linear-gradient(180deg, rgba(33,31,28,0.96) 0%, rgba(26,25,23,0.98) 100%)'
      : 'linear-gradient(180deg, rgba(26,25,23,0.95) 0%, rgba(20,19,18,0.98) 100%)',
    overflow: 'hidden',
  }
}

const timelineTaskLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1,
}

const taskCardContent: CSSProperties = {
  padding: '8px 9px',
  boxSizing: 'border-box',
}

const timelineHourLabel: CSSProperties = {
  width: `${PLANNING_HOUR_LABEL_WIDTH}px`,
  flexShrink: 0,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  color: '#4f473d',
  letterSpacing: '0.06em',
  textAlign: 'center',
  transform: 'translateY(-50%)',
}

const timelineHourLine: CSSProperties = {
  flex: 1,
  height: '1px',
  background: '#25221e',
}

function emptyTimelineState(isOver: boolean): CSSProperties {
  return {
    position: 'absolute',
    inset: '18px 8px 18px 42px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '11px',
    color: isOver ? '#c8a97e' : '#3d3830',
    border: `1px dashed ${isOver ? '#5a4b35' : '#2a2723'}`,
    borderRadius: '8px',
    textAlign: 'center',
    padding: '12px',
  }
}

const emptyTimelineHint: CSSProperties = {
  position: 'absolute',
  inset: '18px 8px 18px 42px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  color: '#3d3830',
  border: '1px dashed #25221e',
  borderRadius: '8px',
  textAlign: 'center',
  padding: '12px',
}

const emptyRandomBtn: CSSProperties = {
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '999px',
  color: '#8b7e70',
  fontSize: '9px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  padding: '5px 8px',
}

const overflowSection: CSSProperties = {
  marginTop: '10px',
}

const overflowLabel: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '6px',
  paddingLeft: '2px',
}
