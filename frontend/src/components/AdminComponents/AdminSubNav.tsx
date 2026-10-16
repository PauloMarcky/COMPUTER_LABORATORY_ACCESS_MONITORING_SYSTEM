import React from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import type { WireframeScreenId } from '../../types';

interface AdminSubNavProps {
  activeScreen: WireframeScreenId;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

export const AdminSubNav: React.FC<AdminSubNavProps> = ({ activeScreen, onNavigate, onLogout }) => {
  const [isOpen, setIsOpen] = React.useState(() => (
    window.sessionStorage.getItem('clams-admin-nav') === 'open'
  ));
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

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

  const mobileBottomNav = (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white md:hidden no-print">
      <div className="flex items-stretch justify-around">
        <button
          type="button"
          onClick={() => onNavigate('admin-schedule-module')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${isSchedules ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="Schedules"
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-subjects')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${activeScreen === 'admin-subjects' ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="Subjects"
        >
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-reports-dashboard')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${isReports ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="Class Reports"
        >
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-teacher-workload')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${activeScreen === 'admin-teacher-workload' ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="Instructor Workload"
        >
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-students-analytics')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${isAnalytics ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="Analytics Report"
        >
          <BarChart3 className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-user-management')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${activeScreen === 'admin-user-management' ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="User Management"
        >
          <Users className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin-terms')}
          className={`flex flex-1 flex-col items-center justify-center py-3 transition-colors ${activeScreen === 'admin-terms' ? 'text-[#1b325f]' : 'text-slate-500'}`}
          aria-label="Terms"
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );

  if (!isOpen) {
    return (
      <>
        <button
          type="button"
          onClick={openNavigation}
          className="clams-sidebar-toggle no-print hidden md:flex"
          aria-label="Show administration navigation"
          title="Show navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        {mobileBottomNav}
      </>
    );
  }

  return (
    <>
      <aside
        className={`clams-sidebar z-20 hidden md:flex flex-col border border-slate-200 bg-white px-4 pb-5 pt-6 no-print ${
          justOpened ? 'admin-sidebar-slide-in' : ''
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

        <div className="mt-auto pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Log Out
          </button>
        </div>
      </nav>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f1a30]/70 px-4 py-6 backdrop-blur-sm no-print">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-logout-title"
            className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl shadow-rose-900/20"
          >
            <div className="bg-[#1b325f] px-6 py-4">
              <h2 id="admin-logout-title" className="text-base font-bold text-white">
                Log out?
              </h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm leading-relaxed text-slate-600">
                You will be returned to the login portal. Any unsaved changes will be lost.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-600/30 transition-colors hover:bg-rose-700"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Log Out
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      </aside>
      {mobileBottomNav}
    </>
  );
};