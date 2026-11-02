import React from 'react';
import { useLc3Store } from '../store/useLc3Store';
import { formatValue, formatAddress, formatCondFlag } from '../lib/format';

export const RegisterDashboard: React.FC = () => {
  const { registers, previousRegisters, pc, cond, numberFormat } = useLc3Store();
  const flags = formatCondFlag(cond);

  return (
    <div className="bg-lc3-surface border border-lc3-border rounded-lg p-3 select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-lc3-border">
        <h2 className="text-xs font-bold text-lc3-text-muted tracking-wider uppercase">
          CPU Registers
        </h2>
        {/* Condition Flags */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-lc3-text-muted mr-1">FLAGS:</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
              flags.n
                ? 'bg-lc3-purple/30 text-lc3-purple border border-lc3-purple/60'
                : 'text-lc3-text-muted opacity-40'
            }`}
          >
            N
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
              flags.z
                ? 'bg-lc3-purple/30 text-lc3-purple border border-lc3-purple/60'
                : 'text-lc3-text-muted opacity-40'
            }`}
          >
            Z
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
              flags.p
                ? 'bg-lc3-purple/30 text-lc3-purple border border-lc3-purple/60'
                : 'text-lc3-text-muted opacity-40'
            }`}
          >
            P
          </span>
        </div>
      </div>

      {/* Program Counter */}
      <div className="mb-3 px-2 py-1.5 bg-lc3-surface-2 rounded border border-lc3-border flex items-center justify-between">
        <span className="text-xs font-semibold text-lc3-accent">PC (Program Counter)</span>
        <span className="text-sm font-mono font-bold text-lc3-accent">
          {formatAddress(pc)}
        </span>
      </div>

      {/* R0 to R7 Grid */}
      <div className="grid grid-cols-2 gap-2">
        {registers.map((val, idx) => {
          const changed = previousRegisters[idx] !== val;
          return (
            <div
              key={idx}
              className={`p-2 rounded bg-lc3-surface-2 border border-lc3-border flex flex-col transition-all duration-300 ${
                changed ? 'border-lc3-green/80 bg-lc3-green/10' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-lc3-text-muted">R{idx}</span>
                {changed && (
                  <span className="text-[10px] text-lc3-green font-semibold uppercase tracking-wider">
                    UPDATED
                  </span>
                )}
              </div>
              <div className="text-sm font-mono font-semibold text-lc3-text truncate">
                {formatValue(val, numberFormat)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
