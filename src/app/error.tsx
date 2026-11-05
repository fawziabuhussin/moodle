"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = /postgres:\/\/|password/i.test(error.message)
    ? "The database could not be reached. Check DATABASE_URL and DIRECT_URL, then run the migration and seed."
    : error.message;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-medium text-primary">Entilaka</p>
      <h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <button onClick={reset} className="mt-6 h-10 rounded-xl bg-primary px-4 text-sm text-primary-foreground">
        Try again
      </button>
    </main>
  );
}
