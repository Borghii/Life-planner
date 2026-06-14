import { useId, type CSSProperties } from 'react'

interface CoinIconProps {
  size?: number
  muted?: boolean
}

interface CoinAmountProps {
  value: number
  prefix?: string
  suffix?: string
  size?: 'small' | 'medium' | 'large'
  tone?: 'gold' | 'positive' | 'negative' | 'muted'
  showSign?: boolean
}

const sizes = {
  small: { coin: 16, font: 10, gap: 5 },
  medium: { coin: 21, font: 13, gap: 7 },
  large: { coin: 34, font: 28, gap: 10 },
}

const tones = {
  gold: '#f0b855',
  positive: '#8ab89a',
  negative: '#d98a70',
  muted: '#8b7e70',
}

export function CoinIcon({ size = 20, muted = false }: CoinIconProps) {
  const id = `coin-icon-${useId().replace(/:/g, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={id} x1="7" y1="5" x2="32" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor={muted ? '#9b8b72' : '#ffe09a'} />
          <stop offset="0.48" stopColor={muted ? '#73644f' : '#e4a63e'} />
          <stop offset="1" stopColor={muted ? '#4c4235' : '#9a5d16'} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill={`url(#${id})`} stroke={muted ? '#b3a28a' : '#ffd983'} strokeWidth="1.5" />
      <circle cx="20" cy="20" r="13.5" fill="none" stroke={muted ? '#d0c0a7' : '#ffe6a8'} strokeOpacity="0.58" />
      <path
        d="m20 10.7 2.5 5.1 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8 2.5-5.1Z"
        fill={muted ? '#d8c9b0' : '#fff0bd'}
        stroke={muted ? '#5d5141' : '#9c641d'}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CoinAmount({
  value,
  prefix,
  suffix = 'monedas',
  size = 'medium',
  tone = 'gold',
  showSign = false,
}: CoinAmountProps) {
  const metrics = sizes[size]
  const sign = showSign && value > 0 ? '+' : ''

  return (
    <span
      aria-label={`${prefix ? `${prefix} ` : ''}${sign}${value} monedas`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: metrics.gap,
        color: tones[tone],
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: metrics.font,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <CoinIcon size={metrics.coin} muted={tone === 'muted'} />
      {prefix ? <span style={prefixStyle}>{prefix}</span> : null}
      <span>{sign}{value}</span>
      {suffix ? <span style={suffixStyle(size)}>{suffix}</span> : null}
    </span>
  )
}

const prefixStyle: CSSProperties = {
  color: '#8b7e70',
  fontWeight: 400,
}

function suffixStyle(size: CoinAmountProps['size']): CSSProperties {
  return {
    color: size === 'large' ? '#c8a97e' : 'currentColor',
    fontSize: size === 'large' ? 11 : '0.82em',
    fontWeight: 500,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  }
}
