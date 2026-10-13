import React from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Menu,
  Users,
  X,
} from 'lucide-react';
import type { WireframeScreenId } from '../../types';

interface AdminSubNavProps {
  activeScreen: WireframeScreenId;
  onNavigate: (screen: WireframeScreenId) => void;
}

export const AdminSubNav: React.FC<AdminSubNavProps> = ({ activeScreen, onNavigate }) => {
  const [isOpen, setIsOpen] = React.useState(() => (
    window.sessionStorage.getItem('clams-admin-nav') === 'open'
  ));

  // True only for the brief window right after the burger is clicked.
  // Drives the slide-in animation so it doesn't replay on every page mount.
  const [justOpened, setJustOpened] = React.useState(false);

  React.useEffect(() => {
    if (!justOpened) return;
    const timer = window.setTimeout(() => setJustOpened(false), 320);
    return () => window.clearTimeout(timer);
  }, [justOpened]);

  const isSchedules =
    activeScreen === 'admin-schedule-module' ||
    activeScreen === 'admin-schedule-add-module' ||
    activeScreen === 'admin-schedule-roster';
  const isReports = activeScreen === 'admin-reports-dashboard';
  const isAnalytics = activeScreen === 'admin-students-analytics';

  const itemClass = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-4 py-5 text-left text-m font-semibold transition-colors ${isActive
      ? 'bg-[#e8eef8] text-[#1b325f]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const openNavigation = () => {
    setJustOpened(true);
    setIsOpen(true);
    window.sessionStorage.setItem('clams-admin-nav', 'open');
  };

  const closeNavigation = () => {
    setIsOpen(false);
    window.sessionStorage.setItem('clams-admin-nav', 'closed');
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openNavigation}
        className="clams-sidebar-toggle no-print"
        aria-label="Show administration navigation"
        title="Show navigation"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      className={`clams-sidebar z-20 flex flex-col border border-slate-200 bg-white px-4 pb-5 pt-6 no-print ${justOpened ? 'admin-sidebar-slide-in' : ''
        }`}
    >
      <div className="mb-4 flex items-center justify-between gap-2 px-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Administration
        </div>
        <button
          type="button"
          onClick={closeNavigation}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Hide administration navigation"
          title="Hide navigation"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={() => onNavigate('admin-schedule-module')}
          className={itemClass(isSchedules)}
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          Schedules
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-subjects')}
          className={itemClass(activeScreen === 'admin-subjects')}
        >
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          Subjects
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-reports-dashboard')}
          className={itemClass(isReports)}
        >
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
          Class Reports
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-teacher-workload')}
          className={itemClass(activeScreen === 'admin-teacher-workload')}
        >
          <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
          Instructor Workload
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-students-analytics')}
          className={itemClass(isAnalytics)}
        >
          <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Analytics Report
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-user-management')}
          className={itemClass(activeScreen === 'admin-user-management')}
        >
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          User Management
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-terms')}
          className={itemClass(activeScreen === 'admin-terms')}
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
          Terms
        </button>
      </nav>
    </aside>
  );
};