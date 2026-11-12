import { useEffect, useState } from "react";
import type { WireframeScreenId } from "../types";
import ClamsFooter from '../components/ClamsFooter';
import clams_bg from '../assets/images/clams_bg_1.jpg';

const ulsCitLogo = new URL("../assets/images/uls-cit-logo.png", import.meta.url).href;

export const RoleSelectionPage = ({
  onNavigate,
}: {
  onNavigate: (screen: WireframeScreenId) => void;
}) => {
  const [loadingTarget, setLoadingTarget] = useState<WireframeScreenId | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const handleNavigate = (screen: WireframeScreenId) => {
    setLoadingTarget(screen);
    setTimeout(() => {
      onNavigate(screen);
    }, 600);
  };

  return (
    <div
      className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${clams_bg})` }}
    >

      <div className="absolute inset-0 bg-[#01001A]/60 pointer-events-none backdrop-blur-xs" />

      {/* First-page intro */}
      {showIntro && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#01001A] text-white animate-intro-exit">
          <img
            src={ulsCitLogo}
            alt="College of Information Technology logo"
            className="h-28 w-28 object-contain animate-intro-logo"
          />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-100/80">
            College of Information Technology
          </p>
        </div>
      )}

      {/* Loading overlay */}
      {loadingTarget && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#000047]/40 backdrop-blur-xs">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white"
            role="status"
            aria-label="Loading page"
          />
          <span className="sr-only">Loading page</span>
        </div>
      )}

      {/* Content sits above the overlay */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-[500px] overflow-hidden rounded-none border border-white/40 bg-white/90 shadow-2xl shadow-purple-950/40 backdrop-blur-xs sm:rounded-lg">

          {/* Header strip */}
          <div className="relative bg-[#1b325f] px-10 pt-8 pb-8">

            <div className="relative flex flex-col items-center">
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-white/60 bg-white/10 p-1.5 shadow-lg ring-4 ring-white/10 backdrop-blur-sm">
                <img
                  src={ulsCitLogo}
                  alt="University of La Salette logo"
                  className="h-full w-full object-contain"
                />
              </div>

              <h1 className="text-xl font-bold tracking-tight text-white text-center px-10 drop-shadow-md">
                Computer Laboratory Access Monitoring System
              </h1>
              <p className="mt-1 text-xs text-purple-100/80 text-center">
                University of La Salette Inc.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-10 py-8">
            {/* Access Level Selector */}
            <div className="w-full">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-purple-400/60" />
                <span className="text-[11px] font-semibold tracking-widest text-black/100 uppercase drop-shadow-sm">
                  Select Access Level
                </span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-purple-400/60" />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate('instructor-login')}
                  disabled={!!loadingTarget}
                  className="w-full rounded-lg bg-[#2563eb] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-purple-900/20 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-purple-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Instructor Console
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('student-login')}
                  disabled={!!loadingTarget}
                  className="w-full rounded-lg bg-[#2563eb] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-purple-900/20 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-purple-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Student Seat Claim
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('lab-staff-login')}
                  disabled={!!loadingTarget}
                  className="w-full rounded-lg bg-[#2563eb] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-purple-900/20 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-purple-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Custodian Portal
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('admin-login')}
                  disabled={!!loadingTarget}
                  className="w-full rounded-lg bg-[#2563eb] px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-purple-900/20 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-purple-900/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Administrator Portal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ClamsFooter />
    </div>
  );
};