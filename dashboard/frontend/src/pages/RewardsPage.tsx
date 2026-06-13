import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { Reward, RewardPass } from '../api/types'
import { useEconomyStore } from '../store/useEconomyStore'
import { usePomodoroStore } from '../store/usePomodoroStore'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function passStatus(pass: RewardPass) {
  if (pass.status === 'pending') return 'Reembolsable'
  if (pass.status === 'active') return pass.timer_running ? 'En curso' : 'Pausado'
  if (pass.status === 'consumed') return 'Consumido'
  return 'Cancelado'
}

function calculatedPrice(
  durationMinutes: number,
  hourlyPrice: number,
  hourMinutes: number,
) {
  if (durationMinutes <= 0) return 0
  return Math.max(1, Math.ceil(durationMinutes * hourlyPrice / hourMinutes))
}

const DURATION_PRESETS = [30, 60, 90, 120]

export function RewardsPage() {
  const navigate = useNavigate()
  const {
    balance,
    pointsPerHour,
    defaultRewardPrice,
    defaultRewardDurationMinutes,
    rewards,
    passes,
    movements,
    loading,
    initialized,
    error,
    refresh,
    createReward,
    updateReward,
    archiveReward,
    redeemReward,
    cancelPass,
  } = useEconomyStore()
  const activeLeisurePass = usePomodoroStore((state) => state.activeLeisurePass)
  const loadLeisurePass = usePomodoroStore((state) => state.loadLeisurePass)
  const clearLeisurePass = usePomodoroStore((state) => state.clearLeisurePass)
  const [name, setName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(defaultRewardDurationMinutes)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Reward | null>(null)
  const [editName, setEditName] = useState('')
  const [editDurationMinutes, setEditDurationMinutes] = useState(defaultRewardDurationMinutes)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const activeRewards = useMemo(
    () => rewards.filter((reward) => reward.active),
    [rewards],
  )
  const availablePasses = useMemo(
    () => passes.filter((pass) => pass.status === 'pending' || pass.status === 'active'),
    [passes],
  )

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || durationMinutes <= 0 || saving) return
    setSaving(true)
    try {
      await createReward(name.trim(), durationMinutes)
      setName('')
      setDurationMinutes(defaultRewardDurationMinutes)
    } finally {
      setSaving(false)
    }
  }

  function beginEdit(reward: Reward) {
    setEditing(reward)
    setEditName(reward.name)
    setEditDurationMinutes(reward.duration_minutes)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editing || !editName.trim() || editDurationMinutes <= 0 || saving) return
    setSaving(true)
    try {
      await updateReward(editing.id, editName.trim(), editDurationMinutes)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleRedeem(reward: Reward) {
    if (saving || balance < reward.price_points) return
    setSaving(true)
    try {
      await redeemReward(reward.id)
    } finally {
      setSaving(false)
    }
  }

  function handleUsePass(pass: RewardPass) {
    if (activeLeisurePass?.id === pass.id || loadLeisurePass(pass)) {
      navigate('/pomodoro')
    }
  }

  async function handleCancel(pass: RewardPass) {
    if (activeLeisurePass?.id === pass.id) clearLeisurePass()
    await cancelPass(pass.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={page}
    >
      <header style={hero}>
        <div>
          <div style={eyebrow}>Economia personal · {pointsPerHour} pts por hora</div>
          <h1 style={title}>Recompensas</h1>
          <p style={subtitle}>
            Tres horas de avance compran una hora de ocio. Los pases pendientes conservan reembolso.
          </p>
        </div>
        <div style={balanceCard(balance < 0)}>
          <span style={balanceLabel}>{balance < 0 ? 'Deuda actual' : 'Saldo disponible'}</span>
          <strong style={balanceValue(balance < 0)}>{balance} pts</strong>
          <span style={balanceHint}>
            {balance < 0 ? 'Corrige la deuda antes de volver a canjear.' : 'El tiempo define el costo automaticamente.'}
          </span>
        </div>
      </header>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={mainGrid}>
        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={eyebrow}>Catalogo editable</div>
              <h2 style={panelTitle}>Elegir el premio</h2>
            </div>
            <span style={countPill}>{activeRewards.length}</span>
          </div>

          <form onSubmit={handleCreate} style={createForm}>
            <label style={field}>
              <span style={fieldLabel}>Nueva recompensa</span>
              <input
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Ej. jugar, ver una pelicula..."
                maxLength={120}
                style={input}
              />
            </label>
            <label style={{ ...field, flex: '0 0 132px' }}>
              <span style={fieldLabel}>Duracion (min)</span>
              <input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.currentTarget.value))}
                style={input}
              />
            </label>
            <div style={calculatedCost}>
              <span style={fieldLabel}>Costo automatico</span>
              <strong>
                {calculatedPrice(
                  durationMinutes,
                  defaultRewardPrice,
                  defaultRewardDurationMinutes,
                )} pts
              </strong>
            </div>
            <button type="submit" disabled={saving || !name.trim()} style={primaryButton}>
              Crear
            </button>
          </form>
          <div style={presetRow}>
            <span style={fieldLabel}>Duraciones rapidas</span>
            {DURATION_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDurationMinutes(minutes)}
                style={presetButton(durationMinutes === minutes)}
              >
                {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
              </button>
            ))}
          </div>

          <div style={catalogGrid}>
            {loading && !initialized ? (
              <div style={empty}>Cargando economia...</div>
            ) : activeRewards.length === 0 ? (
              <div style={empty}>Crea tu primera recompensa indicando cuanto tiempo queres usar.</div>
            ) : (
              activeRewards.map((reward, index) => (
                <motion.article
                  key={reward.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  style={rewardCard}
                >
                  <div style={ticketNotchLeft} />
                  <div style={ticketNotchRight} />
                  <div style={rewardTop}>
                    <span style={duration}>{reward.duration_minutes} min</span>
                    <strong style={priceText}>{reward.price_points} pts</strong>
                  </div>
                  <h3 style={rewardName}>{reward.name}</h3>
                  <div style={rewardActions}>
                    <button type="button" onClick={() => beginEdit(reward)} style={ghostButton}>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void archiveReward(reward.id)}
                      style={ghostButton}
                    >
                      Archivar
                    </button>
                    <button
                      type="button"
                      disabled={saving || balance < reward.price_points}
                      onClick={() => void handleRedeem(reward)}
                      style={redeemButton(balance >= reward.price_points)}
                    >
                      {balance >= reward.price_points ? 'Canjear' : `Faltan ${reward.price_points - balance}`}
                    </button>
                  </div>
                </motion.article>
              ))
            )}
          </div>
        </section>

        <aside style={sideColumn}>
          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <div style={eyebrow}>Pases de ocio</div>
                <h2 style={panelTitle}>Listos para usar</h2>
              </div>
              <span style={countPill}>{availablePasses.length}</span>
            </div>
            <div style={passList}>
              {availablePasses.length === 0 ? (
                <div style={empty}>Los canjes aparecen aca antes de iniciar su hora.</div>
              ) : (
                availablePasses.map((pass) => (
                  <article key={pass.id} style={passCard(pass.status === 'active')}>
                    <div style={passTop}>
                      <span style={statusPill(pass.status)}>{passStatus(pass)}</span>
                      <span style={passTime}>
                        {Math.ceil(pass.remaining_seconds / 60)} min
                      </span>
                    </div>
                    <strong style={passName}>{pass.reward_name}</strong>
                    <span style={passMeta}>Canjeado {formatDate(pass.redeemed_at)}</span>
                    <div style={passActions}>
                      {pass.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void handleCancel(pass)}
                          style={refundButton}
                        >
                          Cancelar · +{pass.price_points} pts
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleUsePass(pass)} style={useButton}>
                        {pass.status === 'active' ? 'Continuar' : 'Usar en Pomodoro'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section style={panel}>
            <div style={panelHeader}>
              <div>
                <div style={eyebrow}>Libro mayor</div>
                <h2 style={panelTitle}>Movimientos</h2>
              </div>
            </div>
            <div style={movementList}>
              {movements.length === 0 ? (
                <div style={empty}>Todavia no hay puntos acreditados.</div>
              ) : (
                movements.slice(0, 18).map((movement) => (
                  <div key={movement.id} style={movementRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={movementDescription}>{movement.description}</div>
                      <time style={movementDate}>{formatDate(movement.created_at)}</time>
                    </div>
                    <div style={movementNumbers}>
                      <strong style={movementDelta(movement.delta)}>
                        {movement.delta > 0 ? '+' : ''}{movement.delta}
                      </strong>
                      <span>{movement.balance_after} pts</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      {editing ? (
        <div style={modalBackdrop} onMouseDown={() => setEditing(null)}>
          <form
            onSubmit={saveEdit}
            onMouseDown={(event) => event.stopPropagation()}
            style={editModal}
          >
            <div style={eyebrow}>Editar recompensa</div>
            <h2 style={{ ...panelTitle, fontSize: '30px' }}>Tiempo para futuros canjes</h2>
            <label style={field}>
              <span style={fieldLabel}>Nombre</span>
              <input value={editName} onChange={(event) => setEditName(event.currentTarget.value)} style={input} />
            </label>
            <label style={field}>
              <span style={fieldLabel}>Duracion en minutos</span>
              <input
                type="number"
                min={1}
                value={editDurationMinutes}
                onChange={(event) => setEditDurationMinutes(Number(event.currentTarget.value))}
                style={input}
              />
            </label>
            <div style={editCostPreview}>
              Costo calculado: <strong>
                {calculatedPrice(
                  editDurationMinutes,
                  defaultRewardPrice,
                  defaultRewardDurationMinutes,
                )} pts
              </strong>
            </div>
            <p style={modalHint}>Los pases ya canjeados conservan el precio original.</p>
            <div style={modalActions}>
              <button type="button" onClick={() => setEditing(null)} style={ghostButton}>Cancelar</button>
              <button type="submit" disabled={saving} style={primaryButton}>Guardar</button>
            </div>
          </form>
        </div>
      ) : null}
    </motion.div>
  )
}

const page: CSSProperties = {
  minHeight: 'calc(100vh - 52px)',
  padding: '30px clamp(16px, 4vw, 56px) 48px',
  background: 'radial-gradient(circle at 78% 0%, rgba(212,148,58,0.09), transparent 30%), #0f0e0d',
}

const hero: CSSProperties = {
  maxWidth: 1440,
  margin: '0 auto 24px',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 24,
  flexWrap: 'wrap',
}

const eyebrow: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 9,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  color: '#8b7e70',
}

const title: CSSProperties = {
  margin: '4px 0 6px',
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 'clamp(42px, 6vw, 72px)',
  lineHeight: 0.95,
  fontWeight: 300,
  color: '#f0e6d3',
}

const subtitle: CSSProperties = { margin: 0, maxWidth: 620, color: '#8b7e70', lineHeight: 1.6 }

function balanceCard(debt: boolean): CSSProperties {
  return {
    minWidth: 250,
    padding: '18px 22px',
    border: `1px solid ${debt ? '#7d493b' : '#5c4428'}`,
    borderRadius: 12,
    background: debt ? '#251612' : 'linear-gradient(135deg, #251d12, #181512)',
    display: 'flex',
    flexDirection: 'column',
  }
}

const balanceLabel: CSSProperties = { ...eyebrow, color: '#c8a97e' }
function balanceValue(debt: boolean): CSSProperties {
  return { fontFamily: "'Cormorant Garamond', serif", fontSize: 46, lineHeight: 1, color: debt ? '#d98a70' : '#f0b855' }
}
const balanceHint: CSSProperties = { marginTop: 5, fontSize: 11, color: '#7a6e61' }
const mainGrid: CSSProperties = { maxWidth: 1440, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 0.85fr)', gap: 16, alignItems: 'start' }
const sideColumn: CSSProperties = { display: 'grid', gap: 16 }
const panel: CSSProperties = { border: '1px solid #2e2b27', borderRadius: 12, background: 'rgba(23,21,19,0.92)', overflow: 'hidden' }
const panelHeader: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '17px 18px', borderBottom: '1px solid #292621' }
const panelTitle: CSSProperties = { margin: '3px 0 0', fontFamily: "'Cormorant Garamond', serif", fontSize: 25, fontWeight: 400, color: '#f0e6d3' }
const countPill: CSSProperties = { minWidth: 28, padding: '3px 8px', borderRadius: 999, border: '1px solid #4a3923', color: '#d4943a', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'center' }
const createForm: CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 9, padding: 14, borderBottom: '1px solid #292621', flexWrap: 'wrap' }
const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, flex: '1 1 220px' }
const fieldLabel: CSSProperties = { ...eyebrow, color: '#6f655a' }
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '8px 10px', border: '1px solid #37322c', borderRadius: 7, background: '#11100f', color: '#f0e6d3', outlineColor: '#d4943a', fontFamily: "'Plus Jakarta Sans', sans-serif" }
const calculatedCost: CSSProperties = { minWidth: 126, minHeight: 38, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, padding: '5px 10px', border: '1px solid #4a3923', borderRadius: 7, background: '#211a11', color: '#f0b855', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }
const presetRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderBottom: '1px solid #292621', flexWrap: 'wrap' }
function presetButton(active: boolean): CSSProperties {
  return { padding: '5px 9px', border: `1px solid ${active ? '#d4943a' : '#332f2a'}`, borderRadius: 999, background: active ? '#2a1e0d' : 'transparent', color: active ? '#f0b855' : '#7a6e61', fontSize: 10, cursor: 'pointer' }
}
const primaryButton: CSSProperties = { minHeight: 38, padding: '8px 16px', border: '1px solid #d4943a', borderRadius: 7, background: '#d4943a', color: '#11100f', fontWeight: 600, cursor: 'pointer' }
const catalogGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, padding: 14 }
const rewardCard: CSSProperties = { position: 'relative', minHeight: 162, padding: 16, border: '1px solid #3a332a', borderRadius: 10, background: 'linear-gradient(145deg, #211e19, #181613)', overflow: 'hidden' }
const ticketNotchLeft: CSSProperties = { position: 'absolute', left: -7, top: '50%', width: 14, height: 14, borderRadius: '50%', background: '#171513', borderRight: '1px solid #3a332a' }
const ticketNotchRight: CSSProperties = { ...ticketNotchLeft, left: 'auto', right: -7, borderRight: 0, borderLeft: '1px solid #3a332a' }
const rewardTop: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const duration: CSSProperties = { ...eyebrow, color: '#7a9e87' }
const priceText: CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#f0b855' }
const rewardName: CSSProperties = { margin: '22px 0', fontFamily: "'Cormorant Garamond', serif", fontSize: 27, fontWeight: 400, lineHeight: 1.05, color: '#f0e6d3' }
const rewardActions: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }
const ghostButton: CSSProperties = { padding: '7px 9px', border: '1px solid #332f2a', borderRadius: 6, background: 'transparent', color: '#8b7e70', cursor: 'pointer', fontSize: 11 }
function redeemButton(enabled: boolean): CSSProperties {
  return { marginLeft: 'auto', padding: '7px 12px', border: `1px solid ${enabled ? '#d4943a' : '#332f2a'}`, borderRadius: 6, background: enabled ? '#2a1e0d' : '#181613', color: enabled ? '#f0b855' : '#4a4540', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: 11 }
}
const passList: CSSProperties = { display: 'grid', gap: 9, padding: 12 }
function passCard(active: boolean): CSSProperties {
  return { padding: 13, border: `1px solid ${active ? '#6a4d27' : '#332f2a'}`, borderLeft: `3px solid ${active ? '#f0b855' : '#7a9e87'}`, borderRadius: 8, background: active ? '#241c12' : '#1d1b18' }
}
const passTop: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }
function statusPill(status: RewardPass['status']): CSSProperties {
  return { ...eyebrow, color: status === 'active' ? '#f0b855' : '#8ab89a' }
}
const passTime: CSSProperties = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#c8a97e' }
const passName: CSSProperties = { display: 'block', marginTop: 10, color: '#f0e6d3', fontSize: 14 }
const passMeta: CSSProperties = { display: 'block', marginTop: 3, color: '#62594f', fontSize: 10 }
const passActions: CSSProperties = { display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }
const refundButton: CSSProperties = { ...ghostButton, color: '#8ab89a', borderColor: '#34513d' }
const useButton: CSSProperties = { ...primaryButton, minHeight: 31, marginLeft: 'auto', padding: '6px 10px', fontSize: 11 }
const movementList: CSSProperties = { maxHeight: 430, overflowY: 'auto', padding: '0 12px' }
const movementRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 2px', borderBottom: '1px solid #292621' }
const movementDescription: CSSProperties = { color: '#c8a97e', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const movementDate: CSSProperties = { display: 'block', marginTop: 3, color: '#5c5349', fontFamily: "'JetBrains Mono', monospace", fontSize: 8 }
const movementNumbers: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, color: '#62594f', fontFamily: "'JetBrains Mono', monospace", fontSize: 8 }
function movementDelta(delta: number): CSSProperties {
  return { fontSize: 13, color: delta >= 0 ? '#8ab89a' : '#d98a70' }
}
const empty: CSSProperties = { padding: 24, color: '#5c5349', fontSize: 12, fontStyle: 'italic', textAlign: 'center' }
const errorBox: CSSProperties = { maxWidth: 1440, margin: '0 auto 14px', padding: '10px 12px', border: '1px solid #7d493b', borderRadius: 8, background: '#251612', color: '#d98a70' }
const modalBackdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(5,5,4,0.78)', backdropFilter: 'blur(5px)' }
const editModal: CSSProperties = { width: 'min(100%, 430px)', display: 'grid', gap: 14, padding: 22, border: '1px solid #3a332a', borderRadius: 12, background: '#1a1917', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }
const editCostPreview: CSSProperties = { padding: '10px 12px', border: '1px solid #4a3923', borderRadius: 7, background: '#211a11', color: '#c8a97e', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }
const modalHint: CSSProperties = { margin: 0, color: '#7a6e61', fontSize: 11 }
const modalActions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8 }
