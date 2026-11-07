import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router'
import { LoginPage } from './features/auth/LoginPage'
import { ActivityPage } from './features/coaching/ActivityPage'
import { AssignPage } from './features/coaching/AssignPage'
import { ClientPage } from './features/coaching/ClientPage'
import { ClientsPage } from './features/coaching/ClientsPage'
import { CoachHomePage } from './features/coaching/CoachHomePage'
import { JoinPage } from './features/coaching/JoinPage'
import { RequireCoach } from './features/coaching/RequireCoach'
import { TemplatesPage } from './features/coaching/TemplatesPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { ExerciseDetailPage } from './features/exercises/ExerciseDetailPage'
import { ExercisesPage } from './features/exercises/ExercisesPage'
import { HomePage } from './features/home/HomePage'
import { PrivacyPage } from './features/legal/PrivacyPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ThemeSync } from './features/settings/ThemeSync'
import { ProgramPage } from './features/library/ProgramPage'
import { WorkoutPage } from './features/workout/WorkoutPage'
import { WorkoutsPage } from './features/workouts/WorkoutsPage'
import { ChartDefs } from './ui/charts/ChartDefs'
import { Splash } from './ui/Splash'
import { StatusBarVeil } from './ui/StatusBarVeil'
import { TabLayout } from './ui/TabLayout'

// Charts are lazy-loaded so they don't weigh down the first paint.
const progressPage = async () => ({ Component: (await import('./features/progress/ProgressPage')).ProgressPage })
const exerciseProgressPage = async () => ({
  Component: (await import('./features/progress/ExerciseProgressPage')).ExerciseProgressPage,
})

function AppLayout() {
  return (
    <>
      <ThemeSync />
      <ChartDefs />
      <StatusBarVeil />
      <ScrollRestoration />
      <Outlet />
    </>
  )
}

export const router = createBrowserRouter([
  { path: '/login', Component: LoginPage },
  { path: '/privacy', Component: PrivacyPage },
  {
    Component: RequireAuth,
    // Shown while a lazy route loads on a cold start.
    HydrateFallback: Splash,
    children: [
      {
        Component: AppLayout,
        children: [
          {
            Component: TabLayout,
            children: [
              { index: true, Component: HomePage },
              { path: 'workouts', Component: WorkoutsPage },
              { path: 'workouts/history', Component: WorkoutsPage },
              { path: 'workouts/saved', Component: WorkoutsPage },
              { path: 'progress', lazy: progressPage },
              {
                Component: RequireCoach,
                children: [
                  { path: 'coach', Component: CoachHomePage },
                  { path: 'coach/clients', Component: ClientsPage },
                  { path: 'coach/templates', Component: TemplatesPage },
                ],
              },
            ],
          },
          {
            Component: RequireCoach,
            children: [
              { path: 'coach/clients/:clientId', Component: ClientPage },
              { path: 'coach/clients/:clientId/progress', lazy: progressPage },
              { path: 'coach/clients/:clientId/progress/:exerciseId', lazy: exerciseProgressPage },
              { path: 'coach/assign', Component: AssignPage },
              { path: 'coach/activity', Component: ActivityPage },
            ],
          },
          { path: 'join', Component: JoinPage },
          { path: 'join/:code', Component: JoinPage },
          { path: 'w/:id', Component: WorkoutPage },
          { path: 'programs/:id', Component: ProgramPage },
          { path: 'exercises', Component: ExercisesPage },
          { path: 'exercises/:id', Component: ExerciseDetailPage },
          { path: 'progress/:exerciseId', lazy: exerciseProgressPage },
          { path: 'settings', Component: SettingsPage },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
