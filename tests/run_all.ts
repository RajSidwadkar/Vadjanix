import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findTestFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findTestFiles(filePath));
        } else if (file.endsWith('.ts') && filePath !== __filename) {
            results.push(filePath);
        }
    }
    return results;
}

function run() {
    const unitDir = path.join(__dirname, 'unit');
    const integrationDir = path.join(__dirname, 'integration');
    const testFiles = [...findTestFiles(unitDir), ...findTestFiles(integrationDir)];
    
    for (const file of testFiles) {
        const result = spawnSync('npx', ['tsx', file], { stdio: 'inherit', shell: true });
        if (result.status && result.status > 0) {
            console.error('Test execution failed for: ' + file);
            process.exit(1);
        }
    }
    
    console.log('Master success: All tests executed successfully.');
    process.exit(0);
}

run();
