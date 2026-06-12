import { useState } from 'react'
import { motion } from 'framer-motion'

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  monthDots: Map<string, number>
  reminderDots?: Set<string>
  selectedDate?: string | null
  onMonthChange?: (month: string) => void
  onDateClick?: (date: string) => void
}

export function MiniCalendar({ monthDots, reminderDots, selectedDate, onMonthChange, onDateClick }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  function getDaysInMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  }

  function getFirstDayOfWeek(d: Date) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1)
    return (first.getDay() + 6) % 7
  }

  const daysInMonth = getDaysInMonth(cursor)
  const startOffset = getFirstDayOfWeek(cursor)

  function navigate(dir: -1 | 1) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)
    setCursor(next)
    onMonthChange?.(getMonthStr(next))
  }

  return (
    <div style={{ marginBottom: '4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#7a6e61', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>
          ‹
        </button>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#c8a97e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {MONTHS_ES[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <button onClick={() => navigate(1)}
          style={{ background: 'none', border: 'none', color: '#7a6e61', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>
          ›
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: '#3d3830', letterSpacing: '0.06em', fontWeight: 600, padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasTaskDot = monthDots.has(dateStr)
          const hasReminderDot = reminderDots?.has(dateStr) ?? false

          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.85 }}
              onClick={() => onDateClick?.(dateStr)}
              style={{
                width: '100%',
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '5px',
                border: isSelected ? '1px solid #d4943a55' : 'none',
                background: isToday ? '#2a1e0d' : isSelected ? '#2a1e0d88' : 'transparent',
                color: isToday || isSelected ? '#d4943a' : '#7a6e61',
                fontSize: '11px',
                cursor: 'pointer',
                position: 'relative',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: isToday || isSelected ? 600 : 400,
                padding: 0,
                gap: '1px',
              }}
            >
              {day}
              {(hasTaskDot || hasReminderDot) && (
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  {hasTaskDot && (
                    <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: isToday || isSelected ? '#d4943a' : '#3d3830' }} />
                  )}
                  {hasReminderDot && (
                    <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#5a7ab5' }} />
                  )}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
