import React from 'react';
import { LogOut } from 'lucide-react';
import universityLogo from '../assets/images/CLAMS-removebg.png';
import { WireframeScreenId } from '../types';

interface ClamsHeaderProps {
  onNavigate: (screen: WireframeScreenId) => void;
  statusLabel?: string;
  onLogout?: () => void | Promise<void>;
  showLogout?: boolean;
  logoutTitle?: string;
  logoutMessage?: string;
}

export const ClamsHeader: React.FC<ClamsHeaderProps> = ({
  onNavigate,
  statusLabel = 'Computer Laboratory System',
  onLogout,
  showLogout = true,
  logoutTitle = 'Log out?',
  logoutMessage = 'You will return to role selection.',
}) => {
  const logoutDialogRef = React.useRef<HTMLDialogElement>(null);

  const handleLogout = () => {
    logoutDialogRef.current?.showModal();
  };

  const confirmLogout = async () => {
    logoutDialogRef.current?.close();
    if (onLogout) {
      await onLogout();
      return;
    }
    onNavigate('login-portal');
  };

  return (
    <header className="sticky top-0 z-40 bg-[#1b325f] text-white px-3 py-3 sm:px-6 sm:py-3.5 border-b border-[#142547] no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand mark */}
        <div className="flex items-center gap-3 text-left">
          <img
            src={universityLogo}
            alt="University of La Salette logo"
            className="h-10 w-auto max-w-40 object-contain shrink-0"
          />
          <div>
            <div className="text-base font-bold tracking-tight text-white leading-tight group-hover:text-amber-200 transition-colors">
              CLAMS
            </div>
            <div className="text-[11px] text-slate-300 leading-tight">
              University of La Salette, Inc.
            </div>
          </div>
        </div>

        {/* Zone 3: Active Lab Status & Portal Switcher */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            className={`${showLogout ? '' : 'md:hidden '}inline-flex items-center gap-2 rounded-md bg-amber-600 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700`}
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </div>

      <dialog
        ref={logoutDialogRef}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            logoutDialogRef.current?.close();
          }
        }}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
      >
        <div className="p-6">
          <h2 id="logout-dialog-title" className="text-lg font-semibold text-slate-900">
            {logoutTitle}
          </h2>
          <p id="logout-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">
            {logoutMessage}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => logoutDialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmLogout}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b325f]"
            >
              <LogOut size={15} aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      </dialog>
    </header>
  );
};
