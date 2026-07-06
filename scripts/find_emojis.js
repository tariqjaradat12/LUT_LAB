const fs = require('fs');
const path = require('path');

// Regex for emojis (broad range of common emoji symbols, miscellaneous symbols, pictographs)
const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        scanDir(filePath, fileList);
      }
    } else if (/\.(tsx|ts|js|jsx)$/.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const workspaceRoot = 'c:\\Users\\green\\Desktop\\my android app';
const srcDir = path.join(workspaceRoot, 'src');
const appFile = path.join(workspaceRoot, 'App.tsx');
const indexFile = path.join(workspaceRoot, 'index.js');

const filesToScan = [];
if (fs.existsSync(srcDir)) scanDir(srcDir, filesToScan);
if (fs.existsSync(appFile)) filesToScan.push(appFile);
if (fs.existsSync(indexFile)) filesToScan.push(indexFile);

console.log(`Scanning ${filesToScan.length} files...`);

let foundCount = 0;
for (const file of filesToScan) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    let match;
    // Reset regex index
    emojiRegex.lastIndex = 0;
    while ((match = emojiRegex.exec(line)) !== null) {
      // Ignore some standard non-emoji symbols if regex matches them (e.g. standard symbols, degree symbol, etc.)
      const matchedChar = match[0];
      // We want to remove all emojis, especially colorful ones, symbols, etc. Let's print all of them.
      console.log(`${path.relative(workspaceRoot, file)}:line ${index + 1}: Found '${matchedChar}' in line: "${line.trim()}"`);
      foundCount++;
    }
  });
}

console.log(`Scan completed. Found ${foundCount} potential emojis.`);
