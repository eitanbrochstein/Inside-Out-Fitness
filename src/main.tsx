import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { LucideProvider } from 'lucide-react'
import { MotionConfig } from 'motion/react'
import { RouterProvider } from 'react-router'
import { AuthProvider } from './features/auth/AuthProvider'
import { UpdatePrompt } from './features/settings/UpdatePrompt'
import { installPressGlint } from './lib/pressGlint'
import { queryClient } from './lib/queryClient'
import { router } from './router'
import { Toaster } from './ui/Toaster'
import './index.css'

installPressGlint()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <LucideProvider strokeWidth={1.9}>
            <RouterProvider router={router} />
          </LucideProvider>
        </MotionConfig>
      </AuthProvider>
    </QueryClientProvider>
    <UpdatePrompt />
    <Toaster />
  </StrictMode>,
)
