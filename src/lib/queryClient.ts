import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LockedError } from './supabase'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    // A refused write fails the same way every time.
    mutations: { retry: (count, error) => !(error instanceof LockedError) && count < 2 },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (error instanceof LockedError) return // expected (a client started the workout); the page says so
      console.error(error)
      if (mutation.meta?.quiet) return // the caller shows its own message
      toast.error("Couldn't save that change", { description: 'Check your connection and try again.' })
    },
  }),
})
