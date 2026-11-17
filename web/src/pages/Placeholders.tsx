import { RequireMember } from '../components/RequireMember';

function Soon({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
      <p className="text-muted">{text}</p>
    </div>
  );
}

export function PlanPage() {
  return (
    <RequireMember what="The meal plan">
      <Soon title="Meal plan" text="Coming in a later milestone." />
    </RequireMember>
  );
}

export function CollectionsPage() {
  return <Soon title="Collections" text="Coming with the collections milestone." />;
}

export function NotFound() {
  return <Soon title="Page not found" text="That page does not exist." />;
}
