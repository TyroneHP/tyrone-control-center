import { Outlet } from 'react-router-dom'
import { TrainingDemoProvider } from '../demo/TrainingDemoProvider'
import '../training-ui.css'

export function TrainingDemoLayout() {
  return (
    <TrainingDemoProvider>
      <div className="training-demo">
        <nav aria-label="Training">
          <a href="/training">Dashboard</a>
          <a href="/training/plans/new">Pläne</a>
          <a href="/training/library">Bibliothek</a>
        </nav>
        <Outlet />
      </div>
    </TrainingDemoProvider>
  )
}
