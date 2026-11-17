import { createBrowserRouter } from 'react-router';
import { AppShell } from './components/AppShell';
import { RequireMember } from './components/RequireMember';
import { AdminPage } from './pages/AdminPage';
import { JoinPage, LoginPage, ResetPage } from './pages/AuthPages';
import { MePage } from './pages/MePage';
import { NotFound } from './pages/Placeholders';
import { PlanPage } from './pages/plan/PlanPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { RecipePage } from './pages/RecipePage';
import { RecipesPage } from './pages/RecipesPage';
import { EditRecipePage, NewRecipePage } from './pages/recipe-form/RecipeFormPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrashPage } from './pages/TrashPage';

const members = (what: string, element: React.ReactNode) => <RequireMember what={what}>{element}</RequireMember>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <RecipesPage /> },
      { path: 'recipes/new', element: members('Adding recipes', <NewRecipePage />) },
      { path: 'recipes/:id', element: <RecipePage /> },
      { path: 'recipes/:id/edit', element: members('Editing recipes', <EditRecipePage />) },
      { path: 'plan', element: <PlanPage /> },
      { path: 'settings', element: members('Household settings', <SettingsPage />) },
      { path: 'trash', element: members('The Trash', <TrashPage />) },
      { path: 'collections', element: <CollectionsPage /> },
      { path: 'me', element: members('Your account page', <MePage />) },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/join/:token', element: <JoinPage /> },
  { path: '/reset/:token', element: <ResetPage /> },
  { path: '/admin', element: <AdminPage /> },
]);
