import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNowPosition } from '../../hooks/useNowPosition'
import { fonts, spacing } from '../../design/tokens'
import { ejecutarAccion } from '../../api/library'
import { NowIndicator } from './NowIndicator'
import { TimelineBlockItem } from './TimelineBlock'
import type { TaskBlock, TimelineV2 as TV2 } from '../../api/types'

interface Props {
  timeline: TV2
  dayStart: number
  dayEnd: number
  onStartPomodoroTask: (task: TaskBlock, color: string) => void
}

interface OpenTaskPanel {
  blockKey: string
  taskId: string
}

const EMPTY_BLOCKS: TV2['blocks'] = []
const EMPTY_OVERFLOW: TV2['overflow'] = []

function formatHour(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

function getBlockKey(block: TV2['blocks'][number], index: number) {
  return `${block.id}-${block.start_hour}-${block.end_hour}-${index}`
}

function sortTimelineBlocks(blocks: TV2['blocks']) {
  return [...blocks].sort((a, b) => (
    a.start_hour - b.start_hour ||
    a.end_hour - b.end_hour ||
    a.id - b.id ||
    a.name.localeCompare(b.name)
  ))
}

export function TimelineV2({ timeline, dayStart, dayEnd, onStartPomodoroTask }: Props) {
  const rawBlocks = timeline.blocks ?? EMPTY_BLOCKS
  const rawOverflow = timeline.overflow ?? EMPTY_OVERFLOW
  const blocks = useMemo(() => sortTimelineBlocks(rawBlocks), [rawBlocks])
  const overflow = useMemo(() => sortTimelineBlocks(rawOverflow), [rawOverflow])
  const [blockHeights, setBlockHeights] = useState<Record<string, number>>({})
  const blockResizeObservers = useRef<Map<string, ResizeObserver>>(new Map())
  const blockKeys = useMemo(
    () => blocks.map((block, index) => getBlockKey(block, index)),
    [blocks],
  )
  const hourPx = Math.ceil(Math.max(
    spacing.hourPx,
    ...blocks.map((block, index) => {
      const measuredHeight = blockHeights[blockKeys[index]] ?? 0
      return measuredHeight > 0
        ? (measuredHeight + 4) / Math.max(1, block.duration_hours)
        : spacing.hourPx
    }),
  ))
  const hours = Array.from({ length: dayEnd - dayStart + 1 }, (_, i) => dayStart + i)
  const totalHeight = (dayEnd - dayStart) * hourPx
  const { top: nowTop, isVisible } = useNowPosition(dayStart, dayEnd, hourPx)
  const containerRef = useRef<HTMLDivElement>(null)
  const didAutoScrollRef = useRef(false)
  const [openPanel, setOpenPanel] = useState<OpenTaskPanel | null>(null)
  const activeOpenPanel = useMemo(() => {
    if (!openPanel) return null

    const stillExists = blocks.some((block, index) => {
      if (getBlockKey(block, index) !== openPanel.blockKey) return false
      return (block.tasks ?? []).some((task) => task.plan_dia_id === openPanel.taskId)
    })

    return stillExists ? openPanel : null
  }, [blocks, openPanel])

  const measureBlock = useCallback((blockKey: string) => (node: HTMLDivElement | null) => {
    blockResizeObservers.current.get(blockKey)?.disconnect()
    blockResizeObservers.current.delete(blockKey)
    if (!node) return

    const updateHeight = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height)
      setBlockHeights((current) => (
        current[blockKey] === nextHeight ? current : { ...current, [blockKey]: nextHeight }
      ))
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    blockResizeObservers.current.set(blockKey, observer)
  }, [])

  useEffect(() => () => {
    blockResizeObservers.current.forEach((observer) => observer.disconnect())
    blockResizeObservers.current.clear()
  }, [])

  useEffect(() => {
    if (didAutoScrollRef.current) return
    if (!containerRef.current || !isVisible) return
    const scrollTo = Math.max(0, nowTop - 120)
    containerRef.current.scrollTop = scrollTo
    didAutoScrollRef.current = true
  }, [isVisible, nowTop])

  useEffect(() => {
    if (!activeOpenPanel) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (target instanceof Element && target.closest('[data-task-actions-trigger="true"]')) return
      if (target instanceof Element && target.closest('[data-task-actions-panel="true"]')) return
      setOpenPanel(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPanel(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeOpenPanel])

  async function handleExecuteAction(actionId: number) {
    try {
      await ejecutarAccion(actionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      window.alert(`No se pudo ejecutar accion: ${message}`)
    }
  }

  function handleTaskActionsToggle(blockKey: string, _blockColor: string, task: TaskBlock) {
    const actions = task.acciones ?? task.actions ?? []
    if (actions.length === 0) {
      setOpenPanel(null)
      return
    }

    if (activeOpenPanel?.blockKey === blockKey && activeOpenPanel.taskId === task.plan_dia_id) {
      setOpenPanel(null)
      return
    }

    setOpenPanel({
      blockKey,
      taskId: task.plan_dia_id,
    })
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        padding: '12px 0 24px',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            position: 'relative',
            minHeight: `${totalHeight + 80}px`,
          }}
        >
          {hours.map((h) => {
            const y = (h - dayStart) * hourPx
            return (
              <div key={h} style={{
                position: 'absolute',
                top: `${y}px`,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'flex-start',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: `${spacing.hourLabelWidth}px`,
                  flexShrink: 0,
                  fontFamily: fonts.mono,
                  fontSize: '9px',
                  color: '#3d3830',
                  letterSpacing: '0.06em',
                  textAlign: 'center',
                  transform: 'translateY(-50%)',
                }}>
                  {formatHour(h)}
                </div>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: '#1f1d1a',
                }} />
              </div>
            )
          })}

          <div style={{
            position: 'absolute',
            top: 0,
            left: `${spacing.hourLabelWidth + 10}px`,
            right: 0,
            zIndex: 1,
          }}>
            {blocks.map((block, index) => {
              const blockKey = blockKeys[index]
              const top = Math.max(0, (block.start_hour - dayStart) * hourPx)
              return (
                <TimelineBlockItem
                  key={blockKey}
                  block={block}
                  blockKey={blockKey}
                  top={top}
                  hourPx={hourPx}
                  index={index}
                  activeTaskId={activeOpenPanel?.blockKey === blockKey ? activeOpenPanel.taskId : null}
                  measureBlock={measureBlock}
                  onTaskActionsToggle={handleTaskActionsToggle}
                  onExecuteAction={(actionId) => void handleExecuteAction(actionId)}
                  onStartPomodoroTask={onStartPomodoroTask}
                />
              )
            })}
          </div>

          {isVisible && (
            <NowIndicator top={nowTop} labelWidth={spacing.hourLabelWidth} />
          )}
        </div>

        {overflow.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: 'relative',
              zIndex: 1,
              marginTop: '16px',
              marginLeft: `${spacing.hourLabelWidth + 10}px`,
            }}
          >
            <div style={{
              fontSize: '10px',
              color: '#7a6e61',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
              paddingLeft: '2px',
            }}>
              fuera de jornada
            </div>
            {overflow.map((block, index) => (
              <div
                key={getBlockKey(block, index)}
                style={{
                  background: '#1a1917',
                  borderRadius: '6px',
                  border: '1px solid #2e2b27',
                  borderLeft: `3px solid ${block.color}40`,
                  padding: '8px 10px',
                  marginBottom: '6px',
                  opacity: 0.5,
                }}
              >
                <div style={{ fontSize: '12px', color: '#7a6e61' }}>
                  <span style={{ color: block.color, marginRight: '6px' }}>-</span>
                  {block.name}
                </div>
                {(block.tasks ?? []).map((task) => (
                  <div key={task.plan_dia_id} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    paddingLeft: '14px',
                    marginTop: '4px',
                  }}>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '12px',
                      color: '#3d3830',
                    }}>
                      {task.name}
                      {task.note && (
                        <div style={{
                          marginTop: '2px',
                          color: '#7a6e61',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}>
                          {task.note}
                        </div>
                      )}
                    </div>
                    {!task.done && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        title={`Empezar ${task.name} en Pomodoro`}
                        onClick={() => onStartPomodoroTask(task, block.color)}
                        style={{
                          minWidth: '48px',
                          padding: '4px 7px',
                          borderRadius: '5px',
                          border: `1px solid ${block.color}44`,
                          background: '#211d19',
                          color: block.color,
                          fontSize: '10px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Foco
                      </motion.button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
