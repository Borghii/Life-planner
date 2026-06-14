import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setPlanTaskDone } from '../api/planning'
import {
  completeRewardPass,
  pauseRewardPass,
  resumeRewardPass,
  startRewardPass,
} from '../api/economy'
import type { RewardPass } from '../api/types'
import { useEconomyStore } from './useEconomyStore'

export const FOCUS_SECONDS = 50 * 60
export const BREAK_SECONDS = 10 * 60
const DEFAULT_RAIN_VOLUME = 0.55

export type PomodoroMode = 'focus' | 'break' | 'leisure'

export interface LogEntry {
  type: PomodoroMode
  completedAt: string
  date: string
  plan_dia_id?: string
  taskName?: string
}

export interface ActivePomodoroTask {
  plan_dia_id: string
  name: string
  color: string
  date: string
  totalFocusSessions: number
  completedFocusSessions: number
}

export interface PomodoroTaskInput {
  plan_dia_id: string
  name: string
  color: string
  date: string
  totalFocusSessions: number
  completedFocusSessions?: number
}

export interface PomodoroDistraction {
  id: string
  text: string
  createdAt: string
}

export interface ActiveLeisurePass {
  id: number
  name: string
  durationMinutes: number
  status: 'pending' | 'active'
}

export interface PomodoroCompletionEvent {
  id: string
  type: 'focus' | 'task'
  plan_dia_id?: string
  taskName: string
  completedAt: string
  completedFocusSessions: number
  totalFocusSessions: number
  coinsDelta: number
  balance: number
}

interface PomodoroStore {
  mode: PomodoroMode
  secondsLeft: number
  running: boolean
  endsAt: number | null
  soundEnabled: boolean
  rainVolume: number
  distractions: PomodoroDistraction[]
  log: LogEntry[]
  activeTask: ActivePomodoroTask | null
  activeLeisurePass: ActiveLeisurePass | null
  leisureBusy: boolean
  completionEvent: PomodoroCompletionEvent | null
  completionError: string | null
  awaitingNextFocusConfirmation: boolean

  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void
  toggleSound: () => void
  setRainVolume: (volume: number) => void
  addDistraction: (text: string) => boolean
  completeDistraction: (id: string) => void
  deleteDistraction: (id: string) => void
  loadTask: (task: PomodoroTaskInput) => boolean
  clearActiveTask: () => boolean
  loadLeisurePass: (pass: RewardPass) => boolean
  clearLeisurePass: () => boolean
  finishLeisurePass: () => void
  syncLeisurePasses: (passes: RewardPass[]) => void
  ackCompletionEvent: () => void
  confirmNextFocus: () => void
  deferNextFocus: () => void
  _tick: () => void
  _syncTimer: () => void
}

// El interval vive fuera de React para no morir al desmontar el componente.
// La fuente de verdad es endsAt, asi el tiempo sigue corriendo si la app se minimiza o cierra.
const RAIN_AUDIO_SRC = new URL(
  '../assets/donrain-lluvia-relajante-rain-2-210937.mp3',
  import.meta.url,
).href

let _intervalId: ReturnType<typeof setInterval> | null = null
let _audioCtx: AudioContext | null = null
let _rainAudio: HTMLAudioElement | null = null

function clearTimerInterval() {
  if (_intervalId) {
    clearInterval(_intervalId)
    _intervalId = null
  }
}

function startTimerInterval(get: () => PomodoroStore) {
  clearTimerInterval()
  _intervalId = setInterval(() => get()._tick(), 1000)
}

function modeSeconds(mode: Exclude<PomodoroMode, 'leisure'>) {
  return mode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS
}

function nextMode(mode: Exclude<PomodoroMode, 'leisure'>): Exclude<PomodoroMode, 'leisure'> {
  return mode === 'focus' ? 'break' : 'focus'
}

function secondsUntil(endsAt: number) {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContextCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) return null

  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new AudioContextCtor()
  }

  if (_audioCtx.state === 'suspended') {
    void _audioCtx.resume().catch(() => undefined)
  }

  return _audioCtx
}

function getRainAudio() {
  if (typeof Audio === 'undefined') return null

  if (!_rainAudio) {
    _rainAudio = new Audio(RAIN_AUDIO_SRC)
    _rainAudio.loop = true
    _rainAudio.preload = 'auto'
    _rainAudio.volume = DEFAULT_RAIN_VOLUME
  }

  return _rainAudio
}

function clampRainVolume(volume: number) {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : DEFAULT_RAIN_VOLUME))
}

function createDistractionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeDistractionText(text: string) {
  return text.trim().slice(0, 240)
}

function normalizeDistractions(value: unknown): PomodoroDistraction[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const candidate = item as Partial<PomodoroDistraction>
    const text = typeof candidate.text === 'string'
      ? normalizeDistractionText(candidate.text)
      : ''

    if (
      !text
      || typeof candidate.id !== 'string'
      || typeof candidate.createdAt !== 'string'
    ) {
      return []
    }

    return [{
      id: candidate.id,
      text,
      createdAt: candidate.createdAt,
    }]
  })
}

function setAudioRainVolume(volume: number) {
  if (_rainAudio) {
    _rainAudio.volume = clampRainVolume(volume)
  }
}

function startRain(soundEnabled: boolean, rainVolume: number) {
  if (!soundEnabled) return

  try {
    const audio = getRainAudio()
    if (!audio) return
    audio.volume = clampRainVolume(rainVolume)
    if (!audio.paused) return
    void audio.play().catch(() => undefined)
  } catch { /* Audio no disponible */ }
}

function stopRain() {
  try {
    _rainAudio?.pause()
  } catch { /* Audio no disponible */ }
}

function dateStr(timestamp = Date.now()) {
  const date = new Date(timestamp)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clampCompletedFocus(completed: number, total: number) {
  return Math.min(Math.max(0, completed), Math.max(1, total))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo actualizar el temporizador'
}

function playBeep(type: 'focus-end' | 'break-end' | 'leisure-end') {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const count = type === 'focus-end' ? 2 : 3
    const freq = type === 'focus-end' ? 440 : type === 'leisure-end' ? 520 : 660
    const beepDuration = 0.25
    const gap = 0.15
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * (beepDuration + gap)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.35, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + beepDuration)
      osc.start(start)
      osc.stop(start + beepDuration)
    }
  } catch { /* AudioContext no disponible */ }
}

export const usePomodoroStore = create<PomodoroStore>()(
  persist(
    (set, get) => {
      function applyLeisurePass(pass: RewardPass) {
        const running = pass.status === 'active' && pass.timer_running
        const secondsLeft = Math.max(0, pass.remaining_seconds)

        set({
          mode: 'leisure',
          activeTask: null,
          activeLeisurePass: {
            id: pass.id,
            name: pass.reward_name,
            durationMinutes: pass.duration_minutes,
            status: pass.status === 'pending' ? 'pending' : 'active',
          },
          secondsLeft,
          running,
          endsAt: running ? Date.now() + secondsLeft * 1000 : null,
          leisureBusy: false,
          completionError: null,
          awaitingNextFocusConfirmation: false,
        })

        if (running) {
          startRain(get().soundEnabled, get().rainVolume)
          startTimerInterval(get)
        } else {
          clearTimerInterval()
          stopRain()
        }
      }

      function completeLeisureInterval(withBeep: boolean) {
        const { activeLeisurePass, leisureBusy, log } = get()
        if (!activeLeisurePass || leisureBusy || activeLeisurePass.status !== 'active') return

        clearTimerInterval()
        stopRain()
        set({
          running: false,
          endsAt: null,
          secondsLeft: 0,
          leisureBusy: true,
          completionError: null,
        })

        void completeRewardPass(activeLeisurePass.id)
          .then(() => {
            const completedAt = new Date().toISOString()
            if (withBeep && get().soundEnabled) playBeep('leisure-end')
            set({
              mode: 'focus',
              secondsLeft: FOCUS_SECONDS,
              activeLeisurePass: null,
              leisureBusy: false,
              completionError: null,
              log: [
                ...log,
                {
                  type: 'leisure',
                  completedAt,
                  date: dateStr(),
                  taskName: activeLeisurePass.name,
                },
              ],
            })
            void useEconomyStore.getState().refresh()
          })
          .catch((error) => {
            set({
              leisureBusy: false,
              completionError: errorMessage(error),
            })
          })
      }

      function completeCurrentInterval(withBeep: boolean) {
        const state = get()
        if (state.mode === 'leisure') {
          completeLeisureInterval(withBeep)
          return
        }

        const { endsAt, mode, log, activeTask } = state
        const completedAt = endsAt ?? Date.now()
        const completedAtIso = new Date(completedAt).toISOString()
        const entry: LogEntry = {
          type: mode,
          completedAt: completedAtIso,
          date: dateStr(completedAt),
          plan_dia_id: activeTask?.plan_dia_id,
          taskName: activeTask?.name,
        }
        let completedTaskToMark: ActivePomodoroTask | null = null
        let focusCompletionEvent: PomodoroCompletionEvent | null = null
        let nextActiveTask = activeTask
        let nextModeValue = nextMode(mode)
        let nextSecondsLeft = modeSeconds(nextModeValue)
        let nextRunning = false
        let nextEndsAt: number | null = null
        let awaitingNextFocusConfirmation = false

        if (mode === 'focus') {
          if (activeTask) {
            const completedFocusSessions = clampCompletedFocus(
              activeTask.completedFocusSessions + 1,
              activeTask.totalFocusSessions,
            )
            nextActiveTask = { ...activeTask, completedFocusSessions }

            if (completedFocusSessions >= activeTask.totalFocusSessions) {
              completedTaskToMark = { ...activeTask, completedFocusSessions }
              nextActiveTask = null
            } else {
              focusCompletionEvent = {
                id: `${completedAtIso}-${activeTask.plan_dia_id}-focus`,
                type: 'focus',
                plan_dia_id: activeTask.plan_dia_id,
                taskName: activeTask.name,
                completedAt: completedAtIso,
                completedFocusSessions,
                totalFocusSessions: activeTask.totalFocusSessions,
                coinsDelta: 0,
                balance: useEconomyStore.getState().balance,
              }
            }
          } else {
            focusCompletionEvent = {
              id: `${completedAtIso}-free-focus`,
              type: 'focus',
              taskName: 'Pomodoro libre',
              completedAt: completedAtIso,
              completedFocusSessions: 1,
              totalFocusSessions: 1,
              coinsDelta: 0,
              balance: useEconomyStore.getState().balance,
            }
          }

          nextModeValue = 'break'
          nextSecondsLeft = BREAK_SECONDS
          nextRunning = true
          nextEndsAt = completedAt + BREAK_SECONDS * 1000
        } else {
          nextModeValue = 'focus'
          nextSecondsLeft = FOCUS_SECONDS

          if (activeTask) {
            awaitingNextFocusConfirmation = true
          }
        }

        stopRain()

        if (withBeep && get().soundEnabled) {
          playBeep(mode === 'focus' ? 'focus-end' : 'break-end')
        }

        set({
          running: nextRunning,
          endsAt: nextEndsAt,
          mode: nextModeValue,
          secondsLeft: nextSecondsLeft,
          activeTask: nextActiveTask,
          awaitingNextFocusConfirmation,
          completionError: null,
          completionEvent: focusCompletionEvent,
          log: [...log, entry],
        })

        if (completedTaskToMark) {
          void setPlanTaskDone(completedTaskToMark.plan_dia_id, true)
            .then((result) => {
              useEconomyStore.getState().syncTaskCompletion(result)
              set({
                completionEvent: {
                  id: `${completedAtIso}-${completedTaskToMark.plan_dia_id}-task`,
                  type: 'task',
                  plan_dia_id: completedTaskToMark.plan_dia_id,
                  taskName: completedTaskToMark.name,
                  completedAt: completedAtIso,
                  completedFocusSessions: completedTaskToMark.completedFocusSessions,
                  totalFocusSessions: completedTaskToMark.totalFocusSessions,
                  coinsDelta: result.points_delta,
                  balance: result.balance,
                },
              })
            })
            .catch((error) => {
              set({
                activeTask: completedTaskToMark,
                completionError: errorMessage(error),
              })
            })
        }
      }

      return {
        mode: 'focus',
        secondsLeft: FOCUS_SECONDS,
        running: false,
        endsAt: null,
        log: [],
        activeTask: null,
        activeLeisurePass: null,
        leisureBusy: false,
        completionEvent: null,
        completionError: null,
        awaitingNextFocusConfirmation: false,
        soundEnabled: true,
        rainVolume: DEFAULT_RAIN_VOLUME,
        distractions: [],

        startTimer: () => {
          get()._syncTimer()

          const {
            mode,
            secondsLeft,
            running,
            soundEnabled,
            rainVolume,
            activeLeisurePass,
            leisureBusy,
          } = get()
          if (running || leisureBusy) return

          if (mode === 'leisure') {
            if (!activeLeisurePass) return

            set({ leisureBusy: true, completionError: null })
            const request = activeLeisurePass.status === 'pending'
              ? startRewardPass(activeLeisurePass.id)
              : resumeRewardPass(activeLeisurePass.id)

            void request
              .then((pass) => {
                applyLeisurePass(pass)
                void useEconomyStore.getState().refresh()
              })
              .catch((error) => {
                set({ leisureBusy: false, completionError: errorMessage(error) })
              })
            return
          }

          const duration = secondsLeft > 0 ? secondsLeft : modeSeconds(mode)
          set({
            running: true,
            secondsLeft: duration,
            endsAt: Date.now() + duration * 1000,
            awaitingNextFocusConfirmation: false,
          })
          startRain(soundEnabled, rainVolume)
          startTimerInterval(get)
        },

        pauseTimer: () => {
          get()._syncTimer()

          const { running, endsAt, secondsLeft, mode, activeLeisurePass, leisureBusy } = get()
          if (!running) return

          if (mode === 'leisure') {
            if (!activeLeisurePass || leisureBusy) return
            clearTimerInterval()
            stopRain()
            set({
              running: false,
              endsAt: null,
              secondsLeft: endsAt ? secondsUntil(endsAt) : secondsLeft,
              leisureBusy: true,
            })
            void pauseRewardPass(activeLeisurePass.id)
              .then((pass) => {
                if (pass.status === 'consumed') {
                  set({ leisureBusy: false })
                  completeLeisureInterval(false)
                  return
                }
                applyLeisurePass(pass)
                void useEconomyStore.getState().refresh()
              })
              .catch((error) => {
                set({ leisureBusy: false, completionError: errorMessage(error) })
              })
            return
          }

          clearTimerInterval()
          stopRain()
          set({
            running: false,
            endsAt: null,
            secondsLeft: endsAt ? secondsUntil(endsAt) : secondsLeft,
          })
        },

        resetTimer: () => {
          const mode = get().mode
          if (mode === 'leisure') return
          clearTimerInterval()
          stopRain()
          set({
            running: false,
            secondsLeft: modeSeconds(mode),
            endsAt: null,
            awaitingNextFocusConfirmation: false,
          })
        },

        toggleSound: () => {
          const soundEnabled = !get().soundEnabled
          set({ soundEnabled })

          if (soundEnabled && get().running) {
            startRain(true, get().rainVolume)
          } else {
            stopRain()
          }
        },

        setRainVolume: (volume) => {
          const rainVolume = clampRainVolume(volume)
          set({ rainVolume })
          setAudioRainVolume(rainVolume)
        },

        addDistraction: (text) => {
          const normalizedText = normalizeDistractionText(text)
          if (!normalizedText) return false

          const distraction: PomodoroDistraction = {
            id: createDistractionId(),
            text: normalizedText,
            createdAt: new Date().toISOString(),
          }

          set((state) => ({
            distractions: [...state.distractions, distraction],
          }))
          return true
        },

        completeDistraction: (id) => {
          set((state) => ({
            distractions: state.distractions.filter((item) => item.id !== id),
          }))
        },

        deleteDistraction: (id) => {
          set((state) => ({
            distractions: state.distractions.filter((item) => item.id !== id),
          }))
        },

        loadTask: (task) => {
          if (get().running || get().activeLeisurePass) return false

          const currentTask = get().activeTask
          const totalFocusSessions = Math.max(1, Math.ceil(task.totalFocusSessions))
          const completedFocusSessions = clampCompletedFocus(
            currentTask?.plan_dia_id === task.plan_dia_id
              ? currentTask.completedFocusSessions
              : task.completedFocusSessions ?? 0,
            totalFocusSessions,
          )

          clearTimerInterval()
          stopRain()
          set({
            running: false,
            endsAt: null,
            mode: 'focus',
            secondsLeft: FOCUS_SECONDS,
            activeTask: {
              plan_dia_id: task.plan_dia_id,
              name: task.name,
              color: task.color,
              date: task.date,
              totalFocusSessions,
              completedFocusSessions,
            },
            completionError: null,
            awaitingNextFocusConfirmation: false,
          })
          return true
        },

        clearActiveTask: () => {
          if (get().running) return false

          clearTimerInterval()
          stopRain()
          set({
            running: false,
            endsAt: null,
            mode: 'focus',
            secondsLeft: FOCUS_SECONDS,
            activeTask: null,
            completionError: null,
            awaitingNextFocusConfirmation: false,
          })
          return true
        },

        loadLeisurePass: (pass) => {
          if (
            get().running
            || get().activeTask
            || !['pending', 'active'].includes(pass.status)
          ) {
            return false
          }

          applyLeisurePass(pass)
          return true
        },

        clearLeisurePass: () => {
          const { activeLeisurePass, running, leisureBusy } = get()
          if (
            !activeLeisurePass
            || activeLeisurePass.status !== 'pending'
            || running
            || leisureBusy
          ) {
            return false
          }

          clearTimerInterval()
          stopRain()
          set({
            mode: 'focus',
            secondsLeft: FOCUS_SECONDS,
            endsAt: null,
            activeLeisurePass: null,
            completionError: null,
          })
          return true
        },

        finishLeisurePass: () => {
          completeLeisureInterval(false)
        },

        syncLeisurePasses: (passes) => {
          const current = get().activeLeisurePass
          const serverPass = current
            ? passes.find((pass) => pass.id === current.id)
            : passes.find((pass) => pass.status === 'active')

          if (!serverPass || !['pending', 'active'].includes(serverPass.status)) {
            if (current) {
              clearTimerInterval()
              stopRain()
              set({
                mode: 'focus',
                secondsLeft: FOCUS_SECONDS,
                running: false,
                endsAt: null,
                activeLeisurePass: null,
                leisureBusy: false,
              })
            }
            return
          }

          applyLeisurePass(serverPass)
        },

        ackCompletionEvent: () => {
          set({ completionEvent: null })
        },

        confirmNextFocus: () => {
          const {
            activeTask,
            awaitingNextFocusConfirmation,
            mode,
            running,
          } = get()

          if (!activeTask || !awaitingNextFocusConfirmation || mode !== 'focus' || running) {
            return
          }

          set({ awaitingNextFocusConfirmation: false })
          get().startTimer()
        },

        deferNextFocus: () => {
          set({ awaitingNextFocusConfirmation: false })
        },

        _tick: () => {
          const { running, endsAt } = get()
          if (!running) {
            clearTimerInterval()
            stopRain()
            return
          }
          if (!endsAt) {
            clearTimerInterval()
            stopRain()
            set({ running: false, endsAt: null })
            return
          }

          const remaining = secondsUntil(endsAt)
          if (remaining <= 0) {
            clearTimerInterval()
            completeCurrentInterval(true)
            get()._syncTimer()
          } else {
            set({ secondsLeft: remaining })
          }
        },

        _syncTimer: () => {
          clearTimerInterval()

          for (let transitionCount = 0; transitionCount < 2; transitionCount += 1) {
            const { running, endsAt } = get()
            if (!running) {
              stopRain()
              return
            }
            if (!endsAt) {
              stopRain()
              set({ running: false, endsAt: null })
              return
            }

            const remaining = secondsUntil(endsAt)
            if (remaining > 0) {
              set({ secondsLeft: remaining })
              startRain(get().soundEnabled, get().rainVolume)
              startTimerInterval(get)
              return
            }

            completeCurrentInterval(false)
            if (get().mode === 'leisure' || get().leisureBusy) return
          }
        },
      }
    },
    {
      name: 'pomodoro-v1',
      // Persiste la hora objetivo para que el timer sobreviva a minimizado/cierre.
      partialize: (s) => ({
        mode: s.mode,
        secondsLeft: s.secondsLeft,
        running: s.running,
        endsAt: s.endsAt,
        soundEnabled: s.soundEnabled,
        rainVolume: s.rainVolume,
        distractions: s.distractions,
        log: s.log,
        activeTask: s.activeTask,
        activeLeisurePass: s.activeLeisurePass,
        awaitingNextFocusConfirmation: s.awaitingNextFocusConfirmation,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PomodoroStore>
        return {
          ...currentState,
          ...persisted,
          rainVolume: clampRainVolume(persisted.rainVolume ?? currentState.rainVolume),
          distractions: normalizeDistractions(
            persisted.distractions ?? currentState.distractions,
          ),
        }
      },
    }
  )
)

function syncActiveTimer() {
  usePomodoroStore.getState()._syncTimer()
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', syncActiveTimer)
  document.addEventListener('visibilitychange', syncActiveTimer)
  usePomodoroStore.persist.onFinishHydration(syncActiveTimer)
  syncActiveTimer()
}
