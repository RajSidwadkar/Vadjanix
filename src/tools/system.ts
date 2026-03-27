import os from 'os';
import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

/**
 * Returns formatted system status information.
 */
export async function getSystemStatus() {
  const uptime = os.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  return {
    platform: os.platform(),
    uptime: `${hours}h ${minutes}m`,
    totalMemoryGB: (os.totalmem() / (1024 ** 3)).toFixed(2),
    freeMemoryGB: (os.freemem() / (1024 ** 3)).toFixed(2),
    cpuModel: os.cpus()[0].model,
    loadAverage: os.loadavg()
  };
}

/**
 * Gemini Function Declaration for the system status tool.
 */
export const getSystemStatusDeclaration: FunctionDeclaration = {
  name: "get_system_status",
  description: "Get the current server system status including platform, uptime, and memory usage.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: []
  }
};
