import { useEffect } from 'react';
import { useLc3Store } from '../store/useLc3Store';

export const useKeyboardShortcuts = () => {
  const { step, stepBack, run, pause, reset, executionMode, running, pc, toggleBreakpoint } = useLc3Store();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'F10') {
        e.preventDefault();
        if (e.shiftKey) {
          stepBack();
        } else if (running && executionMode !== 'running') {
          step();
        }
      } else if (e.key === 'F11') {
        e.preventDefault();
        stepBack();
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (running) {
          if (executionMode === 'running') {
            pause();
          } else {
            run();
          }
        }
      } else if (e.key === 'Escape') {
        if (executionMode === 'running') {
          e.preventDefault();
          pause();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        toggleBreakpoint(pc);
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, run, pause, reset, executionMode, running, pc, toggleBreakpoint]);
};
