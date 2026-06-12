import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { getLifeObjectives, updateLifeObjectives } from '../../api/lifeObjectives'
import type { LifeObjectivesConfig } from '../../api/types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

type ObjectiveKey = keyof LifeObjectivesConfig

const AUTO_OPEN_SESSION_KEY = 'life-planner-objectives-opened'

const EMPTY_OBJECTIVES: LifeObjectivesConfig = {
  long_term: '',
  medium_term: '',
  short_term: '',
}

const DEFAULT_OBJECTIVES: LifeObjectivesConfig = {
  short_term: 'Sostener practica de Java e ingles sin perder el ritmo.',
  medium_term: 'Armar proyectos, mejorar el CV y prepararme para entrevistas Java.',
  long_term: 'Conseguir trabajo como desarrollador Java y usar ingles con confianza.',
}

const OBJECTIVE_LEVELS: Array<{
  key: ObjectiveKey
  label: string
  eyebrow: string
  color: string
}> = [
  { key: 'long_term', label: 'Largo plazo', eyebrow: 'hacia donde voy', color: '#d4943a' },
  { key: 'medium_term', label: 'Medio plazo', eyebrow: 'lo que tengo que construir', color: '#7a9e87' },
  { key: 'short_term', label: 'Corto plazo', eyebrow: 'el siguiente tramo', color: '#5a7ab5' },
]

function isDesktopLaunch() {
  return new URLSearchParams(window.location.search).get('desktop') === '1'
}

function readAutoOpenFlag() {
  try {
    return sessionStorage.getItem(AUTO_OPEN_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeAutoOpenFlag() {
  try {
    sessionStorage.setItem(AUTO_OPEN_SESSION_KEY, '1')
  } catch {
    // Session storage can be blocked in embedded browsers.
  }
}

export function LifeObjectives() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [objectives, setObjectives] = useState<LifeObjectivesConfig>(EMPTY_OBJECTIVES)
  const [draft, setDraft] = useState<LifeObjectivesConfig>(EMPTY_OBJECTIVES)

  useEffect(() => {
    let cancelled = false

    async function loadObjectives() {
      setLoading(true)
      setError('')
      try {
        const data = await getLifeObjectives()
        if (cancelled) return
        setObjectives(data)
        setDraft(data)
      } catch {
        if (cancelled) return
        setObjectives(DEFAULT_OBJECTIVES)
        setDraft(DEFAULT_OBJECTIVES)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadObjectives()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isDesktopLaunch() || readAutoOpenFlag()) return
    writeAutoOpenFlag()
    setOpen(true)
  }, [])

  const hasObjectives = useMemo(
    () => OBJECTIVE_LEVELS.some((level) => objectives[level.key].trim().length > 0),
    [objectives]
  )

  function handleOpen() {
    setEditing(false)
    setDraft(objectives)
    setOpen(true)
  }

  function handleEdit() {
    setDraft(objectives)
    setEditing(true)
    setError('')
  }

  function handleCancelEdit() {
    setDraft(objectives)
    setEditing(false)
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const saved = await updateLifeObjectives(draft)
      setObjectives(saved)
      setDraft(saved)
      setEditing(false)
    } catch {
      setError('No se pudieron guardar tus objetivos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.15 }}
        style={{
          marginTop: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleOpen}
          style={triggerButton}
          aria-label="Abrir objetivos personales"
        >
          <span style={triggerDot} />
          Objetivos
        </button>
      </motion.div>

      <Modal open={open} onClose={() => setOpen(false)} title="Mis objetivos" width={640}>
        <div style={modalBody}>
          {loading ? (
            <div style={mutedBlock}>Cargando objetivos...</div>
          ) : editing ? (
            <>
              <div style={editorGrid}>
                {OBJECTIVE_LEVELS.map((level) => (
                  <label key={level.key} style={fieldBlock}>
                    <span style={fieldLabel}>{level.label}</span>
                    <textarea
                      value={draft[level.key]}
                      onChange={(event) => {
                        const value = event.target.value
                        setDraft((current) => ({ ...current, [level.key]: value }))
                      }}
                      rows={3}
                      placeholder={`Escribir objetivo de ${level.label.toLowerCase()}`}
                      style={textareaStyle}
                    />
                  </label>
                ))}
              </div>

              {error && <div style={errorText}>{error}</div>}

              <div style={actionsRow}>
                <Button variant="ghost" onClick={handleCancelEdit} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar objetivos'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div style={introBlock}>
                <span style={introEyebrow}>Recordatorio personal</span>
                <h2 style={introTitle}>Lo que quiero construir</h2>
              </div>

              <div style={objectiveGrid}>
                {OBJECTIVE_LEVELS.map((level) => (
                  <section key={level.key} style={objectiveItem}>
                    <div style={{ ...objectiveMarker, borderColor: `${level.color}55`, color: level.color }}>
                      {level.label.slice(0, 1)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={objectiveHeader}>
                        <span style={{ ...objectiveLabel, color: level.color }}>{level.label}</span>
                        <span style={objectiveEyebrow}>{level.eyebrow}</span>
                      </div>
                      <p style={objectiveText}>
                        {objectives[level.key].trim() || 'Sin definir'}
                      </p>
                    </div>
                  </section>
                ))}
              </div>

              {error && <div style={errorText}>{error}</div>}
              {!hasObjectives && <div style={mutedBlock}>Todavia no hay objetivos configurados.</div>}

              <div style={actionsRow}>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
                <Button variant="primary" onClick={handleEdit}>
                  Configurar
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}

const triggerButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  padding: '7px 11px',
  borderRadius: '6px',
  border: '1px solid #2e2b27',
  background: '#171614',
  color: '#c8a97e',
  fontSize: '12px',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
}

const triggerDot: CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '999px',
  background: '#d4943a',
  boxShadow: '0 0 12px rgba(212,148,58,0.55)',
}

const modalBody: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

const introBlock: CSSProperties = {
  borderBottom: '1px solid #2e2b27',
  paddingBottom: '14px',
}

const introEyebrow: CSSProperties = {
  color: '#7a6e61',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

const introTitle: CSSProperties = {
  margin: '5px 0 0',
  color: '#f0e6d3',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: '30px',
  lineHeight: 1,
  fontWeight: 300,
}

const objectiveGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const objectiveItem: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '38px 1fr',
  gap: '12px',
  alignItems: 'start',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #2e2b27',
  background: '#171614',
}

const objectiveMarker: CSSProperties = {
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '8px',
  border: '1px solid',
  background: '#1f1d1a',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  fontWeight: 700,
}

const objectiveHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '8px',
  flexWrap: 'wrap',
}

const objectiveLabel: CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

const objectiveEyebrow: CSSProperties = {
  color: '#5f554b',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const objectiveText: CSSProperties = {
  margin: '5px 0 0',
  color: '#f0e6d3',
  fontSize: '14px',
  lineHeight: 1.45,
}

const editorGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
}

const fieldBlock: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '7px',
}

const fieldLabel: CSSProperties = {
  color: '#7a6e61',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

const textareaStyle: CSSProperties = {
  width: '100%',
  resize: 'vertical',
  minHeight: '82px',
  background: '#211f1c',
  border: '1px solid #2e2b27',
  borderRadius: '6px',
  padding: '10px 12px',
  color: '#f0e6d3',
  fontSize: '13px',
  lineHeight: 1.45,
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  outline: 'none',
}

const actionsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  paddingTop: '2px',
}

const mutedBlock: CSSProperties = {
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid #2e2b27',
  background: '#171614',
  color: '#7a6e61',
  fontSize: '13px',
}

const errorText: CSSProperties = {
  color: '#c45a3a',
  fontSize: '12px',
}
