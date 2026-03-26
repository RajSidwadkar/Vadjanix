import { IntentPacket } from '../router/schema.js';

/**
 * Task Execution Layer for Vadjanix.
 * Uses a strict registry pattern to prevent arbitrary code execution.
 */

export type AllowedTask = 'summarize_text' | 'calculate_data';

type TaskFunction = (parameters: any) => string;

const taskRegistry: Record<AllowedTask, TaskFunction> = {
  summarize_text: (params: { text: string }) => {
    const text = params.text || "";
    return `Summary: ${text.substring(0, 20)}...`;
  },
  calculate_data: (params: { numbers: number[] }) => {
    const numbers = params.numbers || [];
    const sum = numbers.reduce((acc, curr) => acc + curr, 0);
    return `${sum}`;
  }
};

/**
 * Executes a task based on the incoming IntentPacket.
 * 
 * @param incomingPacket The packet containing the task request (action: 'call').
 * @returns An IntentPacket with the result or a refusal.
 */
export async function executeTask(incomingPacket: IntentPacket): Promise<IntentPacket> {
  const details = incomingPacket.payload.details as any;
  const task_name = details?.task_name as AllowedTask;
  const parameters = details?.parameters;

  if (!task_name || !taskRegistry[task_name]) {
    return {
      from: "vadjanix://brain/task_runner",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "refuse",
      payload: {
        message: "Task not recognized or unauthorized."
      },
      reasoning: `Task '${task_name}' is not in the allowed registry.`
    };
  }

  try {
    const taskFunction = taskRegistry[task_name];
    const result = taskFunction(parameters);

    return {
      from: "vadjanix://brain/task_runner",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "write",
      payload: {
        message: result
      },
      reasoning: `Successfully executed task: ${task_name}`
    };
  } catch (error: any) {
    return {
      from: "vadjanix://brain/task_runner",
      to: incomingPacket.reply_to || incomingPacket.from,
      action: "refuse",
      payload: {
        message: `Error executing task: ${error.message}`
      },
      reasoning: `Execution error in task: ${task_name}`
    };
  }
}
