import React from 'react';
import { Download, FileWarning, LogOut, Menu, Monitor, X } from 'lucide-react';
import type { WireframeScreenId } from '../../types';

interface LabStaffSubNavProps {
  activeScreen: WireframeScreenId;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout: () => void;
}

export const LabStaffSubNav: React.FC<LabStaffSubNavProps> = ({ activeScreen, onNavigate, onLogout }) => {
  const [isOpen, setIsOpen] = React.useState(() => (
    window.sessionStorage.getItem('clams-custodian-nav') === 'open'
  ));
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [justOpened, setJustOpened] = React.useState(false);

  React.useEffect(() => {
    if (!justOpened) return;
    const timer = window.setTimeout(() => setJustOpened(false), 320);
    return () => window.clearTimeout(timer);
  }, [justOpened]);

  const isReports = activeScreen === 'lab-staff-report-detail';
  const isExport = activeScreen === 'lab-staff-report-export';
  const isLabUsage =
    activeScreen === 'lab-staff-rooms-module' || activeScreen === 'lab-staff-usage-history';

  const itemClass = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${isActive
      ? 'bg-[#e8eef8] text-[#1b325f]'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const openNavigation = () => {
    setJustOpened(true);
    setIsOpen(true);
    window.sessionStorage.setItem('clams-custodian-nav', 'open');
  };

  const closeNavigation = () => {
    setIsOpen(false);
    window.sessionStorage.setItem('clams-custodian-nav', 'closed');
  };

  const mobileBottomNav = (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white md:hidden no-print">
      <div className="flex items-stretch justify-around">
        <button
          type="button"
          onClick={() => onNavigate('lab-staff-report-detail')}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${isReports ? 'text-[#1b325f]' : 'text-slate-500'}`}
        >
          <FileWarning className="h-5 w-5" aria-hidden="true" />
          <span>Reports</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('lab-staff-rooms-module')}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${isLabUsage ? 'text-[#1b325f]' : 'text-slate-500'}`}
        >
          <Monitor className="h-5 w-5" aria-hidden="true" />
          <span>Lab Usage</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('lab-staff-report-export')}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${isExport ? 'text-[#1b325f]' : 'text-slate-500'}`}
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          <span>Export</span>
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
          aria-label="Show laboratory operations navigation"
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
          Laboratory Ops
        </div>
        <button
          type="button"
          onClick={closeNavigation}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Hide laboratory operations navigation"
          title="Hide navigation"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={() => onNavigate('lab-staff-report-detail')}
          className={itemClass(isReports)}
        >
          <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
          Reports
        </button>

        <button
          type="button"
          onClick={() => onNavigate('lab-staff-rooms-module')}
          className={itemClass(isLabUsage)}
        >
          <Monitor className="h-4 w-4 shrink-0" aria-hidden="true" />
          Laboratory Usage
        </button>

        <button
          type="button"
          onClick={() => onNavigate('lab-staff-report-export')}
          className={itemClass(isExport)}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          Export
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
            aria-labelledby="custodian-logout-title"
            className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl shadow-rose-900/20"
          >
            <div className="bg-[#1b325f] px-6 py-4">
              <h2 id="custodian-logout-title" className="text-base font-bold text-white">
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