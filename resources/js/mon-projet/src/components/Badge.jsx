import clsx from 'clsx'

const variants = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-orange-600',
  violet: 'bg-violet-50 text-violet-600',
  gray: 'bg-slate-100 text-slate-500',
}

export default function Badge({ children, variant = 'gray' }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-3 py-1 text-xs font-medium',
        variants[variant]
      )}
    >
     hjklmkj {children}
    </span>
  )
}