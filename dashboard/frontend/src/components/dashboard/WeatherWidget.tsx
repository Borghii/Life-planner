import { motion, AnimatePresence } from 'framer-motion'
import { startTransition, useEffect, useState } from 'react'
import type { WeatherPayload } from '../../api/types'

type HourMetric = 'temperature' | 'precipitation'

// Emojis reemplazados por versiones con mayor soporte en Windows
function getWeatherEmoji(code?: number): string {
  if (code === undefined || code === null) return '☁️'
  if (code === 0) return '☀️'
  if (code === 1) return '⛅'       // 🌤️ → ⛅ (más compatible)
  if (code <= 3) return '☁️'
  if (code <= 49) return '☁️'       // neblina → nublado (más compatible)
  if (code <= 59) return '🌧️'      // 🌦️ → 🌧️
  if (code <= 69) return '🌧️'
  if (code <= 79) return '❄️'
  return '⛈️'
}

function getWeatherLabel(code?: number): string {
  if (code === undefined || code === null) return 'Sin datos'
  if (code === 0) return 'Soleado'
  if (code === 1) return 'Mayormente soleado'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code <= 49) return 'Neblina'
  if (code <= 59) return 'Llovizna'
  if (code <= 69) return 'Lluvia'
  if (code <= 79) return 'Nieve'
  return 'Tormenta'
}

function getRisk(day?: WeatherPayload['days'][number]) {
  const probability = day?.precip_probability_max ?? 0
  const code = day?.code ?? 0

  if (code >= 95) {
    return { label: 'Tormenta', emoji: '⛈️', accent: '#c45a3a', glow: 'rgba(196, 90, 58, 0.18)' }
  }
  if (probability >= 60 || (code >= 51 && code <= 82)) {
    return { label: 'Lluvia', emoji: '☔', accent: '#5a7ab5', glow: 'rgba(90, 122, 181, 0.18)' }
  }
  if (probability >= 30) {
    return { label: 'Inestable', emoji: '🌧️', accent: '#d4943a', glow: 'rgba(212, 148, 58, 0.18)' }  // 🌦️ → 🌧️
  }
  return { label: 'Seco', emoji: '😎', accent: '#5a8a6a', glow: 'rgba(90, 138, 106, 0.16)' }  // 🕶️ → 😎
}

function formatTemp(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${Math.round(value)}\u00B0`
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${Math.round(value)}%`
}

function formatMm(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${value.toFixed(value >= 10 ? 0 : 1)} mm`
}

function formatWind(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${Math.round(value)} km/h`
}

function formatHourLabel(time: string) {
  const parts = time.split('T')
  if (parts.length < 2) return time
  return `${parts[1].slice(0, 2)}h`
}

const emojiStyle: React.CSSProperties = {
  fontFamily: "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif",
}

function EmptyHourlyState() {
  return (
    <div
      style={{
        minHeight: '160px',
        borderRadius: '12px',
        border: '1px dashed #2e2b27',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#7a6e61',
        fontSize: '12px',
        letterSpacing: '0.03em',
      }}
    >
      Sin detalle horario
    </div>
  )
}

function HourlyTemperatureChart({ hours }: { hours: WeatherPayload['hours'] }) {
  const entries = hours.filter((hour) => typeof hour.temp === 'number')
  if (entries.length === 0) return <EmptyHourlyState />

  const values = entries.map((hour) => hour.temp as number)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const width = 100
  const height = 44
  const step = entries.length > 1 ? width / (entries.length - 1) : width
  const points = entries.map((hour, index) => {
    const x = index * step
    const y = height - (((hour.temp as number) - min) / range) * height
    return { x, y }
  })
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`
  const visibleHours = entries
    .filter((_, index) => index % Math.ceil(entries.length / Math.min(entries.length, 8)) === 0)
    .slice(0, 8)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#7a6e61', letterSpacing: '0.05em' }}>
          ↓ {formatTemp(min)}
        </div>
        <div style={{ fontSize: '11px', color: '#7a6e61', letterSpacing: '0.05em' }}>
          ↑ {formatTemp(max)}
        </div>
      </div>
      <div
        style={{
          padding: '12px 12px 10px',
          borderRadius: '12px',
          border: '1px solid #2e2b27',
          background: 'linear-gradient(180deg, rgba(212,148,58,0.14) 0%, rgba(26,25,23,0.96) 78%)',
        }}
      >
        <svg viewBox={`0 0 ${width} ${height + 6}`} preserveAspectRatio="none" style={{ width: '100%', height: '150px', overflow: 'visible' }}>
          <path d={areaPath} fill="rgba(212, 148, 58, 0.2)" />
          <path d={linePath} fill="none" stroke="#f0b855" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point) => (
            <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="1.4" fill="#f0e6d3" />
          ))}
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleHours.length || 1}, 1fr)`, gap: '4px', marginTop: '4px' }}>
          {visibleHours.map((hour) => (
            <div key={hour.time} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace" }}>
                {formatTemp(hour.temp)}
              </div>
              <div style={{ fontSize: '9px', color: '#7a6e61', marginTop: '2px' }}>
                {formatHourLabel(hour.time)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HourlyPrecipitationChart({ hours }: { hours: WeatherPayload['hours'] }) {
  const entries = hours.filter((hour) => typeof hour.precip_probability === 'number')
  if (entries.length === 0) return <EmptyHourlyState />

  const max = Math.max(100, ...entries.map((hour) => hour.precip_probability as number))
  const visibleHours = entries
    .filter((_, index) => index % Math.ceil(entries.length / Math.min(entries.length, 8)) === 0)
    .slice(0, 8)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#7a6e61', letterSpacing: '0.05em' }}>
          <span style={emojiStyle}>☔</span> {formatPercent(Math.max(...entries.map((hour) => hour.precip_probability as number)))}
        </div>
        <div style={{ fontSize: '11px', color: '#7a6e61', letterSpacing: '0.05em' }}>
          <span style={emojiStyle}>💧</span> {formatPercent(entries[entries.length - 1].precip_probability)}
        </div>
      </div>
      <div
        style={{
          padding: '12px 12px 10px',
          borderRadius: '12px',
          border: '1px solid #2e2b27',
          background: 'linear-gradient(180deg, rgba(90,122,181,0.12) 0%, rgba(26,25,23,0.96) 78%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', minHeight: '150px' }}>
          {entries.map((hour) => {
            const value = hour.precip_probability as number
            const barHeight = `${Math.max(8, (value / max) * 100)}%`
            return (
              <div key={hour.time} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: '150px' }}>
                <div
                  title={`${formatHourLabel(hour.time)} ${formatPercent(value)}`}
                  style={{
                    width: '100%',
                    minWidth: '6px',
                    height: barHeight,
                    borderRadius: '999px 999px 4px 4px',
                    background: value >= 60 ? '#5a7ab5' : value >= 30 ? '#d4943a' : '#5a8a6a',
                    boxShadow: value >= 60 ? '0 0 10px rgba(90,122,181,0.24)' : 'none',
                  }}
                />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleHours.length || 1}, 1fr)`, gap: '4px', marginTop: '6px' }}>
          {visibleHours.map((hour) => (
            <div key={hour.time} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace" }}>
                {formatPercent(hour.precip_probability)}
              </div>
              <div style={{ fontSize: '9px', color: '#7a6e61', marginTop: '2px' }}>
                {formatHourLabel(hour.time)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Chevron SVG inline para no depender de ninguna lib de iconos
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transition: 'transform 0.3s ease',
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        color: '#7a6e61',
      }}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface Props {
  weather: WeatherPayload | null
}

export function WeatherWidget({ weather }: Props) {
  const [selectedDate, setSelectedDate] = useState('')
  const [metric, setMetric] = useState<HourMetric>('temperature')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!weather?.days?.length) {
      setSelectedDate('')
      return
    }
    if (!selectedDate || !weather.days.some((day) => day.date === selectedDate)) {
      setSelectedDate(weather.days[0].date)
    }
  }, [selectedDate, weather?.days])

  if (!weather) return null

  const currentTemp = weather.current?.temp ?? weather.temp
  const currentCode = weather.current?.code ?? weather.code
  const currentLabel = weather.current?.condition || getWeatherLabel(currentCode)
  const selectedDay = weather.days.find((day) => day.date === selectedDate) ?? weather.days[0]
  const selectedHours = selectedDay ? weather.hours.filter((hour) => hour.date === selectedDay.date) : []
  const risk = getRisk(selectedDay)

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{
        background: 'linear-gradient(180deg, rgba(37,34,28,0.98) 0%, rgba(26,25,23,0.98) 100%)',
        borderRadius: '18px',
        border: '1px solid #2e2b27',
        boxShadow: '0 22px 36px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}
    >
      {/* Header siempre visible — clickeable para colapsar/expandir */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          textAlign: 'left',
        }}
      >
        {/* Izquierda: icono + temp + ciudad + condición */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(240,184,85,0.22) 0%, rgba(212,148,58,0.08) 100%)',
              border: '1px solid #d4943a33',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              lineHeight: 1,
              flexShrink: 0,
              ...emojiStyle,
            }}
          >
            {getWeatherEmoji(currentCode)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '36px',
                  lineHeight: 1,
                  color: '#f0e6d3',
                  fontWeight: 400,
                }}
              >
                {typeof currentTemp === 'number' ? `${Math.round(currentTemp)}\u00B0` : '--'}
              </span>
              <span style={{ fontSize: '13px', color: '#c8a97e' }}>
                {weather.ciudad || 'Sin ciudad'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#7a6e61', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentLabel}
            </div>
          </div>
        </div>

        {/* Derecha: risk badge + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {selectedDay && (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: '10px',
                background: risk.glow,
                border: `1px solid ${risk.accent}44`,
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1, ...emojiStyle }}>{risk.emoji}</span>
              <div>
                <div style={{ fontSize: '9px', color: risk.accent, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '2px' }}>
                  {risk.label}
                </div>
                <div style={{ fontSize: '14px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                  {formatPercent(selectedDay.precip_probability_max)}
                </div>
              </div>
            </div>
          )}
          <ChevronIcon open={expanded} />
        </div>
      </button>

      {/* Contenido expandible */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="weather-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 14px' }}>
              {/* Stats del día seleccionado */}
              {selectedDay && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '8px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#211f1c', border: '1px solid #2e2b27' }}>
                    <div style={{ fontSize: '18px', marginBottom: '5px', lineHeight: 1, ...emojiStyle }}>🌡️</div>
                    <div style={{ fontSize: '15px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatTemp(selectedDay.temp_max)} / {formatTemp(selectedDay.temp_min)}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#211f1c', border: '1px solid #2e2b27' }}>
                    <div style={{ fontSize: '18px', marginBottom: '5px', lineHeight: 1, ...emojiStyle }}>☔</div>
                    <div style={{ fontSize: '15px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatPercent(selectedDay.precip_probability_max)}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#211f1c', border: '1px solid #2e2b27' }}>
                    <div style={{ fontSize: '18px', marginBottom: '5px', lineHeight: 1, ...emojiStyle }}>💨</div>
                    <div style={{ fontSize: '15px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatWind(selectedDay.wind_speed_max)}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs Temp / Lluvia */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '12px', borderBottom: '1px solid #2e2b27', paddingBottom: '1px' }}>
                <button
                  onClick={() => setMetric('temperature')}
                  style={{
                    padding: '0 0 8px',
                    border: 'none',
                    background: 'none',
                    color: metric === 'temperature' ? '#f0e6d3' : '#7a6e61',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderBottom: metric === 'temperature' ? '2px solid #d4943a' : '2px solid transparent',
                    marginBottom: '-1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={emojiStyle}>🌡️</span> Temp
                </button>
                <button
                  onClick={() => setMetric('precipitation')}
                  style={{
                    padding: '0 0 8px',
                    border: 'none',
                    background: 'none',
                    color: metric === 'precipitation' ? '#f0e6d3' : '#7a6e61',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderBottom: metric === 'precipitation' ? '2px solid #5a7ab5' : '2px solid transparent',
                    marginBottom: '-1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={emojiStyle}>☔</span> Lluvia
                </button>
              </div>

              {/* Gráfico horario */}
              {metric === 'temperature' ? (
                <HourlyTemperatureChart hours={selectedHours} />
              ) : (
                <HourlyPrecipitationChart hours={selectedHours} />
              )}

              {/* Días de la semana */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingTop: '14px',
                  marginTop: '14px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#2e2b27 transparent',
                }}
              >
                {(weather.days ?? []).map((day) => {
                  const isSelected = selectedDay?.date === day.date
                  const dayRisk = getRisk(day)
                  return (
                    <button
                      key={day.date}
                      onClick={() => {
                        startTransition(() => {
                          setSelectedDate(day.date)
                        })
                      }}
                      style={{
                        minWidth: '82px',
                        padding: '10px 8px 8px',
                        borderRadius: '12px',
                        border: isSelected ? `1px solid ${dayRisk.accent}` : '1px solid #2e2b27',
                        background: isSelected
                          ? 'linear-gradient(180deg, rgba(42,39,35,0.98) 0%, rgba(26,25,23,0.98) 100%)'
                          : '#171614',
                        color: '#f0e6d3',
                        cursor: 'pointer',
                        textAlign: 'left',
                        flexShrink: 0,
                        boxShadow: isSelected ? `0 0 0 1px ${dayRisk.accent}22 inset` : 'none',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0e6d3' }}>
                          {day.short_label}
                        </span>
                        <span style={{ fontSize: '18px', lineHeight: 1, ...emojiStyle }}>
                          {getWeatherEmoji(day.code)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#f0e6d3', fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatTemp(day.temp_max)}
                        </span>
                        <span style={{ fontSize: '11px', color: '#7a6e61', fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatTemp(day.temp_min)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ fontSize: '14px', ...emojiStyle }}>{dayRisk.emoji}</span>
                        <span style={{ fontSize: '10px', color: dayRisk.accent, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatPercent(day.precip_probability_max)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Footer */}
              {selectedDay && (
                <div
                  style={{
                    marginTop: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#7a6e61',
                  }}
                >
                  <span>{selectedDay.label}</span>
                  <span>{formatMm(selectedDay.precipitation_sum)}</span>
                </div>
              )}

              {weather.stale && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#d4943a', letterSpacing: '0.04em' }}>
                  Ultimo dato guardado
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
