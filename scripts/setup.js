
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// List of large folders/files to remove that are not needed for the React App
const itemsToRemove = [
  'X12.NET-master',
  'EDIFACT.NET-master',
  'HL7.NET',
  'NCPDP.NET',
  'SCRIPT.NET',
  'VDA.NET',
  'FlatFile.NET',
  'EdiFabric.Sdk',
  'NET 6',
  'NET Framework 4.8',
  'packages',
  'Files',
  '.vs',
  '_config.yml',
  'README.txt' // Often duplicated in the .NET folders
];

console.log("--- STARTING PROJECT CLEANUP ---");
console.log("Removing unused C#/.NET library artifacts to reduce project size...");

let deletedCount = 0;

itemsToRemove.forEach(item => {
  const itemPath = path.join(rootDir, item);
  if (fs.existsSync(itemPath)) {
    try {
      fs.rmSync(itemPath, { recursive: true, force: true });
      console.log(`✅ Deleted: ${item}`);
      deletedCount++;
    } catch (e) {
      console.error(`❌ Failed to delete ${item}: ${e.message}`);
    }
  }
});

console.log(`--- CLEANUP COMPLETE ---`);
console.log(`Removed ${deletedCount} items.`);
console.log("The project size should now be optimized for web deployment.");
