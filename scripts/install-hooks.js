import fs from 'fs';
import path from 'path';

const hooksDir = path.resolve('.git', 'hooks');
const hookPath = path.join(hooksDir, 'pre-commit');

const hookContent = `#!/bin/sh
# Автоматическое увеличение patch-версии перед каждым коммитом
npm run bump
git add package.json package-lock.json
`;

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(hookPath, hookContent);
fs.chmodSync(hookPath, 0o755);

console.log('Pre-commit hook установлен: .git/hooks/pre-commit');