import React, { useRef } from 'react';
import { useLc3Store } from '../store/useLc3Store';
import { Play, Pause, StepForward, StepBack, RotateCcw, Cpu, Upload } from 'lucide-react';
import { ALL_PROGRAMS } from '../lib/mock-programs';
import { parseObjBinary, fetchExampleObj } from '../lib/obj-loader';
import type { NumberFormat } from '../types/lc3';

export const ExecutionControls: React.FC = () => {
  const {
    running,
    executionMode,
    clockSpeedHz,
    stepCount,
    numberFormat,
    step,
    stepBack,
    history,
    run,
    pause,
    reset,
    setClockSpeed,
    setNumberFormat,
    loadProgram,
  } = useLc3Store();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProgramSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '2048.obj' || val === 'rogue.obj') {
      try {
        const loaded = await fetchExampleObj(val);
        loadProgram(loaded.words, loaded.origin);
      } catch (err: any) {
        alert(`Failed to load ${val}: ${err.message}`);
      }
      return;
    }

    const selected = ALL_PROGRAMS.find((p) => p.name === val);
    if (selected) {
      loadProgram(selected.code, selected.origin);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const loaded = parseObjBinary(buffer);
        loadProgram(loaded.words, loaded.origin);
      } catch (err: any) {
        alert(`Error loading .obj file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <header className="h-14 bg-lc3-surface border-b border-lc3-border px-4 flex items-center justify-between gap-4 select-none">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-lc3-accent" />
          <span className="font-bold text-sm tracking-wide text-lc3-text">LC-3 VISUALIZER</span>
        </div>
        <div className="h-4 w-px bg-lc3-border" />
        <span
          className={`text-xs px-2 py-0.5 rounded font-semibold tracking-wider ${
            !running
              ? 'bg-lc3-red/20 text-lc3-red border border-lc3-red/40'
              : executionMode === 'running'
              ? 'bg-lc3-green/20 text-lc3-green border border-lc3-green/40 animate-pulse'
              : 'bg-lc3-yellow/20 text-lc3-yellow border border-lc3-yellow/40'
          }`}
        >
          {!running ? 'HALTED' : executionMode === 'running' ? 'RUNNING' : 'PAUSED'}
        </span>
        <span className="text-xs text-lc3-text-muted">Steps: {stepCount}</span>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex items-center gap-2">
        {executionMode === 'running' ? (
          <button
            onClick={pause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-lc3-yellow/20 text-lc3-yellow hover:bg-lc3-yellow/30 border border-lc3-yellow/40 text-xs font-semibold transition"
            title="Pause execution (Esc)"
          >
            <Pause className="w-3.5 h-3.5" /> Pause
          </button>
        ) : (
          <button
            onClick={run}
            disabled={!running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-lc3-green/20 text-lc3-green hover:bg-lc3-green/30 border border-lc3-green/40 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none transition"
            title="Run continuously (F5)"
          >
            <Play className="w-3.5 h-3.5" /> Run
          </button>
        )}

        <button
          onClick={stepBack}
          disabled={executionMode === 'running' || history.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-lc3-surface-2 text-lc3-text hover:bg-lc3-border border border-lc3-border text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition"
          title="Step backward 1 instruction (Undo)"
        >
          <StepBack className="w-3.5 h-3.5" /> Back
        </button>

        <button
          onClick={step}
          disabled={!running || executionMode === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-lc3-accent/20 text-lc3-accent hover:bg-lc3-accent/30 border border-lc3-accent/40 text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none transition"
          title="Execute 1 instruction (F10)"
        >
          <StepForward className="w-3.5 h-3.5" /> Step
        </button>

        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-lc3-surface-2 text-lc3-text-muted hover:text-lc3-text hover:bg-lc3-border border border-lc3-border text-xs transition"
          title="Reset CPU and reload program"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Speed Slider, Number Format, Program Selector & Upload */}
      <div className="flex items-center gap-4">
        {/* Speed Slider */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-lc3-text-muted">Speed:</span>
          <input
            type="range"
            min="1"
            max="100"
            value={clockSpeedHz}
            onChange={(e) => setClockSpeed(Number(e.target.value))}
            className="w-20 accent-lc3-accent cursor-pointer"
          />
          <span className="w-12 text-right font-mono text-lc3-accent">{clockSpeedHz} Hz</span>
        </div>

        <div className="h-4 w-px bg-lc3-border" />

        {/* Number Format */}
        <div className="flex items-center gap-1 bg-lc3-surface-2 p-0.5 rounded border border-lc3-border text-xs">
          {(['hex', 'decimal', 'unsigned', 'binary'] as NumberFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setNumberFormat(fmt)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                numberFormat === fmt
                  ? 'bg-lc3-accent text-lc3-bg font-bold'
                  : 'text-lc3-text-muted hover:text-lc3-text'
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-lc3-border" />

        {/* Demo / Binary Program Selector */}
        <select
          onChange={handleProgramSelect}
          defaultValue={ALL_PROGRAMS[0].name}
          className="bg-lc3-surface-2 text-lc3-text text-xs border border-lc3-border rounded px-2 py-1 outline-none focus:border-lc3-accent"
        >
          <optgroup label="Sample Programs">
            {ALL_PROGRAMS.map((prog) => (
              <option key={prog.name} value={prog.name}>
                {prog.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Classic Games (.obj)">
            <option value="2048.obj">2048 Game (2048.obj)</option>
            <option value="rogue.obj">Rogue RPG (rogue.obj)</option>
          </optgroup>
        </select>

        {/* Upload Custom .obj file */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".obj,.bin"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-lc3-surface-2 border border-lc3-border hover:bg-lc3-border text-xs text-lc3-text transition"
          title="Load your own .obj file"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload .obj</span>
        </button>
      </div>
    </header>
  );
};
