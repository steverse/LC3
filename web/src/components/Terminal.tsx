import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useLc3Store } from '../store/useLc3Store';
import { Terminal as TerminalIcon, Trash2, Keyboard } from 'lucide-react';

export const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputLength = useRef<number>(0);

  const terminalOutput = useLc3Store((s) => s.terminalOutput);
  const sendKey = useLc3Store((s) => s.sendKey);
  const clearTerminal = useLc3Store((s) => s.clearTerminal);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      theme: {
        background: '#080b0f',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#080b0f',
        selectionBackground: 'rgba(88, 166, 255, 0.3)',
        black: '#0d1117',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#484f58',
        brightRed: '#ff7b72',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    // Hook up keyboard input
    const dataDisposable = term.onData((data) => {
      for (const char of data) {
        sendKey(char);
      }
    });

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    // Initial write of current output
    term.write(terminalOutput);
    lastOutputLength.current = terminalOutput.length;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore resize on hidden element
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      term.dispose();
      xtermInstance.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Update terminal when output grows or resets
  useEffect(() => {
    const term = xtermInstance.current;
    if (!term) return;

    if (terminalOutput.length < lastOutputLength.current) {
      // Cleared / reset
      term.reset();
      term.write(terminalOutput);
    } else if (terminalOutput.length > lastOutputLength.current) {
      const newChars = terminalOutput.slice(lastOutputLength.current);
      term.write(newChars);
    }
    lastOutputLength.current = terminalOutput.length;
  }, [terminalOutput]);

  const handleClear = () => {
    clearTerminal();
    xtermInstance.current?.clear();
    lastOutputLength.current = 0;
  };

  return (
    <div className="bg-lc3-surface border border-lc3-border rounded-lg flex flex-col h-full overflow-hidden select-none">
      <div className="px-3 py-2 bg-lc3-surface border-b border-lc3-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-lc3-accent" />
          <h2 className="text-xs font-bold text-lc3-text-muted tracking-wider uppercase">
            Console I/O (xterm.js TRAP & MMIO)
          </h2>
          <span className="flex items-center gap-1 text-[10px] text-lc3-green bg-lc3-green/10 px-1.5 py-0.5 rounded border border-lc3-green/30">
            <Keyboard className="w-3 h-3" /> Live Keys Active
          </span>
        </div>
        <button
          onClick={handleClear}
          className="text-lc3-text-muted hover:text-lc3-text text-xs p-1 rounded hover:bg-lc3-surface-2 transition flex items-center gap-1"
          title="Clear Terminal Output"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </button>
      </div>

      <div
        ref={terminalRef}
        className="flex-1 w-full h-full p-2 bg-[#080b0f] overflow-hidden"
      />
    </div>
  );
};
