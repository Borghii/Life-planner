import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { getDayPlan } from '../api/planning'
import type { PlanTask } from '../api/types'
import { Modal } from '../components/ui/Modal'
import { useEconomyStore } from '../store/useEconomyStore'
import {
  BREAK_SECONDS,
  FOCUS_SECONDS,
  type PomodoroDistraction,
  usePomodoroStore,
} from '../store/usePomodoroStore'

const PRIORITY_COLORS: Record<number, string> = {
  1: '#c45a3a',
  2: '#d4943a',
  3: '#c8a97e',
  4: '#5a7ab5',
  5: '#5a8a6a',
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatClock(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function toDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTitle(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

function formatHour(hour: number) {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function focusSessionsForTask(task: PlanTask) {
  return Math.max(1, Math.ceil(task.duration_hours || task.pomos * task.repeticiones || 1))
}

function taskWindow(task: PlanTask) {
  if (task.start_hour === null || task.end_hour === null) return null
  return `${formatHour(task.start_hour)} - ${formatHour(task.end_hour)}`
}

function sortTasks(tasks: PlanTask[]) {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const aStart = a.start_hour ?? 99
    const bStart = b.start_hour ?? 99
    if (aStart !== bStart) return aStart - bStart
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.name.localeCompare(b.name)
  })
}

interface DistractionListProps {
  items: PomodoroDistraction[]
  maxHeight: number
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

function DistractionList({
  items,
  maxHeight,
  onComplete,
  onDelete,
}: DistractionListProps) {
  if (items.length === 0) {
    return <div style={distractionEmpty}>No hay nada pendiente. Descansa de verdad.</div>
  }

  return (
    <div style={{ ...distractionList, maxHeight }}>
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.025 }}
          style={distractionItem}
        >
          <div style={distractionCopy}>
            <span style={distractionText}>{item.text}</span>
            <time dateTime={item.createdAt} style={distractionTime}>
              {formatClock(item.createdAt)}
            </time>
          </div>
          <div style={distractionActions}>
            <button
              type="button"
              onClick={() => onComplete(item.id)}
              aria-label={`Marcar como hecho: ${item.text}`}
              style={distractionDoneButton}
            >
              Hecho
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              aria-label={`Eliminar: ${item.text}`}
              style={distractionDeleteButton}
            >
              Eliminar
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function PomodoroPage() {
  const {
    mode,
    secondsLeft,
    running,
    soundEnabled,
    rainVolume,
    distractions,
    log,
    activeTask,
    activeLeisurePass,
    leisureBusy,
    autoCompletedTask,
    completionError,
    awaitingNextFocusConfirmation,
    startTimer,
    pauseTimer,
    resetTimer,
    toggleSound,
    setRainVolume,
    addDistraction,
    completeDistraction,
    deleteDistraction,
    loadTask,
    clearActiveTask,
    loadLeisurePass,
    clearLeisurePass,
    finishLeisurePass,
    syncLeisurePasses,
    ackAutoCompletedTask,
    confirmNextFocus,
    deferNextFocus,
  } = usePomodoroStore()
  const {
    balance,
    rewards,
    passes,
    initialized: economyInitialized,
    refresh: refreshEconomy,
    redeemReward,
  } = useEconomyStore()

  const [today] = useState(() => toDateStr())
  const [leftTab, setLeftTab] = useState<'tasks' | 'passes'>('tasks')
  const [tasks, setTasks] = useState<PlanTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dropOver, setDropOver] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [distractionText, setDistractionText] = useState('')
  const [redeemingRewardId, setRedeemingRewardId] = useState<number | null>(null)

  const refreshTasks = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await getDayPlan(today)
      setTasks(payload.tasks)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las tareas')
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    void refreshTasks()
    void refreshEconomy()
  }, [refreshEconomy, refreshTasks])

  useEffect(() => {
    if (economyInitialized) syncLeisurePasses(passes)
  }, [economyInitialized, passes, syncLeisurePasses])

  useEffect(() => {
    if (!autoCompletedTask) return

    setNotice('Tarea completada automaticamente.')
    void refreshTasks().finally(() => {
      ackAutoCompletedTask()
    })
  }, [ackAutoCompletedTask, autoCompletedTask, refreshTasks])

  useEffect(() => {
    if (!activeTask || running || loading) return
    if (activeTask.date !== today) {
      clearActiveTask()
      return
    }

    const matchingTask = tasks.find((task) => task.plan_dia_id === activeTask.plan_dia_id)
    if (!matchingTask || matchingTask.done) {
      clearActiveTask()
    }
  }, [activeTask, clearActiveTask, loading, running, tasks, today])

  const orderedTasks = useMemo(() => sortTasks(tasks), [tasks])
  const pendingTasks = useMemo(() => tasks.filter((task) => !task.done), [tasks])
  const completedTasks = tasks.length - pendingTasks.length
  const todayLog = useMemo(() => log.filter((entry) => entry.date === today), [log, today])
  const focusToday = useMemo(() => todayLog.filter((entry) => entry.type === 'focus'), [todayLog])
  const leisurePasses = useMemo(
    () => passes.filter((pass) => pass.status === 'pending' || pass.status === 'active'),
    [passes],
  )
  const activeRewards = useMemo(
    () => rewards.filter((reward) => reward.active),
    [rewards],
  )

  const isLeisure = mode === 'leisure'
  const accent = mode === 'focus'
    ? activeTask?.color ?? '#d4943a'
    : isLeisure ? '#f0b855' : '#7a9e87'
  const rainVolumePercent = Math.round(rainVolume * 100)
  const totalSeconds = isLeisure
    ? Math.max(1, (activeLeisurePass?.durationMinutes ?? 60) * 60)
    : mode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS
  const circumference = 2 * Math.PI * 110
  const strokeDashoffset = circumference * (secondsLeft / totalSeconds)
  const activeProgress = activeTask
    ? `${activeTask.completedFocusSessions}/${activeTask.totalFocusSessions}`
    : null
  const nextFocusNumber = activeTask ? activeTask.completedFocusSessions + 1 : null
  const canDropTask = draggingTaskId !== null && !running && !activeLeisurePass
  const showDistractionReview = mode === 'break' || awaitingNextFocusConfirmation

  const handleLoadTask = useCallback((task: PlanTask) => {
    if (task.done) {
      setNotice('Esa tarea ya esta completada.')
      return
    }

    const loaded = loadTask({
      plan_dia_id: task.plan_dia_id,
      name: task.name,
      color: task.apartado.color,
      date: today,
      totalFocusSessions: focusSessionsForTask(task),
    })

    setNotice(loaded
      ? `Tarea cargada: ${task.name}`
      : 'Pausa o resetea el Pomodoro antes de cambiar de tarea.'
    )
  }, [loadTask, today])

  function handleTaskDragStart(event: React.DragEvent<HTMLDivElement>, task: PlanTask) {
    if (running || task.done) {
      event.preventDefault()
      setNotice(running ? 'No se puede cambiar de tarea con el timer corriendo.' : 'Esa tarea ya esta completada.')
      return
    }

    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', task.plan_dia_id)
    setDraggingTaskId(task.plan_dia_id)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDropOver(false)

    if (running) {
      setNotice('No se puede cambiar de tarea con el timer corriendo.')
      return
    }

    const taskId = event.dataTransfer.getData('text/plain') || draggingTaskId
    const task = tasks.find((item) => item.plan_dia_id === taskId)
    if (!task) return

    handleLoadTask(task)
    setDraggingTaskId(null)
  }

  function handleClearActiveTask() {
    const cleared = clearActiveTask()
    setNotice(cleared ? 'Pomodoro libre listo.' : 'Pausa el timer antes de quitar la tarea.')
  }

  function handleLoadLeisurePass(passId: number) {
    const pass = leisurePasses.find((item) => item.id === passId)
    if (!pass) return
    const loaded = loadLeisurePass(pass)
    setNotice(loaded
      ? `Pase cargado: ${pass.reward_name}`
      : 'Pausa el temporizador y quita la tarea activa antes de cargar un pase.'
    )
  }

  function handleClearLeisurePass() {
    const cleared = clearLeisurePass()
    setNotice(cleared ? 'Pase guardado para mas tarde.' : 'Un pase iniciado ya no se puede devolver.')
  }

  async function handleRedeemReward(rewardId: number) {
    if (redeemingRewardId !== null) return

    setRedeemingRewardId(rewardId)
    try {
      const pass = await redeemReward(rewardId)
      const loaded = !running && !activeTask && !activeLeisurePass
        ? loadLeisurePass(pass)
        : false
      setNotice(loaded
        ? `Recompensa canjeada y cargada: ${pass.reward_name}`
        : `Recompensa canjeada. El pase quedo guardado en Pases de ocio.`
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo canjear la recompensa.')
    } finally {
      setRedeemingRewardId(null)
    }
  }

  function handleAddDistraction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (addDistraction(distractionText)) {
      setDistractionText('')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={pageShell}
    >
      <aside style={leftPanel}>
        <div style={panelHeader}>
          <div>
            <div style={eyebrow}>{leftTab === 'tasks' ? 'Tareas de hoy' : 'Tiempo canjeado'}</div>
            <h1 style={panelTitle}>
              {leftTab === 'tasks' ? formatDateTitle(today) : 'Pases de ocio'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void Promise.all([refreshTasks(), refreshEconomy()])}
            style={smallGhostButton}
          >
            Actualizar
          </button>
        </div>

        <div style={tabRow}>
          <button type="button" onClick={() => setLeftTab('tasks')} style={tabButton(leftTab === 'tasks')}>
            Tareas
          </button>
          <button type="button" onClick={() => setLeftTab('passes')} style={tabButton(leftTab === 'passes')}>
            Pases de ocio
            <span style={tabCount}>{leisurePasses.length}</span>
          </button>
        </div>

        <div style={summaryRow}>
          {leftTab === 'tasks' ? (
            <>
              <span>{pendingTasks.length} pendientes</span>
              <span>{completedTasks} hechas</span>
            </>
          ) : (
            <>
              <span>{balance} pts</span>
              <span>{leisurePasses.length} disponibles</span>
            </>
          )}
        </div>

        {leftTab === 'tasks' && loadError && (
          <div style={errorBox}>{loadError}</div>
        )}

        <div style={taskList}>
          {leftTab === 'passes' ? (
            <>
              <div style={leisureSectionHeader}>
                <span>Tus pases</span>
                <span>{leisurePasses.length}</span>
              </div>
              {leisurePasses.length === 0 ? (
                <div style={compactEmpty}>
                  Todavia no canjeaste ningun pase.
                </div>
              ) : (
                leisurePasses.map((pass) => {
                  const selected = activeLeisurePass?.id === pass.id
                  return (
                    <article key={pass.id} style={leisurePassCard(selected, pass.status === 'active')}>
                      <div style={taskTopLine}>
                        <span style={taskApartado(pass.status === 'active' ? '#f0b855' : '#8ab89a')}>
                          {pass.status === 'active'
                            ? pass.timer_running ? 'En curso' : 'Pausado'
                            : 'Reembolsable'}
                        </span>
                        <span style={priorityPill(2)}>{Math.ceil(pass.remaining_seconds / 60)} min</span>
                      </div>
                      <div style={taskName(false)}>{pass.reward_name}</div>
                      <div style={taskNote}>
                        {pass.status === 'pending'
                          ? 'Pierde el reembolso recien al pulsar Iniciar.'
                          : 'Este pase ya fue iniciado y debe consumirse.'}
                      </div>
                      <div style={taskActionRow}>
                        <button
                          type="button"
                          disabled={running && !selected}
                          onClick={() => handleLoadLeisurePass(pass.id)}
                          style={loadTaskButton(selected, running && !selected)}
                        >
                          {selected ? 'Cargado' : pass.status === 'active' ? 'Continuar' : 'Cargar'}
                        </button>
                      </div>
                    </article>
                  )
                })
              )}

              <div style={{ ...leisureSectionHeader, marginTop: 14 }}>
                <span>Canjear recompensa</span>
                <span>{balance} pts</span>
              </div>
              {activeRewards.length === 0 ? (
                <div style={compactEmpty}>
                  Crea recompensas desde la seccion Recompensas.
                </div>
              ) : (
                activeRewards.map((reward) => {
                  const canRedeem = balance >= reward.price_points
                  const isRedeeming = redeemingRewardId === reward.id
                  return (
                    <article key={reward.id} style={pomodoroRewardCard}>
                      <div style={rewardCopy}>
                        <span style={rewardDuration}>{reward.duration_minutes} min de ocio</span>
                        <strong style={rewardTitle}>{reward.name}</strong>
                      </div>
                      <div style={rewardRedeemColumn}>
                        <strong style={rewardPrice}>{reward.price_points} pts</strong>
                        <button
                          type="button"
                          disabled={!canRedeem || redeemingRewardId !== null}
                          onClick={() => void handleRedeemReward(reward.id)}
                          style={pomodoroRedeemButton(canRedeem && redeemingRewardId === null)}
                        >
                          {isRedeeming
                            ? 'Canjeando...'
                            : canRedeem ? 'Canjear' : `Faltan ${reward.price_points - balance}`}
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </>
          ) : loading ? (
            <div style={emptyState}>Cargando tareas...</div>
          ) : orderedTasks.length === 0 ? (
            <div style={emptyState}>No hay tareas planificadas para hoy.</div>
          ) : (
            <>
              {orderedTasks.map((task) => {
                const sessions = focusSessionsForTask(task)
                const window = taskWindow(task)
                const isActive = activeTask?.plan_dia_id === task.plan_dia_id
                const isDisabled = task.done || running || Boolean(activeLeisurePass)

                return (
                  <div
                    key={task.plan_dia_id}
                    draggable={!task.done && !running && !activeLeisurePass}
                    onDragStart={(event) => handleTaskDragStart(event, task)}
                    onDragEnd={() => {
                      setDraggingTaskId(null)
                      setDropOver(false)
                    }}
                    style={taskCard(task, isActive, Boolean(draggingTaskId === task.plan_dia_id))}
                  >
                    <div style={taskTopLine}>
                      <span style={taskApartado(task.apartado.color)}>{task.apartado.name}</span>
                      <span style={priorityPill(task.priority)}>P{task.priority}</span>
                    </div>

                    <div style={taskName(task.done)}>{task.name}</div>

                    {task.note && (
                      <div style={taskNote}>{task.note}</div>
                    )}

                    <div style={taskMetaRow}>
                      {window && <span>{window}</span>}
                      <span>{task.duration_hours}h</span>
                      <span>{sessions} pomodoro{sessions !== 1 ? 's' : ''}</span>
                    </div>

                    <div style={taskActionRow}>
                      {task.done ? (
                        <span style={doneBadge}>Completada</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleLoadTask(task)}
                          style={loadTaskButton(isActive, isDisabled)}
                        >
                          {isActive ? 'Cargada' : 'Cargar'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </aside>

      <main
        onDragOver={(event) => {
          if (running || activeLeisurePass) return
          event.preventDefault()
          setDropOver(true)
        }}
        onDragLeave={(event) => {
          const related = event.relatedTarget
          if (related instanceof Node && event.currentTarget.contains(related)) return
          setDropOver(false)
        }}
        onDrop={handleDrop}
        style={timerPanel(canDropTask || dropOver)}
      >
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ ...modeLabel, color: accent }}
        >
          {mode === 'focus' ? 'Foco' : mode === 'leisure' ? 'Ocio' : 'Descanso'}
        </motion.div>

        <div style={activeTaskBox(isLeisure ? '#f0b855' : activeTask?.color)}>
          <div style={activeTaskCaption}>
            {isLeisure
              ? activeLeisurePass?.status === 'pending' ? 'Pase listo · aun reembolsable' : 'Pase de ocio activo'
              : activeTask ? 'Tarea activa' : running ? 'Pomodoro libre' : 'Arrastra una tarea aca'}
          </div>
          <div style={activeTaskTitle}>
            {isLeisure ? activeLeisurePass?.name ?? 'Sin pase cargado' : activeTask?.name ?? 'Sin tarea cargada'}
          </div>
          {isLeisure ? (
            <div style={dropHint}>
              {activeLeisurePass?.status === 'pending'
                ? 'El costo ya fue descontado. Podes quitar el pase y cancelarlo desde Recompensas.'
                : 'Podes pausar y continuar, pero esta hora ya no admite reembolso.'}
            </div>
          ) : activeTask ? (
            <div style={focusTrack}>
              {Array.from({ length: activeTask.totalFocusSessions }, (_, index) => (
                <span
                  key={`${activeTask.plan_dia_id}-${index}`}
                  style={focusDot(index < activeTask.completedFocusSessions, activeTask.color)}
                />
              ))}
            </div>
          ) : (
            <div style={dropHint}>
              Las tareas de 1h usan 1 foco de 50 minutos. Una de 3h usa 3 focos.
            </div>
          )}
        </div>

        <div style={timerCircleWrap}>
          <svg width={260} height={260} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={130} cy={130} r={110} fill="none" stroke="#2e2b27" strokeWidth={6} />
            <circle
              cx={130}
              cy={130}
              r={110}
              fill="none"
              stroke={accent}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.4s' }}
            />
          </svg>
          <div style={timerCenter}>
            <span style={timerText}>{formatTime(secondsLeft)}</span>
            <span style={timerSubtext}>
              {isLeisure
                ? activeLeisurePass?.status === 'pending' ? 'listo para iniciar' : running ? 'ocio en curso' : 'ocio pausado'
                : activeProgress ? `${activeProgress} focos` : '50/10 fijo'}
            </span>
          </div>
        </div>

        <div style={buttonRow}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={leisureBusy}
            onClick={() => running ? pauseTimer() : startTimer()}
            style={{ ...primaryButton(running, accent), opacity: leisureBusy ? 0.55 : 1 }}
          >
            {leisureBusy ? 'Sincronizando...' : running ? 'Pausar' : isLeisure && activeLeisurePass?.status === 'active' ? 'Continuar' : 'Iniciar'}
          </motion.button>

          {!isLeisure ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={resetTimer}
              style={secondaryButton}
            >
              Resetear
            </motion.button>
          ) : null}

          {activeTask && (
            <motion.button
              whileHover={{ scale: running ? 1 : 1.03 }}
              whileTap={{ scale: running ? 1 : 0.97 }}
              disabled={running}
              onClick={handleClearActiveTask}
              style={clearTaskButton(running)}
            >
              Quitar
            </motion.button>
          )}

          {isLeisure && activeLeisurePass?.status === 'pending' ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={leisureBusy}
              onClick={handleClearLeisurePass}
              style={clearTaskButton(leisureBusy)}
            >
              Guardar pase
            </motion.button>
          ) : null}

          {isLeisure && activeLeisurePass?.status === 'active' ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={leisureBusy}
              onClick={finishLeisurePass}
              style={finishButton(leisureBusy)}
            >
              Finalizar antes
            </motion.button>
          ) : null}
        </div>

        <div style={soundControls}>
          <button
            type="button"
            aria-pressed={soundEnabled}
            onClick={toggleSound}
            style={soundToggle(soundEnabled, accent)}
          >
            {soundEnabled ? 'Sonido activo' : 'Silencio'}
          </button>

          <label htmlFor="rain-volume" style={rainVolumeControl}>
            <span style={rainVolumeHeader}>
              <span>Volumen de lluvia</span>
              <output htmlFor="rain-volume" style={{ color: accent }}>
                {rainVolumePercent}%
              </output>
            </span>
            <input
              id="rain-volume"
              type="range"
              min={0}
              max={100}
              step={1}
              value={rainVolumePercent}
              aria-label="Volumen de lluvia"
              onChange={(event) => setRainVolume(Number(event.currentTarget.value) / 100)}
              style={rainVolumeSlider(accent)}
            />
          </label>
        </div>

        <div style={timerRule}>
          {isLeisure
            ? '60 min por pase / pausa persistente / sin reinicio ni reembolso despues de iniciar'
            : '50 min foco / 10 min descanso automatico / confirmacion antes de la siguiente hora'}
        </div>

        {(notice || completionError) && (
          <div style={completionError ? errorBox : noticeBox}>
            {completionError ?? notice}
          </div>
        )}
      </main>

      <aside style={rightPanel}>
        <div style={panelHeader}>
          <div>
            <div style={eyebrow}>Registro</div>
            <h2 style={panelTitle}>Hoy</h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={focusCount}>{balance} pts</div>
            <div style={focusCount}>
              {focusToday.length} foco{focusToday.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div style={dailyStats}>
          <div>
            <span style={statNumber}>{focusToday.length}</span>
            <span style={statLabel}>sesiones</span>
          </div>
          <div>
            <span style={statNumber}>{Math.round(focusToday.length * 50 / 60 * 10) / 10}</span>
            <span style={statLabel}>horas foco</span>
          </div>
        </div>

        <section style={distractionSection} aria-labelledby="distraction-title">
          <div style={distractionHeader}>
            <div>
              <div style={eyebrow}>Captura rapida</div>
              <h3 id="distraction-title" style={distractionTitle}>Para el descanso</h3>
            </div>
            <span style={distractionCount}>
              {distractions.length} pendiente{distractions.length !== 1 ? 's' : ''}
            </span>
          </div>

          <form onSubmit={handleAddDistraction} style={distractionForm}>
            <input
              type="text"
              value={distractionText}
              maxLength={240}
              onChange={(event) => setDistractionText(event.currentTarget.value)}
              placeholder="Anotalo y volve al foco..."
              aria-label="Anotar algo para revisar en el descanso"
              style={distractionInput}
            />
            <button
              type="submit"
              disabled={!distractionText.trim()}
              style={addDistractionButton(Boolean(distractionText.trim()))}
            >
              Anotar
            </button>
          </form>

          {showDistractionReview ? (
            <DistractionList
              items={distractions}
              maxHeight={210}
              onComplete={completeDistraction}
              onDelete={deleteDistraction}
            />
          ) : null}
        </section>

        <div style={logList}>
          {todayLog.length === 0 ? (
            <div style={emptyState}>Sin sesiones completadas todavia.</div>
          ) : (
            todayLog.slice(-10).reverse().map((entry, index) => (
              <motion.div
                key={`${entry.completedAt}-${index}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.025 }}
                style={logRow}
              >
                <span style={logDot(entry.type)} />
                <div style={logCopy}>
                  <span style={logTitle}>
                    {entry.type === 'focus' ? 'Foco' : entry.type === 'leisure' ? 'Ocio' : 'Descanso'}
                  </span>
                  <span style={logTaskName}>
                    {entry.taskName ?? 'Pomodoro libre'}
                  </span>
                </div>
                <span style={logTime}>{formatClock(entry.completedAt)}</span>
              </motion.div>
            ))
          )}
        </div>
      </aside>

      <Modal
        open={awaitingNextFocusConfirmation && Boolean(activeTask)}
        onClose={deferNextFocus}
        title="Descanso terminado"
        width={420}
      >
        <div style={nextFocusModalBody}>
          <p style={nextFocusModalText}>
            Completaste {activeTask?.completedFocusSessions} de {activeTask?.totalFocusSessions} horas
            de <strong style={{ color: activeTask?.color }}>{activeTask?.name}</strong>.
          </p>
          <p style={nextFocusModalHint}>
            Queres empezar ahora la hora {nextFocusNumber}?
          </p>
          {distractions.length > 0 ? (
            <div style={modalDistractionReview}>
              <div style={modalDistractionHeader}>
                <span>Pendientes antes de volver</span>
                <span>{distractions.length}</span>
              </div>
              <DistractionList
                items={distractions}
                maxHeight={180}
                onComplete={completeDistraction}
                onDelete={deleteDistraction}
              />
            </div>
          ) : null}
          <div style={nextFocusModalActions}>
            <button type="button" onClick={deferNextFocus} style={secondaryModalButton}>
              Ahora no
            </button>
            <button
              type="button"
              onClick={confirmNextFocus}
              style={confirmModalButton(activeTask?.color ?? '#d4943a')}
            >
              Empezar hora {nextFocusNumber}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}

const pageShell: CSSProperties = {
  minHeight: 'calc(100vh - 52px)',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
  padding: '16px',
  alignItems: 'stretch',
}

const panelBase: CSSProperties = {
  minHeight: 0,
  border: '1px solid #2e2b27',
  borderRadius: '8px',
  background: '#171513',
  overflow: 'hidden',
}

const leftPanel: CSSProperties = {
  ...panelBase,
  display: 'flex',
  flexDirection: 'column',
}

const rightPanel: CSSProperties = {
  ...panelBase,
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: '12px',
}

function timerPanel(isOver: boolean): CSSProperties {
  return {
    ...panelBase,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    padding: '26px 18px',
    borderColor: isOver ? '#c8a97e' : '#2e2b27',
    background: isOver
      ? 'linear-gradient(180deg, rgba(35,31,25,0.98) 0%, rgba(20,19,18,1) 100%)'
      : 'linear-gradient(180deg, rgba(26,25,23,0.96) 0%, rgba(15,14,13,1) 100%)',
    transition: 'border-color 0.16s ease, background 0.16s ease',
    overflow: 'hidden',
  }
}

const panelHeader: CSSProperties = {
  padding: '14px 14px 12px',
  borderBottom: '1px solid #24211d',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
}

const eyebrow: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const panelTitle: CSSProperties = {
  margin: 0,
  marginTop: '2px',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '24px',
  fontWeight: 300,
  color: '#f0e6d3',
  lineHeight: 1,
  textTransform: 'capitalize',
}

const smallGhostButton: CSSProperties = {
  padding: '5px 9px',
  borderRadius: '6px',
  border: '1px solid #2e2b27',
  background: '#211f1c',
  color: '#8b7e70',
  fontSize: '11px',
  cursor: 'pointer',
  flexShrink: 0,
}

const summaryRow: CSSProperties = {
  padding: '9px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  borderBottom: '1px solid #211f1c',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const tabRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px',
  padding: '9px 10px',
  borderBottom: '1px solid #211f1c',
  background: '#141311',
}

function tabButton(active: boolean): CSSProperties {
  return {
    minHeight: '32px',
    border: `1px solid ${active ? '#4a3923' : '#292621'}`,
    borderRadius: '7px',
    background: active ? '#251d12' : 'transparent',
    color: active ? '#f0b855' : '#7a6e61',
    fontSize: '11px',
    cursor: 'pointer',
  }
}

const tabCount: CSSProperties = {
  display: 'inline-block',
  minWidth: '17px',
  marginLeft: '6px',
  padding: '1px 4px',
  borderRadius: '999px',
  background: '#342718',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
}

const taskList: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '10px',
}

const leisureSectionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  margin: '2px 2px 8px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
}

const compactEmpty: CSSProperties = {
  marginBottom: '10px',
  padding: '13px 10px',
  border: '1px dashed #2e2b27',
  borderRadius: '7px',
  color: '#5c5349',
  fontSize: '11px',
  fontStyle: 'italic',
  textAlign: 'center',
}

function leisurePassCard(selected: boolean, active: boolean): CSSProperties {
  return {
    padding: '11px',
    marginBottom: '8px',
    borderRadius: '8px',
    border: `1px solid ${selected ? '#d4943a' : '#2e2b27'}`,
    borderLeft: `3px solid ${active ? '#f0b855' : '#7a9e87'}`,
    background: selected ? '#251d12' : '#211f1c',
  }
}

const pomodoroRewardCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '8px',
  padding: '11px',
  border: '1px solid #3a332a',
  borderLeft: '3px solid #d4943a',
  borderRadius: '8px',
  background: 'linear-gradient(135deg, #211d17, #191714)',
}

const rewardCopy: CSSProperties = {
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const rewardDuration: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  color: '#8ab89a',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const rewardTitle: CSSProperties = {
  color: '#f0e6d3',
  fontSize: '12px',
  lineHeight: 1.35,
  wordBreak: 'break-word',
}

const rewardRedeemColumn: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '6px',
}

const rewardPrice: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: '#f0b855',
}

function pomodoroRedeemButton(enabled: boolean): CSSProperties {
  return {
    minWidth: '76px',
    padding: '6px 9px',
    border: `1px solid ${enabled ? '#d4943a' : '#332f2a'}`,
    borderRadius: '6px',
    background: enabled ? '#2a1e0d' : '#181613',
    color: enabled ? '#f0b855' : '#4a4540',
    fontSize: '10px',
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}

function taskCard(task: PlanTask, isActive: boolean, isDragging: boolean): CSSProperties {
  return {
    padding: '10px',
    marginBottom: '8px',
    borderRadius: '8px',
    border: `1px solid ${isActive ? task.apartado.color : '#2e2b27'}`,
    borderLeft: `3px solid ${task.apartado.color}`,
    background: isActive ? '#211d19' : task.done ? '#181715' : '#211f1c',
    opacity: isDragging ? 0.45 : task.done ? 0.58 : 1,
    cursor: task.done ? 'default' : 'grab',
    transition: 'opacity 0.15s, border-color 0.15s, background 0.15s',
  }
}

const taskTopLine: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
}

function taskApartado(color: string): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    color,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
}

function priorityPill(priority: number): CSSProperties {
  const color = PRIORITY_COLORS[priority] ?? '#7a6e61'
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    color,
    border: `1px solid ${color}33`,
    borderRadius: '4px',
    padding: '1px 5px',
    flexShrink: 0,
  }
}

function taskName(done: boolean): CSSProperties {
  return {
    marginTop: '8px',
    color: done ? '#7a6e61' : '#f0e6d3',
    fontSize: '13px',
    lineHeight: 1.35,
    textDecoration: done ? 'line-through' : 'none',
    wordBreak: 'break-word',
  }
}

const taskNote: CSSProperties = {
  marginTop: '5px',
  fontSize: '11px',
  color: '#a69380',
  lineHeight: 1.35,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const taskMetaRow: CSSProperties = {
  marginTop: '9px',
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  flexWrap: 'wrap',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
}

const taskActionRow: CSSProperties = {
  marginTop: '9px',
  display: 'flex',
  justifyContent: 'flex-end',
}

function loadTaskButton(active: boolean, disabled: boolean): CSSProperties {
  return {
    padding: '6px 10px',
    borderRadius: '6px',
    border: `1px solid ${active ? '#d4943a55' : '#332f2a'}`,
    background: active ? '#2a1e0d' : '#1a1917',
    color: disabled && !active ? '#4a4540' : active ? '#f0b855' : '#c8a97e',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '11px',
  }
}

const doneBadge: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#8ab89a',
  border: '1px solid #2d4a38',
  borderRadius: '999px',
  padding: '3px 8px',
  background: '#172018',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const modeLabel: CSSProperties = {
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
}

function activeTaskBox(color?: string): CSSProperties {
  return {
    width: '100%',
    maxWidth: '420px',
    borderRadius: '8px',
    border: `1px solid ${color ? `${color}55` : '#2e2b27'}`,
    background: '#171513',
    padding: '14px',
    textAlign: 'center',
  }
}

const activeTaskCaption: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const activeTaskTitle: CSSProperties = {
  marginTop: '5px',
  color: '#f0e6d3',
  fontSize: '16px',
  lineHeight: 1.3,
  wordBreak: 'break-word',
}

const focusTrack: CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  justifyContent: 'center',
  gap: '6px',
  flexWrap: 'wrap',
}

function focusDot(done: boolean, color: string): CSSProperties {
  return {
    width: '26px',
    height: '7px',
    borderRadius: '999px',
    background: done ? color : '#2e2b27',
    opacity: done ? 1 : 0.8,
  }
}

const dropHint: CSSProperties = {
  marginTop: '8px',
  color: '#5c5349',
  fontSize: '12px',
  lineHeight: 1.35,
}

const timerCircleWrap: CSSProperties = {
  position: 'relative',
  width: 260,
  height: 260,
  flexShrink: 0,
}

const timerCenter: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}

const timerText: CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '56px',
  fontWeight: 300,
  color: '#f0e6d3',
  lineHeight: 1,
}

const timerSubtext: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: '#7a6e61',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const buttonRow: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

function primaryButton(running: boolean, accent: string): CSSProperties {
  return {
    padding: '12px 34px',
    borderRadius: '8px',
    border: `1px solid ${accent}`,
    background: running ? accent : 'transparent',
    color: running ? '#0f0e0d' : accent,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  }
}

const secondaryButton: CSSProperties = {
  padding: '12px 22px',
  borderRadius: '8px',
  border: '1px solid #2e2b27',
  background: 'transparent',
  color: '#7a6e61',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  letterSpacing: '0.02em',
}

function clearTaskButton(disabled: boolean): CSSProperties {
  return {
    ...secondaryButton,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.42 : 1,
  }
}

function finishButton(disabled: boolean): CSSProperties {
  return {
    ...secondaryButton,
    borderColor: '#7d493b',
    color: '#d98a70',
    background: '#251612',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}

function soundToggle(enabled: boolean, accent: string): CSSProperties {
  return {
    minWidth: '126px',
    padding: '7px 12px',
    borderRadius: '999px',
    border: `1px solid ${enabled ? `${accent}66` : '#2e2b27'}`,
    background: enabled ? `${accent}1f` : 'transparent',
    color: enabled ? accent : '#7a6e61',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }
}

const soundControls: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '14px',
  flexWrap: 'wrap',
}

const rainVolumeControl: CSSProperties = {
  width: '180px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
}

const rainVolumeHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

function rainVolumeSlider(accent: string): CSSProperties {
  return {
    width: '100%',
    height: '16px',
    margin: 0,
    accentColor: accent,
    cursor: 'pointer',
  }
}

const timerRule: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: '#4a4540',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  textAlign: 'center',
}

const nextFocusModalBody: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const nextFocusModalText: CSSProperties = {
  margin: 0,
  color: '#c8a97e',
  fontSize: '14px',
  lineHeight: 1.55,
}

const nextFocusModalHint: CSSProperties = {
  margin: 0,
  color: '#f0e6d3',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '22px',
  lineHeight: 1.2,
}

const modalDistractionReview: CSSProperties = {
  padding: '12px',
  border: '1px solid #3a332a',
  borderRadius: '9px',
  background: '#151412',
}

const modalDistractionHeader: CSSProperties = {
  marginBottom: '9px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#d4943a',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const nextFocusModalActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  marginTop: '8px',
  flexWrap: 'wrap',
}

const secondaryModalButton: CSSProperties = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #332f2a',
  background: 'transparent',
  color: '#8b7e70',
  fontSize: '13px',
  cursor: 'pointer',
}

function confirmModalButton(accent: string): CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: '8px',
    border: `1px solid ${accent}`,
    background: accent,
    color: '#0f0e0d',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  }
}

const noticeBox: CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  padding: '9px 11px',
  borderRadius: '7px',
  border: '1px solid #d4943a33',
  background: '#2a1e0d',
  color: '#d4943a',
  fontSize: '12px',
  textAlign: 'center',
}

const errorBox: CSSProperties = {
  margin: '10px',
  padding: '9px 11px',
  borderRadius: '7px',
  border: '1px solid #c45a3a55',
  background: '#2a1712',
  color: '#d98a70',
  fontSize: '12px',
}

const focusCount: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: '#d4943a',
  border: '1px solid #d4943a33',
  borderRadius: '999px',
  padding: '4px 8px',
  background: '#2a1e0d',
  flexShrink: 0,
}

const dailyStats: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  padding: '12px',
  borderBottom: '1px solid #211f1c',
}

const distractionSection: CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid #211f1c',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  background: 'linear-gradient(180deg, #1b1814 0%, #171513 100%)',
}

const distractionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
}

const distractionTitle: CSSProperties = {
  margin: '2px 0 0',
  color: '#f0e6d3',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '19px',
  fontWeight: 400,
  lineHeight: 1,
}

const distractionCount: CSSProperties = {
  flexShrink: 0,
  padding: '3px 7px',
  border: '1px solid #d4943a33',
  borderRadius: '999px',
  background: '#2a1e0d',
  color: '#d4943a',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const distractionForm: CSSProperties = {
  display: 'flex',
  gap: '7px',
}

const distractionInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '9px 10px',
  border: '1px solid #332f2a',
  borderRadius: '7px',
  background: '#12110f',
  color: '#f0e6d3',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '12px',
  outlineColor: '#d4943a',
}

function addDistractionButton(enabled: boolean): CSSProperties {
  return {
    padding: '8px 10px',
    border: `1px solid ${enabled ? '#d4943a66' : '#2e2b27'}`,
    borderRadius: '7px',
    background: enabled ? '#2a1e0d' : '#181613',
    color: enabled ? '#d4943a' : '#4a4540',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}

const distractionList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
  overflowY: 'auto',
  paddingRight: '2px',
}

const distractionItem: CSSProperties = {
  padding: '9px',
  border: '1px solid #2e2b27',
  borderLeft: '2px solid #d4943a',
  borderRadius: '7px',
  background: '#1f1c18',
}

const distractionCopy: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '10px',
}

const distractionText: CSSProperties = {
  minWidth: 0,
  color: '#e4d7c4',
  fontSize: '12px',
  lineHeight: 1.4,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const distractionTime: CSSProperties = {
  flexShrink: 0,
  color: '#5c5349',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
}

const distractionActions: CSSProperties = {
  marginTop: '7px',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '6px',
}

const distractionDoneButton: CSSProperties = {
  padding: '4px 7px',
  border: '1px solid #4f7f5d55',
  borderRadius: '5px',
  background: '#172018',
  color: '#8ab89a',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const distractionDeleteButton: CSSProperties = {
  padding: '4px 7px',
  border: '1px solid #7d493b55',
  borderRadius: '5px',
  background: 'transparent',
  color: '#9c6b5d',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '8px',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const distractionEmpty: CSSProperties = {
  padding: '12px 8px',
  border: '1px dashed #2e2b27',
  borderRadius: '7px',
  color: '#5c5349',
  fontSize: '11px',
  fontStyle: 'italic',
  textAlign: 'center',
}

const statNumber: CSSProperties = {
  display: 'block',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '30px',
  color: '#f0e6d3',
  lineHeight: 1,
}

const statLabel: CSSProperties = {
  display: 'block',
  marginTop: '4px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  color: '#7a6e61',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const logList: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '10px 12px',
}

const logRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '9px 0',
  borderBottom: '1px solid #211f1c',
}

function logDot(type: 'focus' | 'break' | 'leisure'): CSSProperties {
  return {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: type === 'focus' ? '#d4943a' : type === 'leisure' ? '#f0b855' : '#7a9e87',
    flexShrink: 0,
  }
}

const logCopy: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

const logTitle: CSSProperties = {
  fontSize: '12px',
  color: '#c8a97e',
}

const logTaskName: CSSProperties = {
  fontSize: '11px',
  color: '#7a6e61',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const logTime: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  color: '#4a4540',
  flexShrink: 0,
}

const emptyState: CSSProperties = {
  padding: '24px 10px',
  color: '#4a4540',
  fontSize: '12px',
  textAlign: 'center',
  fontStyle: 'italic',
}
