import type { ReactNode } from 'react';

export const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div aria-hidden="true" className={`animate-skeleton bg-slate-200 ${className}`} />
);

export const SkeletonRows = ({ count = 5, className = '' }: { count?: number; className?: string }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center gap-3">
        <SkeletonBlock className="h-8 w-8 shrink-0 rounded-sm" />
        <SkeletonBlock className="h-3 flex-1 rounded-sm" />
        <SkeletonBlock className="h-3 w-20 rounded-sm" />
      </div>
    ))}
  </div>
);

export const AnalyticsSkeleton = () => (
  <div className="space-y-6" role="status" aria-label="Loading analytics">
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <section key={index} className="border border-slate-200 bg-white p-6 shadow-sm">
          <SkeletonBlock className="h-3 w-28 rounded-sm" />
          <SkeletonBlock className="mt-4 h-9 w-20 rounded-sm" />
        </section>
      ))}
    </div>
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <section className="space-y-4 border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
        <SkeletonBlock className="h-4 w-44 rounded-sm" />
        <SkeletonBlock className="h-52 w-full rounded-sm" />
      </section>
      <section className="border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
        <SkeletonBlock className="h-4 w-36 rounded-sm" />
        <SkeletonRows count={4} className="mt-6" />
      </section>
    </div>
  </div>
);

export const RosterSkeleton = () => (
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" role="status" aria-label="Loading roster">
    {Array.from({ length: 2 }, (_, index) => (
      <section key={index} className="space-y-5 border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-4 w-36 rounded-sm" />
          <SkeletonBlock className="h-3 w-16 rounded-sm" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 flex-1 rounded-sm" />
          <SkeletonBlock className="h-9 w-24 rounded-sm" />
        </div>
        <SkeletonRows count={6} />
      </section>
    ))}
  </div>
);

export const ScheduleSkeleton = () => (
  <section className="overflow-hidden border border-slate-200 bg-white shadow-sm" role="status" aria-label="Loading schedules">
    <SkeletonBlock className="h-12 w-full rounded-none bg-slate-300" />
    <div className="grid grid-cols-5 gap-px bg-slate-200 p-px">
      {Array.from({ length: 15 }, (_, index) => (
        <SkeletonBlock key={index} className="h-20 rounded-none bg-white" />
      ))}
    </div>
  </section>
);

export const TableSkeletonRows = ({
  columns,
  count = 5,
}: {
  columns: number;
  count?: number;
}) => (
  <>
    {Array.from({ length: count }, (_, rowIndex) => (
      <tr key={rowIndex} aria-hidden="true">
        {Array.from({ length: columns }, (_, columnIndex) => (
          <td key={columnIndex} className="px-5 py-5">
            <SkeletonBlock className={`h-3 rounded-sm ${columnIndex === 0 ? 'w-24' : 'w-full'}`} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const PanelSkeleton = ({ children }: { children: ReactNode }) => (
  <div className="border border-slate-200 bg-white p-5" role="status" aria-label="Loading content">
    {children}
  </div>
);
