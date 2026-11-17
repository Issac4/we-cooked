import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { ApiError } from './lib/api';
import { initTheme, useTheme } from './lib/theme';
import { router } from './App';
import './index.css';

initTheme();

function Toasts() {
  const choice = useTheme();
  return <Toaster position="bottom-center" offset={88} closeButton theme={choice === 'auto' ? 'system' : choice} />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't retry answers the server meant (401, 404, 410...); do retry network blips.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toasts />
    </QueryClientProvider>
  </StrictMode>,
);
