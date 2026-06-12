import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDashboardStore } from '../store/useDashboardStore'
import { useConfigStore } from '../store/useConfigStore'
import { usePomodoroStore } from '../store/usePomodoroStore'
import { useEconomyStore } from '../store/useEconomyStore'
import type { TaskBlock } from '../api/types'
import { HeroGreeting } from '../components/dashboard/HeroGreeting'
import { ClockDisplay } from '../components/dashboard/ClockDisplay'
import { DayProgressRing } from '../components/dashboard/DayProgressRing'
import { WeatherWidget } from '../components/dashboard/WeatherWidget'
import { DailyQuote } from '../components/dashboard/DailyQuote'
import { TimelineV2 } from '../components/dashboard/TimelineV2'
import { MiniCalendar } from '../components/dashboard/MiniCalendar'
import { ReminderList } from '../components/dashboard/ReminderList'
import { LifeObjectives } from '../components/dashboard/LifeObjectives'
import { AdaptPlanModal } from '../components/dashboard/AdaptPlanModal'

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const COL = 'calc(100% / 3)'

export function DashboardPage() {
  const navigate = useNavigate()
  const {
    payload, weather, monthDots, reminderDots,
    fetchToday, fetchWeather, fetchMonthDots, fetchReminders,
    loading,
  } = useDashboardStore()
  const { config, fetch: fetchConfig } = useConfigStore()
  const pomodoroRunning = usePomodoroStore((s) => s.running)
  const pointsBalance = useEconomyStore((s) => s.balance)
  const loadPomodoroTask = usePomodoroStore((s) => s.loadTask)
  const startPomodoroTimer = usePomodoroStore((s) => s.startTimer)
  const [adaptOpen, setAdaptOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
    fetchToday()
    fetchWeather()
    const now = new Date()
    const month = toMonthStr(now)
    fetchMonthDots(month)
    fetchReminders(month)

    const wInterval = setInterval(fetchWeather, 15 * 60 * 1000)
    return () => clearInterval(wInterval)
  }, [])

  const dayStart = payload?.day_start ?? config?.day_start ?? 6
  const dayEnd = payload?.day_end ?? config?.day_end ?? 22
  const planDate = payload?.date ?? toDateStr()

  const handleStartPomodoroTask = useCallback((task: TaskBlock, color: string) => {
    if (pomodoroRunning) {
      navigate('/pomodoro')
      return
    }

    const loaded = loadPomodoroTask({
      plan_dia_id: task.plan_dia_id,
      name: task.name,
      color,
      date: planDate,
      totalFocusSessions: Math.max(1, Math.ceil(task.pomos * task.repeticiones)),
    })

    if (loaded) {
      startPomodoroTimer()
    }

    navigate('/pomodoro')
  }, [loadPomodoroTask, navigate, planDate, pomodoroRunning, startPomodoroTimer])

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 52px)',
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Columna izquierda */}
      <motion.aside
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          width: COL,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          padding: '22px 18px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          background: 'linear-gradient(180deg, rgba(26,25,23,0.94) 0%, rgba(15,14,13,0.88) 100%)',
          borderRight: '1px solid #1f1d1a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HeroGreeting nombre={config?.nombre} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <ClockDisplay compact />
            <span style={{
              padding: '3px 8px',
              border: `1px solid ${pointsBalance < 0 ? '#7d493b' : '#4a3923'}`,
              borderRadius: '999px',
              color: pointsBalance < 0 ? '#d98a70' : '#f0b855',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
            }}>
              {pointsBalance} pts
            </span>
          </div>
        </div>

        <div style={{ position: 'sticky', top: '-22px', zIndex: 10, background: 'linear-gradient(180deg, rgba(26,25,23,0.99) 80%, rgba(26,25,23,0) 100%)', paddingBottom: '8px', marginBottom: '-8px' }}>
          <WeatherWidget weather={weather} />
        </div>

        <DailyQuote />

        <div style={{ flex: 1 }} />

        <MiniCalendar
          monthDots={monthDots}
          reminderDots={reminderDots}
          selectedDate={selectedDate}
          onMonthChange={(m) => { fetchMonthDots(m); fetchReminders(m) }}
          onDateClick={(d) => setSelectedDate((prev) => prev === d ? null : d)}
        />

      </motion.aside>

      {/* Columna central: timeline */}
      <div style={{
        width: COL,
        flexShrink: 0,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRight: '1px solid #1f1d1a',
      }}>
        <div style={{
          padding: '8px 16px 8px 12px',
          borderBottom: '1px solid #1f1d1a',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '16px',
                color: '#f0e6d3',
                fontWeight: 300,
              }}>
                Jornada de hoy
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '9px',
                color: '#3d3830',
                letterSpacing: '0.06em',
              }}>
                {dayStart}:00 — {dayEnd}:00
              </span>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ opacity: 0.8 }}
              onClick={() => setAdaptOpen(true)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: '#2a1e0d',
                border: '1px solid #d4943a33',
                color: '#d4943a',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                letterSpacing: '0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
              }}
            >
              Adaptar plan
            </motion.button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 16px 18px 12px' }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {loading && !payload ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3d3830',
                fontSize: '13px',
              }}>
                Cargando jornada...
              </div>
            ) : payload ? (
              <TimelineV2
                timeline={payload.timeline_v2}
                dayStart={dayStart}
                dayEnd={dayEnd}
                onStartPomodoroTask={handleStartPomodoroTask}
              />
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px',
                color: '#3d3830',
              }}>
                <div style={{ fontSize: '13px' }}>Sin tareas planificadas para hoy</div>
                <div style={{ fontSize: '12px', color: '#2e2b27' }}>
                  Agrega tareas desde Planificacion
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Columna derecha */}
      <motion.aside
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        style={{
          width: COL,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          padding: '16px 14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'linear-gradient(180deg, rgba(22,21,19,0.6) 0%, rgba(15,14,13,0.4) 100%)',
        }}
      >
        {payload && (
          <DayProgressRing
            total={payload.progress.total}
            done={payload.progress.done}
            pct={payload.progress.pct}
          />
        )}

        <div style={{ borderTop: '1px solid #2e2b27', paddingTop: '14px' }}>
          <ReminderList selectedDate={selectedDate} onClearDate={() => setSelectedDate(null)} />
        </div>

        <LifeObjectives />

      </motion.aside>

      <AdaptPlanModal open={adaptOpen} onClose={() => setAdaptOpen(false)} />
    </div>
  )
}
