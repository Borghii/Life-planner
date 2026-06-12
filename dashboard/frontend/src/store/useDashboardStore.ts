import { create } from 'zustand'
import { useEconomyStore } from './useEconomyStore'
import {
  getTareasHoy,
  toggleTarea,
  getClima,
  getRecordatorios,
  createRecordatorio,
  deleteRecordatorio,
  getMonthDots,
} from '../api/dashboard'
import type {
  Accion,
  PlanTaskSource,
  Recordatorio,
  TareasHoyPayload,
  TaskBlock,
  TimelineBlock,
  WeatherPayload,
} from '../api/types'

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type RawTimelineTask = TaskBlock & {
  actions?: Accion[]
  task_id?: number
  task_name?: string
}

type RawWeatherPayload = WeatherPayload & {
  location?: string
  temperature_c?: number | null
  wmo_code?: number | null
  current?: {
    time?: string | null
    temp?: number | null
    code?: number | null
    condition?: string
  }
  days?: Array<{
    date?: string
    label?: string
    short_label?: string
    code?: number | null
    condition?: string
    temp_max?: number | null
    temp_min?: number | null
    precip_probability_max?: number | null
    precipitation_sum?: number | null
    wind_speed_max?: number | null
    is_today?: boolean
  }>
  hours?: Array<{
    time?: string
    date?: string
    temp?: number | null
    precip_probability?: number | null
    code?: number | null
    condition?: string
  }>
}

type RawTimelineBlock = Partial<TimelineBlock> & {
  plan_dia_id?: string
  task_id?: number
  task_name?: string
  apartado_id?: number
  apartado_name?: string
  apartado_color?: string
  priority?: number
  pomos?: number
  repeticiones?: number
  note?: string
  done?: boolean
  start_hour?: number
  end_hour?: number
  duration_hours?: number
  source?: PlanTaskSource
  actions?: Accion[]
  acciones?: Accion[]
  tasks?: RawTimelineTask[]
}

function normalizeTask(task: RawTimelineTask | RawTimelineBlock): TaskBlock {
  const actions = task.acciones ?? task.actions ?? []
  return {
    plan_dia_id: task.plan_dia_id ?? '',
    source: task.source ?? 'library',
    id: task.id ?? task.task_id ?? 0,
    name: task.name ?? task.task_name ?? 'Tarea',
    priority: task.priority ?? 3,
    pomos: task.pomos ?? 1,
    repeticiones: task.repeticiones ?? 1,
    note: task.note ?? '',
    done: Boolean(task.done),
    acciones: actions,
    actions,
  }
}

function normalizeTimelineBlocks(blocks: RawTimelineBlock[] = []): TimelineBlock[] {
  const groupedIndexes = new Map<string, number>()
  const normalized: TimelineBlock[] = []

  blocks.forEach((block, index) => {
    if (Array.isArray(block.tasks)) {
      const tasks = block.tasks.map(normalizeTask)
      normalized.push({
        id: block.id ?? index,
        name: block.name ?? block.apartado_name ?? 'Sin apartado',
        color: block.color ?? block.apartado_color ?? '#3d3830',
        start_hour: block.start_hour ?? 0,
        end_hour: block.end_hour ?? 0,
        duration_hours: block.duration_hours ?? Math.max(1, (block.end_hour ?? 0) - (block.start_hour ?? 0)),
        done: typeof block.done === 'boolean' ? block.done : tasks.every((task) => task.done),
        tasks,
      })
      return
    }

    const task = normalizeTask(block)
    const blockId = block.apartado_id ?? block.id ?? task.id
    const startHour = block.start_hour ?? 0
    const derivedDuration = Math.max(1, task.pomos * task.repeticiones)
    const endHour = block.end_hour ?? (startHour + (block.duration_hours ?? derivedDuration))
    const groupKey = `${blockId}-${startHour}`
    const existingIndex = groupedIndexes.get(groupKey)

    if (existingIndex !== undefined) {
      const existing = normalized[existingIndex]
      existing.tasks.push(task)
      existing.end_hour = Math.max(existing.end_hour, endHour)
      existing.duration_hours = Math.max(1, existing.end_hour - existing.start_hour)
      existing.done = existing.done && task.done
      return
    }

    groupedIndexes.set(groupKey, normalized.length)
    normalized.push({
      id: blockId,
      name: block.apartado_name ?? block.name ?? 'Sin apartado',
      color: block.apartado_color ?? block.color ?? '#3d3830',
      start_hour: startHour,
      end_hour: endHour,
      duration_hours: Math.max(1, block.duration_hours ?? endHour - startHour),
      done: task.done,
      tasks: [task],
    })
  })

  return normalized
}

function normalizePayload(payload: TareasHoyPayload): TareasHoyPayload {
  return {
    ...payload,
    timeline_v2: {
      ...payload.timeline_v2,
      blocks: normalizeTimelineBlocks(payload.timeline_v2.blocks as RawTimelineBlock[]),
      overflow: normalizeTimelineBlocks(payload.timeline_v2.overflow as RawTimelineBlock[]),
    },
  }
}

function normalizeWeather(weather: RawWeatherPayload): WeatherPayload {
  const temp = weather.temp ?? weather.temperature_c ?? null
  return {
    temp,
    ciudad: weather.ciudad ?? weather.location ?? '',
    ok: Boolean(weather.ok ?? (temp !== null)),
    code: weather.code ?? weather.wmo_code ?? undefined,
    stale: Boolean(weather.stale),
    timezone: weather.timezone ?? '',
    current: {
      time: weather.current?.time ?? null,
      temp: weather.current?.temp ?? temp,
      code: weather.current?.code ?? weather.code ?? weather.wmo_code ?? undefined,
      condition: weather.current?.condition ?? 'Sin datos',
    },
    days: (weather.days ?? [])
      .filter((day) => Boolean(day.date))
      .map((day) => ({
        date: day.date ?? '',
        label: day.label ?? '',
        short_label: day.short_label ?? '',
        code: day.code ?? undefined,
        condition: day.condition ?? 'Sin datos',
        temp_max: day.temp_max ?? null,
        temp_min: day.temp_min ?? null,
        precip_probability_max: day.precip_probability_max ?? null,
        precipitation_sum: day.precipitation_sum ?? null,
        wind_speed_max: day.wind_speed_max ?? null,
        is_today: Boolean(day.is_today),
      })),
    hours: (weather.hours ?? [])
      .filter((hour) => Boolean(hour.time && hour.date))
      .map((hour) => ({
        time: hour.time ?? '',
        date: hour.date ?? '',
        temp: hour.temp ?? null,
        precip_probability: hour.precip_probability ?? null,
        code: hour.code ?? undefined,
        condition: hour.condition ?? 'Sin datos',
      })),
  }
}

interface DashboardStore {
  today: string
  payload: TareasHoyPayload | null
  weather: WeatherPayload | null
  monthDots: Map<string, number>
  reminderDots: Set<string>
  reminders: Recordatorio[]
  loading: boolean
  fetchToday: () => Promise<void>
  fetchWeather: () => Promise<void>
  toggleTask: (plan_dia_id: string, done: boolean) => Promise<void>
  fetchMonthDots: (month: string) => Promise<void>
  fetchReminders: (month: string) => Promise<void>
  addReminder: (fecha: string, texto: string) => Promise<void>
  removeReminder: (id: number) => Promise<void>
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  today: toDateStr(new Date()),
  payload: null,
  weather: null,
  monthDots: new Map(),
  reminderDots: new Set(),
  reminders: [],
  loading: false,

  fetchToday: async () => {
    const today = toDateStr(new Date())
    set({ loading: true, today })
    try {
      const payload = normalizePayload(await getTareasHoy(today))
      set({ payload, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchWeather: async () => {
    try {
      const weather = normalizeWeather(await getClima() as RawWeatherPayload)
      set({ weather })
    } catch {}
  },

  toggleTask: async (plan_dia_id, done) => {
    const { payload } = get()
    if (!payload) return

    const updatedPayload = {
      ...payload,
      timeline_v2: {
        ...payload.timeline_v2,
        blocks: payload.timeline_v2.blocks.map((block) => {
          const tasks = block.tasks ?? []
          return {
            ...block,
            tasks: tasks.map((t) =>
              t.plan_dia_id === plan_dia_id ? { ...t, done } : t
            ),
            done: tasks.every((t) =>
              t.plan_dia_id === plan_dia_id ? done : t.done
            ),
          }
        }),
      },
    }

    const allTasks = updatedPayload.timeline_v2.blocks.flatMap((b) => b.tasks ?? [])
    const doneCount = allTasks.filter((t) => t.done).length
    updatedPayload.progress = {
      total: allTasks.length,
      done: doneCount,
      pct: allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0,
    }

    set({ payload: updatedPayload })

    try {
      const result = await toggleTarea(plan_dia_id, done)
      useEconomyStore.getState().syncTaskCompletion(result)
      const fresh = normalizePayload(await getTareasHoy(get().today))
      set({ payload: fresh })
    } catch {
      set({ payload })
    }
  },

  fetchMonthDots: async (month) => {
    try {
      const data = await getMonthDots(month)
      const map = new Map<string, number>()
      data.days.forEach((d) => {
        if (d.total > 0) map.set(d.fecha, d.total)
      })
      set({ monthDots: map })
    } catch {}
  },

  fetchReminders: async (month) => {
    try {
      const reminders = await getRecordatorios(month)
      const reminderDots = new Set(reminders.map((r) => r.fecha))
      set({ reminders, reminderDots })
    } catch {}
  },

  addReminder: async (fecha, texto) => {
    const r = await createRecordatorio(fecha, texto)
    set((s) => ({
      reminders: [...s.reminders, r].sort((a, b) => a.fecha.localeCompare(b.fecha)),
      reminderDots: new Set([...s.reminderDots, r.fecha]),
    }))
  },

  removeReminder: async (id) => {
    await deleteRecordatorio(id)
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }))
  },
}))
