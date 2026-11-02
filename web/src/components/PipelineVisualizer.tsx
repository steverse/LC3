import React from 'react';
import { useLc3Store } from '../store/useLc3Store';
import { formatAddress, formatValue } from '../lib/format';
import { ArrowRight, Cpu, Layers, HardDrive } from 'lucide-react';

export const PipelineVisualizer: React.FC = () => {
  const { currentInstruction, pc, registers, cond, numberFormat } = useLc3Store();

  if (!currentInstruction) return null;

  const raw = currentInstruction.raw;
  const opcode = (raw >> 12) & 0xF;
  const dr = (raw >> 9) & 0x7;
  const sr1 = (raw >> 6) & 0x7;
  const modeBit = (raw >> 5) & 1;
  const sr2 = raw & 0x7;
  const imm5 = ((raw & 0x1F) << 27) >> 27; // sign-extended 5 bits

  return (
    <div className="bg-lc3-surface border border-lc3-border rounded-lg p-3 select-none flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-1.5 border-b border-lc3-border">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-lc3-accent" />
          <h2 className="text-xs font-bold text-lc3-text-muted tracking-wider uppercase">
            CPU Micro-Architecture Pipeline
          </h2>
        </div>
        <span className="text-[11px] font-mono text-lc3-accent font-semibold">
          CYCLE STAGES: FETCH ➔ DECODE ➔ EXECUTE
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* STAGE 1: FETCH */}
        <div className="p-2.5 rounded bg-lc3-surface-2 border border-lc3-border flex flex-col gap-1.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lc3-accent text-[11px] tracking-wider uppercase flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> 1. Fetch
            </span>
            <span className="text-[10px] text-lc3-text-muted font-mono">MAR / MDR</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">PC:</span>
              <span className="text-lc3-accent font-semibold">{formatAddress(pc)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">IR (Memory):</span>
              <span className="text-lc3-yellow font-semibold">{formatValue(raw, 'hex')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Binary:</span>
              <span className="text-[10px] text-lc3-text-muted">{raw.toString(2).padStart(16, '0')}</span>
            </div>
          </div>
        </div>

        {/* STAGE 2: DECODE */}
        <div className="p-2.5 rounded bg-lc3-surface-2 border border-lc3-border flex flex-col gap-1.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lc3-purple text-[11px] tracking-wider uppercase flex items-center gap-1">
              <Cpu className="w-3 h-3" /> 2. Decode
            </span>
            <span className="text-[10px] text-lc3-purple font-mono">{currentInstruction.mnemonic.split(' ')[0]}</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Opcode [15:12]:</span>
              <span className="text-lc3-purple font-bold">b{opcode.toString(2).padStart(4, '0')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Dest / Src1:</span>
              <span className="text-lc3-text font-semibold">R{dr} / R{sr1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Mode / Operand:</span>
              <span className="text-lc3-orange font-semibold">
                {modeBit === 1 ? `Imm #${imm5}` : `R${sr2}`}
              </span>
            </div>
          </div>
        </div>

        {/* STAGE 3: EXECUTE & WRITEBACK */}
        <div className="p-2.5 rounded bg-lc3-surface-2 border border-lc3-border flex flex-col gap-1.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-lc3-green text-[11px] tracking-wider uppercase flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> 3. Execute
            </span>
            <span className="text-[10px] text-lc3-green font-mono">ALU & CC</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Active Operands:</span>
              <span className="text-lc3-text truncate">
                R{sr1}={formatValue(registers[sr1] ?? 0, numberFormat)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Condition Code:</span>
              <span className="text-lc3-accent font-bold">
                {cond === 4 ? 'NEGATIVE (N)' : cond === 2 ? 'ZERO (Z)' : 'POSITIVE (P)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-lc3-text-muted">Next PC:</span>
              <span className="text-lc3-text font-semibold">{formatAddress(pc)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
