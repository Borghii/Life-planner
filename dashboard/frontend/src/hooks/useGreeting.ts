import { useClock } from './useClock'

export function useGreeting(nombre?: string) {
  const now = useClock(60000)
  const hour = now.getHours()

  let saludo: string
  if (hour >= 5 && hour < 12) saludo = 'Buenos días'
  else if (hour >= 12 && hour < 20) saludo = 'Buenas tardes'
  else saludo = 'Buenas noches'

  const name = nombre?.trim()
  return name ? `${saludo}, ${name}` : saludo
}

export function useTimeOfDay() {
  const now = useClock(60000)
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 20) return 'afternoon'
  return 'evening'
}
