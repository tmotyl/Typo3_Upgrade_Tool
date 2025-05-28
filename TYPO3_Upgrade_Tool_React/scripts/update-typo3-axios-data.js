#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchTYPO3VersionsWithAxios } from '../src/lib/typo3-axios-scraper.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the JSON file
const DATA_FILE_PATH = path.join(__dirname, '../src/data/typo3-upgrade-data.json');

/**
 * Main function to update TYPO3 version data
 */
async function updateTYPO3VersionData() {
  try {
    console.log('Fetching TYPO3 version data using Axios...');
    
    // Fetch data using the Axios scraper
    const typo3VersionData = await fetchTYPO3VersionsWithAxios();
    
    console.log(`Retrieved ${typo3VersionData.length} TYPO3 versions`);
    
    // Make sure the directory exists
    const directory = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Write to the file
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(typo3VersionData, null, 2));
    console.log(`TYPO3 version data saved to ${DATA_FILE_PATH}`);
    
    return typo3VersionData;
  } catch (error) {
    console.error('Error updating TYPO3 version data:', error.message);
    process.exit(1);
  }
}

// Run the script
updateTYPO3VersionData(); 