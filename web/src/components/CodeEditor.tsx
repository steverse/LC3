import React, { useState, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { assemble, AssemblyError } from '../lib/assembler';
import { useLc3Store } from '../store/useLc3Store';
import { Code2, Play, CheckCircle2, AlertTriangle, FileCode } from 'lucide-react';

const STARTER_TEMPLATES: Record<string, string> = {
  'Hello World': `; ========================================
; Program: Hello World
; Description: Prints a message to terminal
; ========================================
.ORIG x3000
    LEA R0, MESSAGE     ; Load address of string into R0
    PUTS                ; System call: output null-terminated string
    HALT                ; Stop program execution

MESSAGE .STRINGZ "Hello from LC-3 Web Simulator!\\n"
.END
`,

  'Echo Keyboard Input': `; ========================================
; Program: Echo Input
; Description: Reads keys and echoes to console
; Type 'q' to quit
; ========================================
.ORIG x3000
LOOP
    GETC                ; Read character into R0 (no echo)
    OUT                 ; Echo character to terminal
    
    ; Check if user pressed 'q' (ASCII 113)
    LD R1, QUIT_CHAR    ; R1 = -113
    ADD R2, R0, R1      ; R2 = R0 - 113
    BRz DONE            ; If zero, quit
    BR LOOP             ; Otherwise loop

DONE
    LEA R0, BYE_MSG
    PUTS
    HALT

QUIT_CHAR .FILL #-113   ; Negative of ASCII 'q'
BYE_MSG   .STRINGZ "\\nProgram exited.\\n"
.END
`,

  'Counter (1 to 10)': `; ========================================
; Program: Counter
; Description: Counts R1 from 0 to 10
; ========================================
.ORIG x3000
    AND R1, R1, #0      ; R1 = 0 (counter)
    AND R2, R2, #0      ; R2 = 0
    ADD R2, R2, #10     ; R2 = 10 (limit)

COUNT_LOOP
    ADD R1, R1, #1      ; R1 = R1 + 1

    ; Compute R2 - R1 to check if done
    NOT R3, R1
    ADD R3, R3, #1      ; R3 = -R1
    ADD R3, R3, R2      ; R3 = 10 - R1
    BRp COUNT_LOOP      ; If 10 - R1 > 0, keep counting

    HALT
.END
`,

  'Multiply (R1 * R2)': `; ========================================
; Program: Multiply
; Description: Multiplies R1 (6) by R2 (7) -> R0 (42)
; ========================================
.ORIG x3000
    AND R0, R0, #0      ; R0 = result (0)
    AND R1, R1, #0
    ADD R1, R1, #6      ; Multiplicand = 6
    AND R2, R2, #0
    ADD R2, R2, #7      ; Multiplier = 7

MULT_LOOP
    BRz DONE            ; When multiplier reaches 0, stop
    ADD R0, R0, R1      ; Result += Multiplicand
    ADD R2, R2, #-1     ; Multiplier -= 1
    BR MULT_LOOP

DONE
    HALT
.END
`,
};

export const CodeEditor: React.FC = () => {
  const [code, setCode] = useState<string>(STARTER_TEMPLATES['Hello World']);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Hello World');
  const [assemblyStatus, setAssemblyStatus] = useState<{
    success?: boolean;
    message?: string;
    errors?: AssemblyError[];
  }>({});

  const monacoRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const loadProgram = useLc3Store((s) => s.loadProgram);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define LC-3 language syntax
    monaco.languages.register({ id: 'lc3' });
    monaco.languages.setMonarchTokensProvider('lc3', {
      ignoreCase: true,
      tokenizer: {
        root: [
          // Comments
          [/;.*$/, 'comment'],

          // Directives
          [/\.(ORIG|END|FILL|BLKW|STRINGZ)\b/i, 'keyword.directive'],

          // Opcodes
          [/\b(ADD|AND|NOT|BR|BRN|BRZ|BRP|BRNZ|BRZP|BRNP|BRNZP|JMP|RET|JSR|JSRR|LD|LDI|LDR|LEA|ST|STI|STR|TRAP|RTI)\b/i, 'keyword.opcode'],

          // Traps
          [/\b(GETC|OUT|PUTS|IN|PUTSP|HALT)\b/i, 'keyword.trap'],

          // Registers
          [/\bR[0-7]\b/i, 'variable.register'],

          // Hex numbers
          [/x[0-9a-fA-F]+/i, 'number.hex'],

          // Decimal immediates
          [/#[+-]?\d+/, 'number.decimal'],

          // Plain numbers
          [/[+-]?\d+/, 'number.decimal'],

          // Strings
          [/"([^"\\]|\\.)*"/, 'string'],
        ],
      },
    });

    // Custom theme matching the IDE
    monaco.editor.defineTheme('lc3Dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
        { token: 'keyword.directive', foreground: '58a6ff', fontStyle: 'bold' },
        { token: 'keyword.opcode', foreground: 'bc8cff', fontStyle: 'bold' },
        { token: 'keyword.trap', foreground: 'f85149', fontStyle: 'bold' },
        { token: 'variable.register', foreground: '79c0ff' },
        { token: 'number.hex', foreground: 'd29922' },
        { token: 'number.decimal', foreground: 'd29922' },
        { token: 'string', foreground: '3fb950' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editorCursor.foreground': '#58a6ff',
        'editor.selectionBackground': '#1f6feb40',
      },
    });

    monaco.editor.setTheme('lc3Dark');
  };

  const handleAssemble = () => {
    const result = assemble(code);

    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // Set red markers for any error lines
        const markers = result.errors.map((err) => ({
          startLineNumber: err.line,
          startColumn: 1,
          endLineNumber: err.line,
          endColumn: 100,
          message: err.message,
          severity: monacoRef.current.MarkerSeverity.Error,
        }));
        monacoRef.current.editor.setModelMarkers(model, 'lc3', markers);
      }
    }

    if (result.success) {
      loadProgram(result.words, result.origin);
      setAssemblyStatus({
        success: true,
        message: `Assembled ${result.words.length} words into origin x${result.origin.toString(16).toUpperCase()}!`,
      });
    } else {
      setAssemblyStatus({
        success: false,
        message: `Assembly failed with ${result.errors.length} error(s).`,
        errors: result.errors,
      });
    }
  };

  const handleSelectTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedTemplate(name);
    if (STARTER_TEMPLATES[name]) {
      setCode(STARTER_TEMPLATES[name]);
      setAssemblyStatus({});
      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel();
        if (model) monacoRef.current.editor.setModelMarkers(model, 'lc3', []);
      }
    }
  };

  return (
    <div className="bg-lc3-surface border border-lc3-border rounded-lg flex flex-col h-full overflow-hidden select-none">
      {/* Editor Header */}
      <div className="px-3 py-2 bg-lc3-surface border-b border-lc3-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-lc3-accent" />
          <h2 className="text-xs font-bold text-lc3-text-muted tracking-wider uppercase">
            LC-3 Assembly Editor
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Template dropdown */}
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-lc3-text-muted" />
            <select
              value={selectedTemplate}
              onChange={handleSelectTemplate}
              className="bg-lc3-surface-2 text-lc3-text text-xs border border-lc3-border rounded px-2 py-1 outline-none focus:border-lc3-accent"
            >
              {Object.keys(STARTER_TEMPLATES).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          {/* Assemble Button */}
          <button
            onClick={handleAssemble}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-lc3-accent text-lc3-bg hover:bg-lc3-accent-hover text-xs font-bold transition shadow-sm"
            title="Assemble source and load directly into VM memory"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Assemble & Load
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full min-h-0 bg-[#0d1117]">
        <Editor
          height="100%"
          language="lc3"
          value={code}
          onChange={(val) => setCode(val || '')}
          onMount={handleEditorMount}
          options={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: 13,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            renderWhitespace: 'selection',
          }}
        />
      </div>

      {/* Status / Errors Footer */}
      {assemblyStatus.message && (
        <div
          className={`px-3 py-1.5 text-xs border-t flex items-center justify-between ${
            assemblyStatus.success
              ? 'bg-lc3-green/10 border-lc3-green/30 text-lc3-green'
              : 'bg-lc3-red/10 border-lc3-red/30 text-lc3-red'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {assemblyStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">{assemblyStatus.message}</span>
          </div>

          {assemblyStatus.errors && assemblyStatus.errors.length > 0 && (
            <span className="text-[11px] opacity-80">
              Line {assemblyStatus.errors[0].line}: {assemblyStatus.errors[0].message}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
