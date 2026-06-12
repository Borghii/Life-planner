const quotes = [
  "La disciplina es elegir entre lo que quieres ahora y lo que más quieres.",
  "El éxito no es el resultado de la combustión espontánea. Debes encenderte.",
  "Un día a la vez. Esta es la única forma de avanzar.",
  "Haz lo difícil mientras es fácil, y lo grande mientras es pequeño.",
  "La motivación te pone en marcha; el hábito te mantiene avanzando.",
  "No cuentes los días; haz que los días cuenten.",
  "La constancia convierte lo ordinario en extraordinario.",
  "Primero lo necesario, luego lo posible, y de repente estarás haciendo lo imposible.",
  "Cada experto fue alguna vez un principiante.",
  "El progreso, no la perfección.",
  "Tu futuro yo te está mirando. Hazlo enorgullecerse.",
  "Pequeños pasos todos los días llevan a grandes distancias con el tiempo.",
  "La energía fluye hacia donde va la atención.",
  "Sé el arquitecto de tu propio tiempo.",
  "Trabaja mientras ellos duermen; aprende mientras ellos descansan.",
]

export function useDailyQuote(): string {
  const day = new Date().getDate() + new Date().getMonth() * 31
  return quotes[day % quotes.length]
}
