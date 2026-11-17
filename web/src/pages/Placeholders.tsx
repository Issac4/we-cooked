function Soon({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
      <p className="text-muted">{text}</p>
    </div>
  );
}

export function NotFound() {
  return <Soon title="Page not found" text="That page does not exist." />;
}
