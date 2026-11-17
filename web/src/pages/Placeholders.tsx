import { useMe } from '../lib/session';
import { RequireMember } from '../components/RequireMember';

function Soon({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
      <p className="text-muted">{text}</p>
    </div>
  );
}

export function RecipesHome() {
  const { me } = useMe();
  return (
    <Soon
      title="All recipes"
      text={me ? `Welcome, ${me.username}. Recipes arrive in the next milestone.` : 'Recipes arrive in the next milestone. You are browsing as a guest.'}
    />
  );
}

export function PlanPage() {
  return (
    <RequireMember what="The meal plan">
      <Soon title="Meal plan" text="Coming in a later milestone." />
    </RequireMember>
  );
}

export function SettingsPage() {
  return (
    <RequireMember what="Household settings">
      <Soon title="Household settings" text="Week start, holiday calendars, filter groups and AI rules arrive with their features." />
    </RequireMember>
  );
}

export function CollectionsPage() {
  return <Soon title="Collections" text="Coming with the collections milestone." />;
}

export function NotFound() {
  return <Soon title="Page not found" text="That page does not exist." />;
}
