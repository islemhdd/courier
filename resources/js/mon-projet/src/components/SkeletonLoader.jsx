export default function SkeletonLoader({ count = 5, variant = 'table' }) {
  if (variant === 'table') {
    return (
      <div className="float-in">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-slate-100 last:border-b-0">
            <div className="flex items-center gap-4">
              <div className="skeleton h-5 w-28" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-3 w-3/4" />
              </div>
              <div className="skeleton h-4 w-20 hidden md:block" />
              <div className="skeleton h-6 w-16 rounded-md" />
              <div className="skeleton h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className="float-in p-5 space-y-6">
        <div className="flex items-start gap-4">
          <div className="skeleton skeleton-avatar" />
          <div className="flex-1 space-y-2">
            <div className="skeleton skeleton-heading" />
            <div className="skeleton skeleton-text" />
          </div>
        </div>
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="flex justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="flex justify-between">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4">
          <div className="skeleton h-12 rounded-2xl" />
          <div className="skeleton h-12 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (variant === 'stats') {
    return (
      <div className="float-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton h-6 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return null
}

export function ModalSkeleton({ title = 'Chargement' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-xl rounded-[1.75rem] p-6">
        <div className="skeleton h-5 w-40" />
        <div className="mt-2 text-sm text-slate-500">{title}</div>
        <div className="mt-6 space-y-3">
          <div className="skeleton h-11 w-full rounded-2xl" />
          <div className="skeleton h-11 w-full rounded-2xl" />
          <div className="skeleton h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
