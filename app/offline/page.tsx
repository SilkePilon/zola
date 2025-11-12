export default function OfflinePage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          Please check your internet connection and try again.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  )
}
