import fs from 'node:fs';
import path from 'node:path';

export class GoalTracker {
  private readonly goalsPath = path.join(process.cwd(), 'GOALS.md');

  constructor() {
    if (!fs.existsSync(this.goalsPath)) {
      fs.writeFileSync(this.goalsPath, '# Vadjanix Goals\n\n- [ ] Initialize System\n');
    }
  }

  public getPendingGoals(): string[] {
    const content = fs.readFileSync(this.goalsPath, 'utf-8');
    const lines = content.split('\n');
    const pending: string[] = [];
    const regex = /^- \[ \] (.+)$/;

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        pending.push(match[1].trim());
      }
    }
    return pending;
  }

  public markGoalComplete(goalText: string): void {
    const content = fs.readFileSync(this.goalsPath, 'utf-8');
    const escapedGoal = goalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^- \\[ \\] ${escapedGoal}`, 'm');
    const newContent = content.replace(regex, `- [x] ${goalText}`);
    fs.writeFileSync(this.goalsPath, newContent, 'utf-8');
  }
}
