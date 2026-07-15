export function AdminPageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="label text-mute-2">{eyebrow}</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
