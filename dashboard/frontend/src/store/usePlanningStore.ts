import { create } from 'zustand'
import {
  getWeekPlan, getAllTareas, addTaskToDay, addManualTaskToDay, removeTaskFromDay,
  setPlanTaskDone, updateRepeticiones, updatePlanTaskNote, reorderDay,
} from '../api/planning'
import type { ManualPlanTaskInput, WeekPayload, Tarea } from '../api/types'
import { useEconomyStore } from './useEconomyStore'

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday
}

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface PlanningStore {
  weekStart: string
  weekPayload: WeekPayload | null
  poolTasks: Tarea[]
  poolSearch: string
  loading: boolean

  init: () => Promise<void>
  prevWeek: () => void
  nextWeek: () => void
  setPoolSearch: (q: string) => void
  addTask: (tarea_id: number, fecha: string) => Promise<void>
  addManualTask: (payload: ManualPlanTaskInput) => Promise<void>
  removeTask: (plan_dia_id: string) => Promise<void>
  toggleTaskDone: (plan_dia_id: string, done: boolean) => Promise<void>
  changeRepeticiones: (plan_dia_id: string, reps: number) => Promise<void>
  updateNote: (plan_dia_id: string, note: string) => Promise<void>
  reorder: (fecha: string, ids: string[]) => Promise<void>
  fetchWeek: () => Promise<void>
}

export const usePlanningStore = create<PlanningStore>((set, get) => ({
  weekStart: toDateStr(getMonday(new Date())),
  weekPayload: null,
  poolTasks: [],
  poolSearch: '',
  loading: false,

  init: async () => {
    set({ loading: true })
    const [weekPayload, poolTasks] = await Promise.all([
      getWeekPlan(get().weekStart),
      getAllTareas(),
    ])
    set({ weekPayload, poolTasks, loading: false })
  },

  fetchWeek: async () => {
    const weekPayload = await getWeekPlan(get().weekStart)
    set({ weekPayload })
  },

  prevWeek: () => {
    const d = new Date(get().weekStart + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    set({ weekStart: toDateStr(d) })
    get().fetchWeek()
  },

  nextWeek: () => {
    const d = new Date(get().weekStart + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    set({ weekStart: toDateStr(d) })
    get().fetchWeek()
  },

  setPoolSearch: (q) => set({ poolSearch: q }),

  addTask: async (tarea_id, fecha) => {
    await addTaskToDay(tarea_id, fecha)
    await get().fetchWeek()
  },

  addManualTask: async (payload) => {
    await addManualTaskToDay(payload)
    await get().fetchWeek()
  },

  removeTask: async (plan_dia_id) => {
    await removeTaskFromDay(plan_dia_id)
    await get().fetchWeek()
  },

  toggleTaskDone: async (plan_dia_id, done) => {
    const result = await setPlanTaskDone(plan_dia_id, done)
    useEconomyStore.getState().syncTaskCompletion(result)
    await get().fetchWeek()
  },

  changeRepeticiones: async (plan_dia_id, reps) => {
    await updateRepeticiones(plan_dia_id, reps)
    await get().fetchWeek()
  },

  updateNote: async (plan_dia_id, note) => {
    await updatePlanTaskNote(plan_dia_id, note)
    await get().fetchWeek()
  },

  reorder: async (fecha, ids) => {
    await reorderDay(fecha, ids)
    await get().fetchWeek()
  },
}))
