export const colors = {
  canvas: '#0f0e0d',
  surface: '#1a1917',
  surfaceRaised: '#211f1c',
  surfaceHover: '#2a2723',
  border: '#2e2b27',
  borderMid: '#3d3830',
  cream: '#f0e6d3',
  creamDim: '#c8a97e',
  muted: '#7a6e61',
  gold: '#d4943a',
  goldBright: '#f0b855',
  goldDim: '#8a6030',
  goldBg: '#2a1e0d',
  sage: '#5a8a6a',
  sageDim: '#2d4a38',
  sageBright: '#8ab89a',
  urgent: '#c45a3a',
  urgentDim: '#4a2218',
  info: '#5a7ab5',
}

export const fonts = {
  display: "'Cormorant Garamond', Georgia, serif",
  body: "'Plus Jakarta Sans', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
}

export const spacing = {
  hourPx: 72,
  hourLabelWidth: 46,
}

export const transitions = {
  fast: { duration: 0.15 },
  base: { duration: 0.25 },
  slow: { duration: 0.4 },
  spring: { type: 'spring' as const, stiffness: 280, damping: 28 },
  springGentle: { type: 'spring' as const, stiffness: 180, damping: 24 },
}

export const heatLevels = {
  none: '#1a1917',
  zero: '#211f1c',
  low: '#3d5a30',
  mid: '#5a8a6a',
  high: '#78b888',
  full: '#a0d4a8',
}
