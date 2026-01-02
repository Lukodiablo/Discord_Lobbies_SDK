#!/usr/bin/env node
// Fix ClangCL to v143 in generated project files
const fs = require('fs');
const path = require('path');

const projectFiles = [
  'build/discord_social_sdk.vcxproj',
  'build/node_modules/node-addon-api/nothing.vcxproj'
];

projectFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      const before = content;
      // Replace ClangCL with v143
      content = content.replace(/<PlatformToolset>ClangCL<\/PlatformToolset>/g, '<PlatformToolset>v143</PlatformToolset>');
      if (content !== before) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${file}`);
      }
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
});
