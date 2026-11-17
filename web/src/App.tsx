import { createBrowserRouter } from 'react-router';
import { AppShell } from './components/AppShell';
import { RequireMember } from './components/RequireMember';
import { AdminPage } from './pages/AdminPage';
import { JoinPage, LoginPage, ResetPage } from './pages/AuthPages';
import { MePage } from './pages/MePage';
import { CollectionsPage, NotFound, PlanPage, RecipesHome, SettingsPage } from './pages/Placeholders';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <RecipesHome /> },
      { path: 'plan', element: <PlanPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'collections', element: <CollectionsPage /> },
      {
        path: 'me',
        element: (
          <RequireMember what="Your account page">
            <MePage />
          </RequireMember>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/join/:token', element: <JoinPage /> },
  { path: '/reset/:token', element: <ResetPage /> },
  { path: '/admin', element: <AdminPage /> },
]);
