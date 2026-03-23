import fs from 'fs/promises';
import path from 'path';

export async function handleFile(uri: string, action: string, payload: Record<string, any>) {
  console.log(`[FILE HANDLER] Executing '${action}' on ${uri}`);

  // 1. Strip the prefix to get the relative path
  const relativePath = uri.replace('file://', '');
  
  // 2. Resolve the absolute path safely from your project root
  const absolutePath = path.resolve(process.cwd(), relativePath);

  // Security Check: Prevent directory traversal attacks (e.g., file://../../etc/passwd)
  if (!absolutePath.startsWith(process.cwd())) {
    throw new Error("[SECURITY ALERT] Agent attempted to access files outside the Vadjanix root.");
  }

  try {
    // 3. Handle 'read' intent
    if (action === 'read') {
      const content = await fs.readFile(absolutePath, 'utf-8');
      return { status: 'success', data: content };
    }

    // 4. Handle 'write' intent (Great for appending to Contextus logs)
    if (action === 'write') {
      const contentToWrite = typeof payload.content === 'string' 
        ? payload.content 
        : JSON.stringify(payload, null, 2);
        
      await fs.writeFile(absolutePath, contentToWrite, 'utf-8');
      return { status: 'success', message: `Successfully wrote to ${relativePath}` };
    }

    throw new Error(`[FILE HANDLER] Unsupported action: '${action}'`);

  } catch (error: any) {
    throw new Error(`[FILE HANDLER] Operation failed: ${error.message}`);
  }
}