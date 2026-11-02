import React, { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ExecutionControls } from '../ExecutionControls';
import { RegisterDashboard } from '../RegisterDashboard';
import { MemoryInspector } from '../MemoryInspector';
import { ExplainerBanner } from '../ExplainerBanner';
import { PipelineVisualizer } from '../PipelineVisualizer';
import { Terminal } from '../Terminal';
import { CodeEditor } from '../CodeEditor';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { Code2, MonitorPlay, Layers } from 'lucide-react';

export const AppLayout: React.FC = () => {
  useKeyboardShortcuts();
  const [showEditor, setShowEditor] = useState<boolean>(true);
  const [showPipeline, setShowPipeline] = useState<boolean>(true);

  return (
    <div className="flex flex-col h-screen bg-lc3-bg text-lc3-text overflow-hidden">
      {/* Top Navbar & Execution Deck */}
      <ExecutionControls />

      {/* Secondary Bar with Explainer and Panel Toggles */}
      <div className="px-3 pt-2 flex items-center justify-between gap-3">
        <div className="flex-1">
          <ExplainerBanner />
        </div>
        <div className="flex items-center gap-2 self-stretch">
          <button
            onClick={() => setShowPipeline(!showPipeline)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition h-full ${
              showPipeline
                ? 'bg-lc3-purple/20 text-lc3-purple border-lc3-purple/40'
                : 'bg-lc3-surface-2 text-lc3-text-muted border-lc3-border hover:text-lc3-text'
            }`}
            title={showPipeline ? 'Hide CPU Micro-Architecture Pipeline' : 'Show CPU Micro-Architecture Pipeline'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showPipeline ? 'Hide Pipeline' : 'Pipeline'}</span>
          </button>

          <button
            onClick={() => setShowEditor(!showEditor)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition h-full ${
              showEditor
                ? 'bg-lc3-accent/20 text-lc3-accent border-lc3-accent/40'
                : 'bg-lc3-surface-2 text-lc3-text-muted border-lc3-border hover:text-lc3-text'
            }`}
            title={showEditor ? 'Hide Code Editor' : 'Show Code Editor'}
          >
            {showEditor ? <Code2 className="w-3.5 h-3.5" /> : <MonitorPlay className="w-3.5 h-3.5" />}
            <span>{showEditor ? 'Hide Editor' : 'Editor'}</span>
          </button>
        </div>
      </div>

      {/* Optional Pipeline Micro-Architecture Visualizer */}
      {showPipeline && (
        <div className="px-3 pt-2">
          <PipelineVisualizer />
        </div>
      )}

      {/* Main Resizable Workspace */}
      <div className="flex-1 p-3 min-h-0">
        <PanelGroup direction="horizontal" className="h-full rounded-lg">
          {/* Left Panel: Monaco Assembly Code Editor */}
          {showEditor && (
            <>
              <Panel defaultSize={42} minSize={25} id="editor-panel" order={1}>
                <CodeEditor />
              </Panel>

              {/* Horizontal Splitter */}
              <PanelResizeHandle className="w-2 mx-1 flex items-center justify-center group cursor-col-resize">
                <div className="w-1 h-8 rounded bg-lc3-border group-hover:bg-lc3-accent transition-colors" />
              </PanelResizeHandle>
            </>
          )}

          {/* Right Panel: Hardware Inspection & Terminal */}
          <Panel defaultSize={showEditor ? 58 : 100} minSize={35} id="execution-panel" order={2}>
            <PanelGroup direction="vertical">
              {/* Upper Section: Registers & Memory Inspector */}
              <Panel defaultSize={55} minSize={30} id="hardware-panel" order={1}>
                <div className="grid grid-cols-12 gap-2 h-full min-h-0">
                  {/* Register Dashboard (5 cols) */}
                  <div className="col-span-5 flex flex-col h-full min-h-0 overflow-y-auto">
                    <RegisterDashboard />
                  </div>

                  {/* Memory Inspector (7 cols) */}
                  <div className="col-span-7 flex flex-col h-full min-h-0">
                    <MemoryInspector />
                  </div>
                </div>
              </Panel>

              {/* Vertical Splitter */}
              <PanelResizeHandle className="h-2 my-1 flex items-center justify-center group cursor-row-resize">
                <div className="h-1 w-8 rounded bg-lc3-border group-hover:bg-lc3-accent transition-colors" />
              </PanelResizeHandle>

              {/* Lower Section: Interactive Terminal (xterm.js) */}
              <Panel defaultSize={45} minSize={25} id="terminal-panel" order={2}>
                <Terminal />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};
