import ivm from 'isolated-vm';

export interface SimulationResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  iterations: number;
}

export class GhostSandbox {
  private readonly MAX_ITERATIONS = 5;
  private readonly MEMORY_LIMIT_MB = 256;
  private readonly CPU_TIMEOUT_MS = 5000;

  async simulateAndRefine(
    code: string,
    taskDescription: string,
    llmRefineFn: (ctx: { task: string; failedCode: string; error: string; iteration: number }) => Promise<string>
  ): Promise<SimulationResult> {
    let currentCode = code;
    let lastResult: SimulationResult | null = null;

    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      lastResult = await this._runSandboxed(currentCode);
      lastResult.iterations = i + 1;

      if (lastResult.success) {
        return lastResult;
      }

      if (i < this.MAX_ITERATIONS - 1) {
        currentCode = await llmRefineFn({
          task: taskDescription,
          failedCode: currentCode,
          error: lastResult.stderr || "Unknown error",
          iteration: i + 1
        });
      }
    }

    return lastResult!;
  }

  async _runSandboxed(code: string): Promise<SimulationResult> {
    // Robustly strip dangerous imports: fs, net, child_process, os (including submodules and node: prefix)
    const dangerousRegex = /\b(node:)?(fs|net|child_process|os)(\/.*)?\b/;
    
    let sanitizedCode = code.replace(
      new RegExp(`require\\s*\\(\\s*['"]${dangerousRegex.source}['"]\\s*\\)`, 'g'), 
      '{}'
    );
    sanitizedCode = sanitizedCode.replace(
      new RegExp(`import\\s+.*?from\\s+['"]${dangerousRegex.source}['"]`, 'g'), 
      '// stripped import'
    );
    sanitizedCode = sanitizedCode.replace(
      new RegExp(`import\\s+['"]${dangerousRegex.source}['"]`, 'g'), 
      '// stripped import'
    );

    const isolate = new ivm.Isolate({ memoryLimit: this.MEMORY_LIMIT_MB });
    try {
      const context = await isolate.createContext();
      const jail = context.global;

      let stdout = '';
      
      // Basic console.log implementation
      await jail.set('log', new ivm.Reference((...args: any[]) => {
        stdout += args.map(arg => {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          try {
            return typeof arg === 'object' ? JSON.stringify(arg) : arg.toString();
          } catch {
            return '[Object]';
          }
        }).join(' ') + '\n';
      }));

      await context.evalClosure(`
        globalThis.console = {
          log: (...args) => {
            $0.applySync(undefined, args, { arguments: { copy: true } });
          },
          info: (...args) => {
            $0.applySync(undefined, args, { arguments: { copy: true } });
          },
          warn: (...args) => {
            $0.applySync(undefined, args, { arguments: { copy: true } });
          },
          error: (...args) => {
            $0.applySync(undefined, args, { arguments: { copy: true } });
          }
        };
      `, [jail.getSync('log')], { arguments: { copy: true } });

      try {
        const script = await isolate.compileScript(sanitizedCode);
        await script.run(context, { timeout: this.CPU_TIMEOUT_MS });

        return {
          success: true,
          stdout: stdout.trim(),
          stderr: '',
          exitCode: 0,
          iterations: 0
        };
      } catch (error: any) {
        let stderr = error.message || String(error);
        
        // Handle specific isolate errors
        if (stderr.includes('Script execution timed out')) {
          stderr = 'Error: CPU_TIMEOUT_MS exceeded (Infinite loop or heavy computation)';
        } else if (stderr.includes('Isolate was disposed')) {
          stderr = 'Error: Isolate was disposed (Likely memory limit exceeded or timeout)';
        }

        return {
          success: false,
          stdout: stdout.trim(),
          stderr,
          exitCode: 1,
          iterations: 0
        };
      }
    } finally {
      try {
        isolate.dispose();
      } catch {
        // Already disposed
      }
    }
  }
}
