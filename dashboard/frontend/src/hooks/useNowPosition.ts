import { useClock } from './useClock'

export function useNowPosition(dayStart: number, dayEnd: number, hourPx: number) {
  const now = useClock(60000)
  const hours = now.getHours() + now.getMinutes() / 60
  const clampedHours = Math.max(dayStart, Math.min(dayEnd, hours))
  const top = (clampedHours - dayStart) * hourPx
  const isVisible = hours >= dayStart && hours <= dayEnd
  return { top, isVisible, currentHour: hours }
}
