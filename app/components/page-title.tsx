export default function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-fraunces font-semibold tracking-tight text-[var(--primary)] sm:text-4xl">
        {title}
      </h1>
      {description ? <p className="max-w-2xl text-base leading-7 text-[var(--foreground)]/85">{description}</p> : null}
    </div>
  );
}
