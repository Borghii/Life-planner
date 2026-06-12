import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHistoryStore } from '../store/useHistoryStore'
import { useEconomyStore } from '../store/useEconomyStore'
import { heatLevels } from '../design/tokens'
import type { HeatDay } from '../api/types'

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAYS_MIN = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAY_SIZE = 18
const DAY_GAP = 4
const CALENDAR_SURFACE_WIDTH = 'min(100%, 1180px)'
const HISTORY_RAIL_WIDTH = 'min(100%, 1320px)'
const DETAIL_PANEL_WIDTH = '300px'

function getLevel(day: HeatDay): string {
  if (day.total === 0) return heatLevels.none
  const ratio = day.done / day.total
  if (ratio === 0) return heatLevels.zero
  if (ratio < 0.34) return heatLevels.low
  if (ratio < 0.67) return heatLevels.mid
  if (ratio < 1.0) return heatLevels.high
  return heatLevels.full
}

function AnimatedCounter({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {value.toLocaleString()}
    </motion.span>
  )
}

function formatSelectedDate(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`)
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`
}

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getYesterdayDateStr() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateStr(date)
}

export function HistoryPage() {
  const pointsBalance = useEconomyStore((state) => state.balance)
  const {
    year,
    yearData,
    selectedDate,
    dayDetail,
    streak,
    pendingTaskIds,
    error,
    loading,
    fetchYear,
    selectDate,
    toggleTaskDone,
    setYear,
    clearSelection,
  } = useHistoryStore()
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 780 : false
  )

  useEffect(() => {
    fetchYear()
  }, [])

  useEffect(() => {
    function handleResize() {
      setIsCompact(window.innerWidth < 780)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const byMonth: Record<number, HeatDay[]> = {}
  if (yearData) {
    yearData.days.forEach((day) => {
      const month = new Date(`${day.fecha}T12:00:00`).getMonth()
      ;(byMonth[month] = byMonth[month] ?? []).push(day)
    })
  }

  const totalPlanned = yearData?.days.reduce((sum, day) => sum + day.total, 0) ?? 0
  const totalDone = yearData?.days.reduce((sum, day) => sum + day.done, 0) ?? 0
  const pct = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0
  const showSidePanel = Boolean(selectedDate) && !isCompact
  const yesterday = getYesterdayDateStr()
  const today = toDateStr(new Date())
  const canEditSelectedDate = selectedDate ? selectedDate <= today : false
  const isTaskSaving = pendingTaskIds.size > 0

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px 24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '28px', width: CALENDAR_SURFACE_WIDTH, marginInline: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '4px' }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '36px',
            fontWeight: 300,
            color: '#f0e6d3',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Historial
          </h1>
          <span style={{
            padding: '4px 9px',
            border: `1px solid ${pointsBalance < 0 ? '#7d493b' : '#4a3923'}`,
            borderRadius: '999px',
            color: pointsBalance < 0 ? '#d98a70' : '#f0b855',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
          }}>
            {pointsBalance} pts
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setYear(year - 1)} style={yearBtn}>
              {'<'}
            </button>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '16px',
              color: '#d4943a',
              minWidth: '48px',
              textAlign: 'center',
            }}>
              {year}
            </span>
            <button onClick={() => setYear(year + 1)} style={yearBtn}>
              {'>'}
            </button>
          </div>
          <button
            onClick={() => {
              void selectDate(yesterday)
            }}
            style={quickDateBtn(selectedDate === yesterday)}
          >
            Ayer
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '10px',
          margin: '0 auto 28px',
          width: CALENDAR_SURFACE_WIDTH,
        }}
      >
        {[
          { label: 'Planificadas', value: totalPlanned, color: '#c8a97e' },
          { label: 'Completadas', value: totalDone, color: '#8ab89a' },
          { label: 'Tasa', value: `${pct}%`, color: '#d4943a', raw: true },
          { label: 'Racha actual', value: `${streak.current}d`, color: '#f0b855', raw: true },
        ].map(({ label, value, color, raw }) => (
          <div key={label} style={{
            background: '#1a1917',
            borderRadius: '8px',
            border: '1px solid #2e2b27',
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: '10px', color: '#7a6e61', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              {label}
            </div>
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '28px',
              color,
              fontWeight: 300,
              lineHeight: 1,
            }}>
              {raw ? value : <AnimatedCounter value={value as number} />}
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div
        layout
        transition={{ layout: { duration: 0.28, ease: 'easeInOut' } }}
        style={{
          display: 'grid',
          gridTemplateColumns: showSidePanel ? `minmax(0, 1fr) ${DETAIL_PANEL_WIDTH}` : 'minmax(0, 1fr)',
          gap: '24px',
          alignItems: 'start',
          width: showSidePanel ? HISTORY_RAIL_WIDTH : CALENDAR_SURFACE_WIDTH,
          margin: '0 auto',
        }}
      >
        <motion.div layout>
          {loading ? (
            <div style={{ color: '#3d3830', fontSize: '13px', padding: '48px', textAlign: 'center' }}>
              Cargando...
            </div>
          ) : (
            <div style={{
              display: 'flex',
              gap: '28px 24px',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'center',
              width: '100%',
            }}>
              {Array.from({ length: 12 }).map((_, monthIndex) => {
                const days = byMonth[monthIndex] ?? []
                const monthStart = new Date(year, monthIndex, 1)
                const firstDow = monthStart.getDay()
                const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

                return (
                  <motion.div
                    key={monthIndex}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: monthIndex * 0.03 }}
                    style={{ minWidth: '176px' }}
                  >
                    <div style={{
                      fontSize: '10px',
                      color: '#7a6e61',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {MONTHS_ES[monthIndex]}
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(7, ${DAY_SIZE}px)`,
                      gap: `${DAY_GAP}px`,
                      marginBottom: `${DAY_GAP}px`,
                    }}>
                      {DAYS_MIN.map((day) => (
                        <div key={day} style={{
                          width: `${DAY_SIZE}px`,
                          height: '12px',
                          fontSize: '8px',
                          color: '#2e2b27',
                          textAlign: 'center',
                        }}>
                          {day}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${DAY_SIZE}px)`, gap: `${DAY_GAP}px` }}>
                      {Array.from({ length: firstDow }).map((_, index) => (
                        <div key={`empty-${monthIndex}-${index}`} style={{ width: `${DAY_SIZE}px`, height: `${DAY_SIZE}px` }} />
                      ))}

                      {Array.from({ length: daysInMonth }).map((_, index) => {
                        const day = index + 1
                        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const heatDay = days.find((entry) => entry.fecha === dateStr) ?? { fecha: dateStr, total: 0, done: 0 }
                        const isSelected = selectedDate === dateStr

                        return (
                          <motion.div
                            key={dateStr}
                            whileHover={{ scale: 1.14 }}
                            onClick={() => selectDate(dateStr)}
                            title={`${dateStr}: ${heatDay.done}/${heatDay.total}`}
                            style={{
                              width: `${DAY_SIZE}px`,
                              height: `${DAY_SIZE}px`,
                              borderRadius: '4px',
                              background: getLevel(heatDay),
                              cursor: 'pointer',
                              border: isSelected ? '1px solid #d4943a' : 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '20px', justifyContent: 'center' }}>
            <span style={{ fontSize: '10px', color: '#3d3830' }}>Menos</span>
            {Object.values(heatLevels).map((color, index) => (
              <div key={index} style={{ width: '10px', height: '10px', borderRadius: '2px', background: color }} />
            ))}
            <span style={{ fontSize: '10px', color: '#3d3830' }}>Mas</span>
            {streak.best > 0 && (
              <span style={{ marginLeft: '16px', fontSize: '11px', color: '#7a6e61', fontFamily: "'JetBrains Mono', monospace" }}>
                Mejor racha: {streak.best}d
              </span>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.aside
              key={selectedDate}
              initial={{ opacity: 0, x: showSidePanel ? 18 : 0, y: showSidePanel ? 0 : 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: showSidePanel ? 18 : 0, y: showSidePanel ? 0 : 10 }}
              transition={{ duration: 0.25 }}
              style={{
                position: showSidePanel ? 'sticky' : 'relative',
                top: showSidePanel ? '24px' : undefined,
                width: showSidePanel ? DETAIL_PANEL_WIDTH : '100%',
                background: '#1a1917',
                borderRadius: '10px',
                border: '1px solid #2e2b27',
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '20px',
                  color: '#f0e6d3',
                  fontWeight: 300,
                }}>
                  {formatSelectedDate(selectedDate)}
                </span>
                <button onClick={clearSelection} style={closeBtn}>
                  x
                </button>
              </div>

              {error && (
                <div style={errorBox}>
                  {error}
                </div>
              )}

              {!dayDetail ? (
                <div style={{ color: '#3d3830', fontSize: '12px' }}>Cargando...</div>
              ) : dayDetail.tasks.length === 0 ? (
                <div style={{ color: '#3d3830', fontSize: '12px', fontStyle: 'italic' }}>
                  Sin tareas registradas para este dia
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dayDetail.tasks.map((task) => {
                    const isPending = pendingTaskIds.has(task.plan_dia_id)
                    const checkDisabled = !canEditSelectedDate || isTaskSaving

                    return (
                      <motion.div
                        key={task.plan_dia_id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: isPending ? 0.72 : 1, x: 0 }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          background: task.done ? '#1d2e22' : '#211f1c',
                          borderRadius: '6px',
                          border: `1px solid ${task.done ? '#2d4a38' : '#2e2b27'}`,
                          borderLeft: `3px solid ${task.apartado.color}`,
                        }}
                      >
                        <motion.button
                          whileTap={checkDisabled ? undefined : { scale: 0.86 }}
                          type="button"
                          disabled={checkDisabled}
                          aria-label={task.done ? `Desmarcar ${task.name}` : `Marcar ${task.name}`}
                          aria-pressed={task.done}
                          onClick={() => {
                            void toggleTaskDone(task.plan_dia_id, !task.done)
                          }}
                          style={taskCheckBtn(task.done, checkDisabled)}
                        >
                          {task.done && (
                            <motion.svg
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                            >
                              <path d="M1.6 5L4 7.3L8.4 2.5" stroke="#8ab89a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            </motion.svg>
                          )}
                        </motion.button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: '13px',
                            color: task.done ? '#8ab89a' : '#c8a97e',
                            lineHeight: 1.35,
                            textDecoration: task.done ? 'line-through' : 'none',
                          }}>
                            {task.name}
                          </span>
                          {task.note && (
                            <div style={{
                              marginTop: '3px',
                              fontSize: '11px',
                              color: '#a69380',
                              lineHeight: 1.35,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}>
                              {task.note}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#7a6e61' }}>{task.apartado.name}</span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '9px',
                          color: '#3d3830',
                          flexShrink: 0,
                        }}>
                          P{task.priority} | {task.pomos * task.repeticiones}h
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

const yearBtn: React.CSSProperties = {
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '5px',
  padding: '3px 10px',
  color: '#c8a97e',
  fontSize: '16px',
  cursor: 'pointer',
  lineHeight: 1,
}

const quickDateBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#2a1e0d' : '#211f1c',
  border: active ? '1px solid #d4943a55' : '1px solid #2e2b27',
  borderRadius: '6px',
  padding: '5px 12px',
  color: active ? '#f0b855' : '#c8a97e',
  fontSize: '11px',
  cursor: 'pointer',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  letterSpacing: '0.02em',
})

const closeBtn: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '999px',
  border: '1px solid #2e2b27',
  background: '#211f1c',
  color: '#7a6e61',
  cursor: 'pointer',
  flexShrink: 0,
}

const errorBox: React.CSSProperties = {
  marginBottom: '12px',
  padding: '8px 10px',
  borderRadius: '6px',
  border: '1px solid #7a3e2c',
  background: '#2a1712',
  color: '#d68b72',
  fontSize: '12px',
  lineHeight: 1.35,
}

const taskCheckBtn = (done: boolean, disabled: boolean): React.CSSProperties => ({
  width: '18px',
  height: '18px',
  borderRadius: '5px',
  border: done ? '2px solid #5a8a6a' : '2px solid #3d3830',
  background: done ? '#2d4a38' : 'transparent',
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.2s',
  padding: 0,
  opacity: disabled ? 0.65 : 1,
})
