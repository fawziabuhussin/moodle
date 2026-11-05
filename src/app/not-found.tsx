import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <p className="text-sm font-medium text-primary">Entilaka</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <Link href="/dashboard" className="mt-6 text-sm font-medium text-primary">
        Back to the dashboard
      </Link>
    </main>
  );
}
