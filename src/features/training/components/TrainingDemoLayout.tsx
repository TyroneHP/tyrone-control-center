import { Link, Outlet } from 'react-router-dom'
import { TrainingDemoProvider } from '../demo/TrainingDemoProvider'
import '../training-ui.css'

export function TrainingDemoLayout() {
  return (
    <TrainingDemoProvider>
      <div className="training-demo">
        <nav aria-label="Training">
          <Link to="/training">Dashboard</Link>
          <Link to="/training/plans/new">Pläne</Link>
          <Link to="/training/library">Bibliothek</Link>
        </nav>
        <Outlet />
      </div>
    </TrainingDemoProvider>
  )
}
