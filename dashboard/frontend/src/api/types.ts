export interface Config {
  id: number
  day_start: number
  day_end: number
  ciudad: string
  lat: number
  lon: number
  nombre: string
}

export interface LifeObjectivesConfig {
  short_term: string
  medium_term: string
  long_term: string
}

export interface Apartado {
  id: number
  nombre: string
  color: string
  orden: number
}

export interface Tarea {
  id: number
  apartado_id: number
  nombre: string
  prioridad: number
  pomodoros: number
  apartado_nombre?: string
  apartado_color?: string
  apartado_orden?: number
}

export interface Accion {
  id: number
  tarea_id: number
  label: string
  tipo: 'url' | 'app' | 'file'
  valor: string
}

export type PlanTaskSource = 'library' | 'manual'

export interface TaskBlock {
  plan_dia_id: string
  source: PlanTaskSource
  id: number
  name: string
  priority: number
  pomos: number
  repeticiones: number
  note: string
  done: boolean
  acciones: Accion[]
  actions?: Accion[]
}

export interface TimelineBlock {
  id: number
  name: string
  color: string
  start_hour: number
  end_hour: number
  duration_hours: number
  done: boolean
  tasks: TaskBlock[]
}

export interface TimelineV2 {
  blocks: TimelineBlock[]
  overflow: TimelineBlock[]
}

export interface Progress {
  total: number
  done: number
  pct: number
}

export interface TareasHoyPayload {
  date: string
  day_title: string
  day_start: number
  day_end: number
  timeline: unknown
  timeline_v2: TimelineV2
  progress: Progress
}

export interface AdaptPlanTaskTime {
  previous_start_hour: number
  previous_end_hour: number
  start_hour: number
  end_hour: number
  duration_hours: number
  repeticiones: number
}

export interface AdaptPlanSuggestion extends AdaptPlanTaskTime {
  plan_dia_id: string
  apartado: {
    id: number
    name: string
    color: string
  }
  task: {
    id: number
    name: string
    priority: number
    pomos: number
  }
}

export interface AdaptPlanExcludedItem extends AdaptPlanTaskTime {
  plan_dia_id: string
  task: string
  apartado: string
}

export interface AdaptPlanPayload {
  date: string
  now: string
  anchor_hour: number
  hours_remaining: number
  suggested: AdaptPlanSuggestion[]
  excluded: AdaptPlanExcludedItem[]
  applied: boolean
}

export interface WeatherPayload {
  temp: number | null
  ciudad: string
  ok: boolean
  code?: number
  stale?: boolean
  timezone?: string
  current?: {
    time: string | null
    temp: number | null
    code?: number
    condition: string
  }
  days: {
    date: string
    label: string
    short_label: string
    code?: number
    condition: string
    temp_max: number | null
    temp_min: number | null
    precip_probability_max: number | null
    precipitation_sum: number | null
    wind_speed_max: number | null
    is_today?: boolean
  }[]
  hours: {
    time: string
    date: string
    temp: number | null
    precip_probability: number | null
    code?: number
    condition: string
  }[]
}

export interface Recordatorio {
  id: number
  fecha: string
  texto: string
}

export interface PlanTask {
  plan_dia_id: string
  source: PlanTaskSource
  name: string
  priority: number
  pomos: number
  repeticiones: number
  note: string
  done: boolean
  start_hour: number | null
  end_hour: number | null
  duration_hours: number
  apartado: {
    id: number
    name: string
    color: string
    order?: number
  }
}

export interface PlanDay {
  date: string
  name: string
  tasks: PlanTask[]
}

export interface PlanDatePayload {
  date: string
  tasks: PlanTask[]
}

export interface WeekPayload {
  week_start: string
  week_end: string
  day_start: number
  day_end: number
  days: PlanDay[]
}

export interface ManualPlanTaskInput {
  fecha: string
  nombre: string
  prioridad: number
  pomodoros: number
  note?: string
}

export interface HeatDay {
  fecha: string
  total: number
  done: number
}

export interface YearPayload {
  year: number
  days: HeatDay[]
}

export interface TaskCompletionResult {
  ok: boolean
  plan_dia_id: string
  completada: number
  points_delta: number
  balance: number
}

export interface Reward {
  id: number
  name: string
  price_points: number
  duration_minutes: number
  active: boolean
  created_at: string
  updated_at: string
}

export type RewardPassStatus = 'pending' | 'active' | 'consumed' | 'cancelled'

export interface RewardPass {
  id: number
  reward_id: number | null
  reward_name: string
  price_points: number
  duration_minutes: number
  status: RewardPassStatus
  remaining_seconds: number
  timer_running: boolean
  redeemed_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface CoinMovement {
  id: number
  kind: string
  delta: number
  balance_after: number
  description: string
  created_at: string
}

export interface EconomyPayload {
  balance: number
  points_per_hour: number
  default_reward_price: number
  default_reward_duration_minutes: number
  rewards: Reward[]
  passes: RewardPass[]
  movements: CoinMovement[]
}
