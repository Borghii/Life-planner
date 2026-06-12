import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AppShell } from './components/layout/AppShell'
import { PageTransition } from './components/layout/PageTransition'
import { DashboardPage } from './pages/DashboardPage'
import { LibraryPage } from './pages/LibraryPage'
import { PlanningPage } from './pages/PlanningPage'
import { HistoryPage } from './pages/HistoryPage'
import { HorariosPage } from './pages/HorariosPage'
import { PomodoroPage } from './pages/PomodoroPage'
import { RewardsPage } from './pages/RewardsPage'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
        <Route path="/biblioteca" element={<PageTransition><LibraryPage /></PageTransition>} />
        <Route path="/planificacion" element={<PageTransition><PlanningPage /></PageTransition>} />
        <Route path="/horarios" element={<PageTransition><HorariosPage /></PageTransition>} />
        <Route path="/historial" element={<PageTransition><HistoryPage /></PageTransition>} />
        <Route path="/pomodoro" element={<PageTransition><PomodoroPage /></PageTransition>} />
        <Route path="/recompensas" element={<PageTransition><RewardsPage /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
    </BrowserRouter>
  )
}

export default App
