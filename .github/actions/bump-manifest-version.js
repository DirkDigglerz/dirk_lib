const fs = require('fs');

// Read the current manifest file
const manifestFile = fs.readFileSync('fxmanifest.lua', { encoding: 'utf8' });

// Extract the current version from the manifest file
const versionMatch = manifestFile.match(/\bversion\s+'([\d.]+)'/);

if (!versionMatch) {
    console.error('No version found in fxmanifest.lua');
    process.exit(1);
}

let version = versionMatch[1];
let versionParts = version.split('.').map(Number);

// Increment the last part of the version
versionParts[versionParts.length - 1] += 1;

const newVersion = versionParts.join('.');

// Replace the old version in the manifest file content with the new version
const newFileContent = manifestFile.replace(/\bversion\s+'[\d.]+'/, `version      '${newVersion}'`);

// Write the updated content back to the file
fs.writeFileSync('fxmanifest.lua', newFileContent);

// Export the new version for GitHub Actions to use
fs.writeFileSync(process.env.GITHUB_ENV, `NEW_VERSION=${newVersion}\n`, { flag: 'a' });

console.log(`Version updated to ${newVersion}`);