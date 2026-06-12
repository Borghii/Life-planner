import { motion } from 'framer-motion'
import { useDashboardStore } from '../../store/useDashboardStore'
import type { TaskBlock, TimelineBlock as TBlock } from '../../api/types'

const PRIORITY_COLORS: Record<number, string> = {
  1: '#c45a3a',
  2: '#d4943a',
  3: '#c8a97e',
  4: '#5a7ab5',
  5: '#5a8a6a',
}

const ACTIVE_ROW_BACKGROUND = '#241d16'
const HOVER_ROW_BACKGROUND = '#211c17'

function PriorityBadge({ p }: { p: number }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '9px',
      fontWeight: 500,
      color: PRIORITY_COLORS[p] ?? '#7a6e61',
      letterSpacing: '0.05em',
      border: `1px solid ${PRIORITY_COLORS[p] ?? '#2e2b27'}33`,
      borderRadius: '3px',
      padding: '1px 5px',
      flexShrink: 0,
    }}>
      P{p}
    </span>
  )
}

interface Props {
  block: TBlock
  blockKey: string
  top: number
  hourPx: number
  index: number
  activeTaskId: string | null
  measureBlock: (blockKey: string) => (node: HTMLDivElement | null) => void
  onTaskActionsToggle: (blockKey: string, blockColor: string, task: TaskBlock) => void
  onExecuteAction: (actionId: number) => void
  onStartPomodoroTask: (task: TaskBlock, color: string) => void
}

function actionCountPill(active: boolean): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    color: active ? '#f0b855' : '#8b7e70',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderRadius: '999px',
    border: active ? '1px solid #d4943a44' : '1px solid #332f2a',
    background: active ? '#2a1e0d' : '#1d1a17',
    padding: '2px 7px',
    flexShrink: 0,
  }
}

function startPomodoroButton(color: string): React.CSSProperties {
  return {
    minWidth: '48px',
    padding: '4px 7px',
    borderRadius: '5px',
    border: `1px solid ${color}55`,
    background: '#211d19',
    color,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    flexShrink: 0,
  }
}

export function TimelineBlockItem({ block, blockKey, top, hourPx, index, activeTaskId, measureBlock, onTaskActionsToggle, onExecuteAction, onStartPomodoroTask }: Props) {
  const toggleTask = useDashboardStore((s) => s.toggleTask)

  const tasks = block.tasks ?? []
  const height = Math.max(block.duration_hours * hourPx, 40)
  const isAllDone = block.done

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        right: 0,
        height: `${height}px`,
        background: '#1a1917',
        borderRadius: '8px',
        border: '1px solid #2e2b27',
        borderLeft: `3px solid ${block.color}`,
        overflow: 'hidden',
        opacity: isAllDone ? 0.6 : 1,
        transition: 'opacity 0.3s',
        boxSizing: 'border-box',
      }}
    >
      <div ref={measureBlock(blockKey)} style={{ boxSizing: 'border-box' }}>
      <div style={{
        padding: '5px 9px 4px',
        borderBottom: tasks.length > 0 ? '1px solid #211f1c' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: block.color,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '10px',
          color: '#c8a97e',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          {block.name}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          color: '#7a6e61',
          letterSpacing: '0.04em',
        }}>
          {String(Math.floor(block.start_hour)).padStart(2, '0')}:{String(Math.round((block.start_hour % 1) * 60)).padStart(2, '0')} - {String(Math.floor(block.end_hour)).padStart(2, '0')}:{String(Math.round((block.end_hour % 1) * 60)).padStart(2, '0')}
        </span>
      </div>

      <div>
        {tasks.map((task) => {
          const taskActions = task.acciones ?? task.actions ?? []
          const hasActions = taskActions.length > 0
          const isTaskOpen = activeTaskId === task.plan_dia_id

          return (
            <div key={task.plan_dia_id}>
              <div
                data-task-actions-trigger={hasActions ? 'true' : undefined}
                onClick={() => {
                  if (!hasActions) return
                  onTaskActionsToggle(blockKey, block.color, task)
                }}
                onKeyDown={(event) => {
                  if (!hasActions) return
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onTaskActionsToggle(blockKey, block.color, task)
                }}
                onMouseEnter={(event) => {
                  if (!hasActions || isTaskOpen) return
                  event.currentTarget.style.background = HOVER_ROW_BACKGROUND
                }}
                onMouseLeave={(event) => {
                  if (!hasActions) return
                  event.currentTarget.style.background = isTaskOpen ? ACTIVE_ROW_BACKGROUND : 'transparent'
                }}
                role={hasActions ? 'button' : undefined}
                tabIndex={hasActions ? 0 : -1}
                aria-expanded={hasActions ? isTaskOpen : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 9px',
                  borderBottom: '1px solid #1a1917',
                  cursor: hasActions ? 'pointer' : 'default',
                  transition: 'background 0.16s ease, box-shadow 0.16s ease',
                  background: isTaskOpen ? ACTIVE_ROW_BACKGROUND : 'transparent',
                  boxShadow: isTaskOpen ? 'inset 0 0 0 1px rgba(212, 148, 58, 0.18)' : 'none',
                  outline: 'none',
                }}
              >
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={(event) => {
                    event.stopPropagation()
                    void toggleTask(task.plan_dia_id, !task.done)
                  }}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    border: task.done ? '2px solid #5a8a6a' : '2px solid #3d3830',
                    background: task.done ? '#2d4a38' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                    padding: 0,
                  }}
                >
                  {task.done && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      width="9"
                      height="9"
                      viewBox="0 0 9 9"
                    >
                      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#8ab89a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </motion.svg>
                  )}
                </motion.button>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: task.done ? '#7a6e61' : '#f0e6d3',
                      textDecoration: task.done ? 'line-through' : 'none',
                      transition: 'color 0.2s',
                      lineHeight: 1.3,
                    }}
                  >
                    {task.name}
                    {task.repeticiones > 1 && (
                      <span style={{ color: '#7a6e61', fontSize: '10px', marginLeft: '5px' }}>
                        x{task.repeticiones}
                      </span>
                    )}
                  </span>
                  {task.note && (
                    <span style={{
                      display: 'block',
                      marginTop: '3px',
                      fontSize: '11px',
                      color: '#a69380',
                      lineHeight: 1.35,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}>
                      {task.note}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {!task.done && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      title={`Empezar ${task.name} en Pomodoro`}
                      aria-label={`Empezar ${task.name} en Pomodoro`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onStartPomodoroTask(task, block.color)
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation()
                      }}
                      style={startPomodoroButton(block.color)}
                    >
                      Foco
                    </motion.button>
                  )}
                  {hasActions && (
                    <span style={actionCountPill(isTaskOpen)}>
                      {taskActions.length} acc
                    </span>
                  )}
                  <PriorityBadge p={task.priority} />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    color: '#7a6e61',
                  }}>
                    {task.pomos * task.repeticiones}h
                  </span>
                </div>
              </div>
              {isTaskOpen && taskActions.length > 0 && (
                <div data-task-actions-panel="true" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '8px 9px 9px 33px',
                  borderBottom: '1px solid #1a1917',
                  background: '#171513',
                }}>
                  {taskActions.map((action) => (
                    <motion.button
                      key={action.id}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => onExecuteAction(action.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #332f2a',
                        background: '#211d19',
                        color: '#f0e6d3',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                      }}>
                        {action.label}
                      </span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '9px',
                        color: '#c8a97e',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>
                        Abrir
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      </div>
    </motion.div>
  )
}
