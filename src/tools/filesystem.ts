import fs from 'fs/promises';
import path from 'path';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

// Resolve workspace directory against project root
const WORKSPACE_DIR = path.resolve(process.cwd(), 'workspace');

/**
 * Resolves a filename against WORKSPACE_DIR and ensures it's within bounds.
 */
function getSafePath(filename: string): string {
  const resolvedPath = path.resolve(WORKSPACE_DIR, filename);
  if (!resolvedPath.startsWith(WORKSPACE_DIR)) {
    throw new Error("Access Denied: Path traversal detected.");
  }
  return resolvedPath;
}

/**
 * Reads a local file from the workspace.
 */
export async function readFileLocal(filename: string): Promise<string> {
  try {
    const safePath = getSafePath(filename);
    const content = await fs.readFile(safePath, 'utf-8');
    return content;
  } catch (error: any) {
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Writes content to a local file in the workspace.
 */
export async function writeFileLocal(filename: string, content: string): Promise<string> {
  try {
    const safePath = getSafePath(filename);
    // Ensure parent directory exists if filename includes subdirectories
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, 'utf-8');
    return `Successfully wrote to ${filename}`;
  } catch (error: any) {
    return `Error writing file: ${error.message}`;
  }
}

/**
 * Gemini Function Declaration for the read_file tool.
 */
export const readFileDeclaration: FunctionDeclaration = {
  name: "read_file",
  description: "Read the contents of a file in the secure local workspace. Use this to review code, read notes, or retrieve data saved previously.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      filename: {
        type: SchemaType.STRING,
        description: "The name or relative path of the file to read (within the workspace)."
      }
    },
    required: ["filename"]
  }
};

/**
 * Gemini Function Declaration for the write_file tool.
 */
export const writeFileDeclaration: FunctionDeclaration = {
  name: "write_file",
  description: "Write content to a file in the secure local workspace. Use this to save code, logs, notes, or structured data for future use.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      filename: {
        type: SchemaType.STRING,
        description: "The name or relative path of the file to write (within the workspace)."
      },
      content: {
        type: SchemaType.STRING,
        description: "The text content to be written to the file."
      }
    },
    required: ["filename", "content"]
  }
};
