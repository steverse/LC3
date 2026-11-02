import React, { useState, useEffect } from 'react';
import { useLc3Store } from '../store/useLc3Store';
import { formatAddress, formatValue } from '../lib/format';
import { disassemble } from '../lib/disassembler';
import { Circle, ChevronUp, ChevronDown, Crosshair } from 'lucide-react';

export const MemoryInspector: React.FC = () => {
  const { memory, pc, breakpoints, toggleBreakpoint, numberFormat } = useLc3Store();
  const [viewCenter, setViewCenter] = useState<number>(0x3000);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [jumpInput, setJumpInput] = useState<string>('3000');

  const WINDOW_SIZE = 40; // 40 visible rows

  useEffect(() => {
    if (autoFollow) {
      setViewCenter(pc);
    }
  }, [pc, autoFollow]);

  const startAddr = Math.max(0, Math.min(0xFFFF - WINDOW_SIZE, viewCenter - Math.floor(WINDOW_SIZE / 2)));
  const visibleAddresses = Array.from({ length: WINDOW_SIZE }, (_, i) => (startAddr + i) & 0xFFFF);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpInput.replace(/^x/i, ''), 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFF) {
      setViewCenter(parsed);
      setAutoFollow(false);
    }
  };

  return (
    <div className="bg-lc3-surface border border-lc3-border rounded-lg flex flex-col h-full overflow-hidden select-none">
      {/* Header & Controls */}
      <div className="px-3 py-2 bg-lc3-surface border-b border-lc3-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-lc3-text-muted tracking-wider uppercase">
            Memory Inspector
          </h2>
          <button
            onClick={() => {
              setAutoFollow(!autoFollow);
              if (!autoFollow) setViewCenter(pc);
            }}
            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition ${
              autoFollow
                ? 'bg-lc3-accent/20 text-lc3-accent border-lc3-accent/40 font-semibold'
                : 'text-lc3-text-muted border-lc3-border hover:text-lc3-text'
            }`}
            title="Auto-scroll to current PC"
          >
            <Crosshair className="w-3 h-3" /> Auto-Follow PC
          </button>
        </div>

        {/* Jump to Address Form */}
        <form onSubmit={handleJump} className="flex items-center gap-1">
          <span className="text-xs text-lc3-text-muted font-mono">Go to: x</span>
          <input
            type="text"
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            className="w-14 bg-lc3-surface-2 text-xs font-mono px-1.5 py-0.5 rounded border border-lc3-border text-lc3-text outline-none focus:border-lc3-accent"
            placeholder="3000"
          />
        </form>

        {/* Scroll Steppers */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setViewCenter((prev) => Math.max(0, prev - 20));
              setAutoFollow(false);
            }}
            className="p-1 rounded bg-lc3-surface-2 border border-lc3-border text-lc3-text-muted hover:text-lc3-text"
            title="Page Up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setViewCenter((prev) => Math.min(0xFFFF, prev + 20));
              setAutoFollow(false);
            }}
            className="p-1 rounded bg-lc3-surface-2 border border-lc3-border text-lc3-text-muted hover:text-lc3-text"
            title="Page Down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Memory Rows Table */}
      <div className="flex-1 overflow-y-auto font-mono text-xs divide-y divide-lc3-border/40 bg-lc3-surface-2/40">
        <div className="sticky top-0 bg-lc3-surface border-b border-lc3-border px-3 py-1 flex items-center text-[11px] font-bold text-lc3-text-muted z-10">
          <span className="w-8 text-center">BP</span>
          <span className="w-16">ADDR</span>
          <span className="w-20">RAW</span>
          <span className="flex-1">DISASSEMBLY</span>
        </div>

        {visibleAddresses.map((addr) => {
          const isPc = addr === pc;
          const isBp = breakpoints.has(addr) && breakpoints.get(addr)?.enabled;
          const val = memory[addr];
          const mnemonic = disassemble(val, addr);

          return (
            <div
              key={addr}
              className={`px-3 py-1 flex items-center transition-colors ${
                isPc
                  ? 'bg-lc3-accent/20 border-l-2 border-lc3-accent text-lc3-text font-bold'
                  : 'hover:bg-lc3-surface/60 text-lc3-text-muted'
              }`}
            >
              {/* Breakpoint toggle */}
              <button
                onClick={() => toggleBreakpoint(addr)}
                className="w-8 flex items-center justify-center cursor-pointer group"
                title={`Toggle breakpoint at ${formatAddress(addr)}`}
              >
                {isBp ? (
                  <Circle className="w-2.5 h-2.5 fill-lc3-red text-lc3-red animate-pulse" />
                ) : (
                  <Circle className="w-2 h-2 text-lc3-border group-hover:text-lc3-text-muted/60 transition" />
                )}
              </button>

              {/* Address */}
              <span className={`w-16 ${isPc ? 'text-lc3-accent' : 'text-lc3-text-muted'}`}>
                {formatAddress(addr)}
              </span>

              {/* Raw Value */}
              <span className="w-20 font-mono text-lc3-text">
                {formatValue(val, numberFormat)}
              </span>

              {/* Disassembly */}
              <span className={`flex-1 truncate font-mono ${isPc ? 'text-lc3-purple' : 'text-lc3-text'}`}>
                {mnemonic}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
