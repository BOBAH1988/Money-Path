import fs from 'fs';
import path from 'path';

const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const parts = pkg.version.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error('Неверный формат версии в package.json:', pkg.version);
  process.exit(1);
}

// Инкрементируем только патч (третье число). Мажор и минор меняются вручную.
parts[2] += 1;
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Синхронизируем версию в package-lock.json
const lockPath = path.resolve('package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = pkg.version;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

console.log(`Версия увеличена до ${pkg.version}`);