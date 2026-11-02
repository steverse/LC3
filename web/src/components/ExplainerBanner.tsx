import React from 'react';
import { useLc3Store } from '../store/useLc3Store';
import { HelpCircle, Terminal } from 'lucide-react';
import { formatAddress } from '../lib/format';

export const ExplainerBanner: React.FC = () => {
  const currentInstruction = useLc3Store((s) => s.currentInstruction);
  const pc = useLc3Store((s) => s.pc);

  if (!currentInstruction) return null;

  return (
    <div className="bg-lc3-surface border border-lc3-border rounded-lg p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-lc3-accent" />
          <h2 className="text-xs font-bold text-lc3-text-muted tracking-wider uppercase">
            Live Instruction Explainer
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-lc3-text-muted">
            LOC: <strong className="text-lc3-accent">{formatAddress(pc)}</strong>
          </span>
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-lc3-surface-2 border border-lc3-border text-lc3-purple font-semibold">
            {currentInstruction.mnemonic}
          </span>
        </div>
      </div>

      <div className="bg-lc3-surface-2 p-2.5 rounded border border-lc3-border flex items-start gap-2">
        <Terminal className="w-4 h-4 text-lc3-green shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed text-lc3-text font-sans">
          {currentInstruction.explanation}
        </p>
      </div>
    </div>
  );
};
