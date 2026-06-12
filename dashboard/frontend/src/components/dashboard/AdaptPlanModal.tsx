import { useState } from 'react'
import { motion } from 'framer-motion'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { getAdaptarPlan } from '../../api/dashboard'
import { useDashboardStore } from '../../store/useDashboardStore'
import type {
  AdaptPlanExcludedItem,
  AdaptPlanPayload,
  AdaptPlanSuggestion,
  AdaptPlanTaskTime,
} from '../../api/types'

interface Props {
  open: boolean
  onClose: () => void
}

function formatHour(hour: number) {
  const safeHour = Number.isFinite(hour) ? hour : 0
  const wholeHour = Math.floor(safeHour)
  const minutes = Math.round((safeHour - wholeHour) * 60)
  return `${String(wholeHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function hasTimeChange(item: AdaptPlanTaskTime) {
  return item.previous_start_hour !== item.start_hour || item.previous_end_hour !== item.end_hour
}

function timeRange(startHour: number, endHour: number) {
  return `${formatHour(startHour)}-${formatHour(endHour)}`
}

function totalDuration(items: AdaptPlanSuggestion[]) {
  return items.reduce((acc, item) => acc + Number(item.duration_hours || item.task.pomos || 1), 0)
}

export function AdaptPlanModal({ open, onClose }: Props) {
  const { today, fetchToday } = useDashboardStore()
  const [result, setResult] = useState<AdaptPlanPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePreview() {
    setLoading(true)
    setError(null)

    try {
      const data = await getAdaptarPlan(today, false)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la sugerencia.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    setApplying(true)
    setError(null)

    try {
      await getAdaptarPlan(today, true)
      await fetchToday()
      setResult(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar el plan.')
    } finally {
      setApplying(false)
    }
  }

  function handleClose() {
    setResult(null)
    setError(null)
    onClose()
  }

  function renderSuggestedTask(suggestion: AdaptPlanSuggestion, index: number) {
    const changed = hasTimeChange(suggestion)

    return (
      <motion.div
        key={suggestion.plan_dia_id}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.04 }}
        style={{
          display: 'grid',
          gridTemplateColumns: '22px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: '9px',
          padding: '8px 10px',
          background: '#1a1917',
          borderRadius: '6px',
          borderLeft: `3px solid ${suggestion.apartado.color}`,
          color: '#f0e6d3',
        }}
      >
        <span
          style={{
            color: '#3d3830',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              minWidth: 0,
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '13px',
              }}
            >
              {suggestion.task.name}
            </span>
            <span style={{ flexShrink: 0, fontSize: '10px', color: '#7a6e61' }}>
              {suggestion.duration_hours}h
            </span>
          </div>
          <div style={{ marginTop: '3px', fontSize: '11px', color: '#7a6e61' }}>
            {suggestion.apartado.name}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: changed ? '#d4943a' : '#7a6e61',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: changed ? '#7a6e61' : '#3d3830' }}>
            {timeRange(suggestion.previous_start_hour, suggestion.previous_end_hour)}
          </span>
          <span>-&gt;</span>
          <span>{timeRange(suggestion.start_hour, suggestion.end_hour)}</span>
        </div>
      </motion.div>
    )
  }

  function renderExcludedTask(task: AdaptPlanExcludedItem) {
    const changed = hasTimeChange(task)

    return (
      <div
        key={task.plan_dia_id}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '8px',
          alignItems: 'center',
          padding: '6px 10px',
          borderRadius: '5px',
          background: '#171513',
          border: '1px solid #211f1c',
          fontSize: '12px',
          color: '#7a6e61',
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: 'line-through',
          }}
        >
          {task.task}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: changed ? '#8b7e70' : '#3d3830',
            whiteSpace: 'nowrap',
          }}
        >
          {timeRange(task.start_hour, task.end_hour)}
        </span>
      </div>
    )
  }

  const hasPendingItems = Boolean(result && (result.suggested.length > 0 || result.excluded.length > 0))
  const hasMovement = Boolean(
    result &&
    [...result.suggested, ...result.excluded].some((item) => hasTimeChange(item)),
  )

  return (
    <Modal open={open} onClose={handleClose} title="Adaptar plan" width={580}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!result ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '14px',
              minHeight: '220px',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'radial-gradient(circle at 30% 30%, #f0b855, #2a1e0d 72%)',
                boxShadow: '0 12px 30px rgba(212, 148, 58, 0.16)',
                color: '#120f0b',
                fontSize: '24px',
              }}
            >
              {'\u26A1'}
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#7a6e61', lineHeight: 1.6, maxWidth: '360px' }}>
              El algoritmo reorganiza las tareas pendientes para aprovechar mejor el
              tiempo que queda en tu jornada desde la proxima hora.
            </p>

            {error && (
              <p style={{ margin: 0, fontSize: '12px', color: '#c45a3a', maxWidth: '360px' }}>
                {error}
              </p>
            )}

            <Button
              variant="primary"
              onClick={handlePreview}
              disabled={loading}
              style={{ justifyContent: 'center' }}
            >
              {loading ? 'Calculando...' : 'Ver sugerencia'}
            </Button>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: '10px 12px',
                background: '#211f1c',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '24px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#7a6e61',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Hora actual
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '16px',
                    color: '#d4943a',
                  }}
                >
                  {result.now}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#7a6e61',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Horas libres
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '16px',
                    color: '#f0e6d3',
                  }}
                >
                  {result.hours_remaining}h
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#7a6e61',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Reubicar desde
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '16px',
                    color: '#f0e6d3',
                  }}
                >
                  {formatHour(result.anchor_hour)}
                </div>
              </div>
            </div>

            {result.suggested.length > 0 ? (
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#7a6e61',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Plan sugerido ({result.suggested.length} tareas · {totalDuration(result.suggested)}h)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {result.suggested.map(renderSuggestedTask)}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px dashed #2e2b27',
                  color: '#7a6e61',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                No hay tareas pendientes que entren en el horario restante.
              </div>
            )}

            {hasPendingItems && !hasMovement && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2e2b27',
                  background: '#171513',
                  color: '#8b7e70',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                Sin cambios visibles: las tareas ya coinciden con la posicion sugerida.
              </div>
            )}

            {result.excluded.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#7a6e61',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  Fuera de jornada ({result.excluded.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {result.excluded.map(renderExcludedTask)}
                </div>
              </div>
            )}

            {error && (
              <p style={{ margin: 0, fontSize: '12px', color: '#c45a3a' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => setResult(null)} style={{ flex: 1 }}>
                Volver
              </Button>
              <Button
                variant="primary"
                onClick={handleApply}
                disabled={applying}
                style={{ flex: 2, justifyContent: 'center' }}
              >
                {applying ? 'Aplicando...' : 'Aplicar este plan'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
