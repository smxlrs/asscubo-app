const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const studentAppDir = path.join(__dirname, 'student-app');
const nodeModulesDir = path.join(studentAppDir, 'node_modules');
const packageLockFile = path.join(studentAppDir, 'package-lock.json');

console.log('Cleaning node_modules...');
if (fs.existsSync(nodeModulesDir)) {
  fs.rmSync(nodeModulesDir, { recursive: true, force: true });
  console.log('Removed node_modules.');
}

if (fs.existsSync(packageLockFile)) {
  fs.unlinkSync(packageLockFile);
  console.log('Removed package-lock.json.');
}

console.log('Running npm install...');
try {
  execSync('npm install', { cwd: studentAppDir, stdio: 'inherit' });
  console.log('npm install completed successfully.');
} catch (e) {
  console.error('npm install failed:', e);
}
