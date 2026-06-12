import { create } from 'zustand'
import { useEconomyStore } from './useEconomyStore'
import { getYearData, getDayDetail, setHistoryTaskDone } from '../api/history'
import type { YearPayload, PlanDay, HeatDay } from '../api/types'

function getDateYear(date: string): number {
  return Number(date.slice(0, 4))
}

function calcStreak(days: HeatDay[]): { current: number; best: number } {
  const sorted = [...days].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let current = 0
  let best = 0
  let streak = 0
  const _d = new Date(); const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`

  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = sorted[i]
    if (d.total === 0) break
    const isToday = d.fecha === today
    const ratio = d.done / d.total
    if (ratio > 0 || isToday) {
      streak++
      if (i === sorted.length - 1 || sorted[i + 1].fecha <= today) current = streak
    } else {
      break
    }
  }
  for (let i = 0; i < sorted.length; ) {
    let s = 0
    while (i < sorted.length && sorted[i].total > 0 && sorted[i].done / sorted[i].total > 0) {
      s++
      i++
    }
    best = Math.max(best, s)
    while (i < sorted.length && (sorted[i].total === 0 || sorted[i].done === 0)) i++
  }
  return { current, best }
}

function updateYearDayDone(yearData: YearPayload | null, date: string, delta: number) {
  if (!yearData) return yearData

  let updated = false
  const days = yearData.days.map((day) => {
    if (day.fecha !== date) return day
    updated = true
    return {
      ...day,
      done: Math.min(day.total, Math.max(0, day.done + delta)),
    }
  })

  return updated ? { ...yearData, days } : yearData
}

interface HistoryStore {
  year: number
  yearData: YearPayload | null
  selectedDate: string | null
  dayDetail: PlanDay | null
  streak: { current: number; best: number }
  pendingTaskIds: Set<string>
  error: string | null
  loading: boolean

  fetchYear: (year?: number) => Promise<void>
  selectDate: (date: string) => Promise<void>
  toggleTaskDone: (planDiaId: string, done: boolean) => Promise<void>
  setYear: (year: number) => void
  clearSelection: () => void
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  year: new Date().getFullYear(),
  yearData: null,
  selectedDate: null,
  dayDetail: null,
  streak: { current: 0, best: 0 },
  pendingTaskIds: new Set(),
  error: null,
  loading: false,

  fetchYear: async (year) => {
    const y = year ?? get().year
    set({ loading: true, year: y })
    const yearData = await getYearData(y)
    const streak = calcStreak(yearData.days)
    set({ yearData, streak, loading: false })
  },

  selectDate: async (date) => {
    const selectedYear = getDateYear(date)
    const shouldFetchYear = selectedYear !== get().year

    set({
      selectedDate: date,
      dayDetail: null,
      error: null,
      ...(shouldFetchYear ? { year: selectedYear, loading: true } : {}),
    })

    try {
      if (shouldFetchYear) {
        const [dayDetail, yearData] = await Promise.all([
          getDayDetail(date),
          getYearData(selectedYear),
        ])
        if (get().selectedDate !== date) return
        set({
          dayDetail,
          yearData,
          streak: calcStreak(yearData.days),
          loading: false,
        })
        return
      }

      const dayDetail = await getDayDetail(date)
      if (get().selectedDate === date) {
        set({ dayDetail })
      }
    } catch {
      if (get().selectedDate === date) {
        set({ dayDetail: null, loading: false, error: 'No se pudo cargar ese dia.' })
      }
    }
  },

  toggleTaskDone: async (planDiaId, done) => {
    const {
      dayDetail,
      selectedDate,
      year,
      yearData,
      streak,
      pendingTaskIds,
    } = get()

    if (!dayDetail || !selectedDate || pendingTaskIds.size > 0) return

    const task = dayDetail.tasks.find((item) => item.plan_dia_id === planDiaId)
    if (!task || task.done === done) return

    const previousDayDetail = dayDetail
    const previousYearData = yearData
    const previousStreak = streak
    const delta = done ? 1 : -1
    const optimisticDayDetail = {
      ...dayDetail,
      tasks: dayDetail.tasks.map((item) =>
        item.plan_dia_id === planDiaId ? { ...item, done } : item
      ),
    }
    const optimisticYearData = updateYearDayDone(yearData, selectedDate, delta)

    set({
      dayDetail: optimisticDayDetail,
      yearData: optimisticYearData,
      streak: optimisticYearData ? calcStreak(optimisticYearData.days) : streak,
      pendingTaskIds: new Set([planDiaId]),
      error: null,
    })

    try {
      const result = await setHistoryTaskDone(planDiaId, done)
      useEconomyStore.getState().syncTaskCompletion(result)

      const selectedYear = getDateYear(selectedDate)
      const [freshDayDetail, freshYearData] = await Promise.all([
        getDayDetail(selectedDate),
        getYearData(selectedYear),
      ])
      const nextPendingTaskIds = new Set(get().pendingTaskIds)
      nextPendingTaskIds.delete(planDiaId)

      const nextState: Partial<HistoryStore> = {
        pendingTaskIds: nextPendingTaskIds,
        error: null,
      }

      if (get().selectedDate === selectedDate) {
        nextState.dayDetail = freshDayDetail
      }

      if (get().year === selectedYear) {
        nextState.yearData = freshYearData
        nextState.streak = calcStreak(freshYearData.days)
      }

      set(nextState)
    } catch {
      const nextPendingTaskIds = new Set(get().pendingTaskIds)
      nextPendingTaskIds.delete(planDiaId)

      const nextState: Partial<HistoryStore> = {
        pendingTaskIds: nextPendingTaskIds,
        error: 'No se pudo actualizar la tarea.',
      }

      if (get().selectedDate === selectedDate) {
        nextState.dayDetail = previousDayDetail
      }

      if (get().year === year) {
        nextState.yearData = previousYearData
        nextState.streak = previousStreak
      }

      set(nextState)
    }
  },

  setYear: (year) => {
    set({ year, selectedDate: null, dayDetail: null, error: null })
    get().fetchYear(year)
  },

  clearSelection: () => {
    set({ selectedDate: null, dayDetail: null, error: null })
  },
}))
