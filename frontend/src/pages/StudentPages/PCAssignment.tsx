import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ClamsHeader } from '../../components/ClamsHeader';
import type { PCStation, WireframeScreenId } from '../../types';

interface StudentClaimPCProps {
  stations: PCStation[];
  activeSessionLabel: string;
  isTimedIn: boolean;
  selectedPc: string;
  isClaimedConfirmed: boolean;
  onSelectPc: (pcNum: string) => void;
  onTimeIn: () => Promise<void>;
  onConfirmClaim: () => Promise<void>;
  onNavigate: (screen: WireframeScreenId) => void;
  onLogout?: () => void | Promise<void>;
}

export const StudentClaimPCView: React.FC<StudentClaimPCProps> = ({
  stations,
  activeSessionLabel,
  isTimedIn,
  selectedPc,
  isClaimedConfirmed,
  onSelectPc,
  onTimeIn,
  onConfirmClaim,
  onNavigate,
  onLogout,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update your lab session.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#f4f6f9]">
      <ClamsHeader onNavigate={onNavigate} statusLabel="Computer Laboratory System" onLogout={onLogout} />

      <main className="px-4 py-6 sm:py-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
          {selectedPc ? `You're on PC-${selectedPc}` : 'No PC selected'}
        </h1>
        <p className="text-base text-slate-500 mt-1">{activeSessionLabel || 'No active class session.'}</p>

        {/* Student self time-in removed — attendance is recorded by the instructor console only. */}

        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 rounded-lg bg-rose-100 border border-rose-100 px-4 py-3 flex items-center gap-2.5 text-base text-amber-950">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
          <span>
            {!activeSessionLabel
              ? 'There is no active class session for your enrolled schedules.'
              : !isTimedIn
                ? 'Scan your ID before claiming a PC.'
                : !selectedPc
                  ? 'Select a free PC station.'
                  : isClaimedConfirmed
                    ? `PC-${selectedPc} is marked as occupied by you.`
                    : 'Confirm your selected PC station to claim it.'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void runAction(onConfirmClaim)}
          disabled={!selectedPc || !isTimedIn || busy}
          className={`mt-4 w-full py-3.5 px-6 rounded-lg font-semibold text-sm transition-all cursor-pointer shadow-xs ${isClaimedConfirmed
            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
            : 'bg-[#1b325f] hover:bg-[#142547] text-white'
            }`}
        >
          {!selectedPc
            ? 'Select a PC station'
            : isClaimedConfirmed
              ? busy ? 'Releasing PC...' : `Release PC-${selectedPc}`
              : busy ? 'Claiming PC...' : `Claim PC-${selectedPc}`}
        </button>

        {selectedPc && isClaimedConfirmed && (
          <p className="text-center text-sm text-slate-400 mt-2.5">
            PC-{selectedPc} is marked as occupied by you.
          </p>
        )}

        <section className="mt-6 bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5">
          <div className="flex flex-col gap-1 mb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-800">Lab Overview</h2>
            <span className="text-sm text-slate-400">Tap an open PC station to switch seat</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {stations.length === 0 && (
              <p className="text-sm text-slate-400">No PC stations available.</p>
            )}
            {stations.map((pc) => {
              const isYou = pc.number === selectedPc || pc.status === 'you';
              const isUnavailable = !isYou && pc.status === 'unavailable';
              const isOccupied = !isYou && !isUnavailable && pc.status === 'occupied';

              return (
                <button
                  key={pc.number}
                  type="button"
                  disabled={isOccupied || isUnavailable || !isTimedIn || busy}
                  onClick={() => onSelectPc(pc.number)}
                  title={
                    isYou
                      ? `PC-${pc.number} (Your current station)`
                      : isUnavailable
                        ? `PC-${pc.number} is out of service`
                        : isOccupied
                          ? `PC-${pc.number} occupied by ${pc.occupantName}`
                          : `Switch to PC-${pc.number}`
                  }
                  className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center font-mono tabular-nums transition-all sm:w-16 sm:h-16 ${isYou
                    ? 'bg-blue-50/90 border-2 border-[#1b325f] text-[#1b325f] font-bold cursor-pointer shadow-2xs'
                    : isUnavailable
                      ? 'bg-slate-200/80 border border-slate-300 text-slate-400 font-semibold cursor-not-allowed opacity-70'
                      : isOccupied
                        ? 'bg-rose-100/90 border border-rose-200 text-rose-800 font-semibold cursor-not-allowed'
                        : 'bg-slate-100/90 border border-slate-200/90 text-slate-700 font-semibold hover:border-slate-400 hover:bg-slate-200/60 cursor-pointer'
                    }`}
                >
                  <span className="text-base leading-none">{pc.number}</span>
                  {isYou && (
                    <span className="text-[11px] font-sans font-bold tracking-wider uppercase mt-1 leading-none text-[#1b325f]">
                      YOU
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-sm text-slate-400">
            Red = occupied · Outline = free · Blue = you · Grey = out of service
          </div>
        </section>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => onNavigate('student-report-history')}
            className="flex-1 py-3 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            View my reports
          </button>
          <button
            type="button"
            onClick={() => onNavigate('student-report-issue')}
            disabled={!selectedPc || !isClaimedConfirmed}
            className="flex-1 py-3 px-4 rounded-lg bg-[#1b325f] hover:bg-[#142547] text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            Report a problem with this PC
          </button>
        </div>
      </main>
    </div>
  );
};
