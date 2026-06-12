import { useEffect } from 'react'
import { Navigation } from './Navigation'
import { useEconomyStore } from '../../store/useEconomyStore'

interface Props {
  children: React.ReactNode
}

export function AppShell({ children }: Props) {
  const refreshEconomy = useEconomyStore((state) => state.refresh)

  useEffect(() => {
    void refreshEconomy()
  }, [refreshEconomy])

  return (
    <div className="noise-overlay" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
      <main style={{ paddingTop: '52px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
