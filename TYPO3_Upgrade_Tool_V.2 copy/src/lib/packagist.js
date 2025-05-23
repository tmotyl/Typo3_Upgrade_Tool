import axios from 'axios';

/**
 * Fetches package information from Packagist API with improved search
 * @param {string} packageName - The package name or extension key to look up
 * @returns {Promise<Object|null>} Package information or null if not found
 */
export async function fetchPackagistPackageInfo(packageName) {
  try {
    // Clean up the package name
    const cleanPackageName = packageName.toLowerCase().trim();
    
    // Try to find the package directly if it already includes a vendor
    if (cleanPackageName.includes('/')) {
      try {
        const response = await axios.get(`https://packagist.org/packages/${cleanPackageName}.json`);
        if (response.data && response.data.package) {
          return response.data.package;
        }
      } catch (error) {
        // If direct lookup fails, fall back to search
        console.log(`Direct lookup failed for ${cleanPackageName}, falling back to search`);
      }
    }
    
    // Search for the package if we only have the extension key
    // Use multiple search terms to improve results
    const searchTerms = [
      `${cleanPackageName} typo3`,
      `typo3-cms-extension ${cleanPackageName}`,
      `typo3 extension ${cleanPackageName}`
    ];
    
    // Try each search term until we find a good match
    for (const searchTerm of searchTerms) {
      try {
        const searchResponse = await axios.get(`https://packagist.org/search.json?q=${encodeURIComponent(searchTerm)}`);
        
        if (searchResponse.data && searchResponse.data.results && searchResponse.data.results.length > 0) {
          // Filter results to only include TYPO3 extensions
          const typo3Results = searchResponse.data.results.filter(result => {
            const isTypo3Related = 
              (result.description && result.description.toLowerCase().includes('typo3')) ||
              (result.name && result.name.toLowerCase().includes('typo3')) ||
              (result.repository && result.repository.toLowerCase().includes('typo3'));
              
            // Also check if the extension key is part of the name (after the vendor)
            const nameParts = result.name.split('/');
            if (nameParts.length === 2) {
              const extensionPart = nameParts[1].toLowerCase();
              if (extensionPart === cleanPackageName || 
                  extensionPart === `typo3-${cleanPackageName}` ||
                  extensionPart === `typo3-cms-${cleanPackageName}`) {
                return true;
              }
            }
            
            return isTypo3Related;
          });
          
          if (typo3Results.length > 0) {
            // Look for exact matches first
            const exactMatch = typo3Results.find(result => {
              const nameParts = result.name.split('/');
              return nameParts.length === 2 && 
                    (nameParts[1].toLowerCase() === cleanPackageName ||
                     nameParts[1].toLowerCase() === `typo3-${cleanPackageName}`);
            });
            
            // Use exact match if found, otherwise use the first result
            const bestMatch = exactMatch || typo3Results[0];
            
            try {
              const detailResponse = await axios.get(`https://packagist.org/packages/${bestMatch.name}.json`);
              if (detailResponse.data && detailResponse.data.package) {
                return detailResponse.data.package;
              }
            } catch (error) {
              console.error(`Error fetching details for ${bestMatch.name}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error searching for ${searchTerm}:`, error);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching package information from Packagist:', error);
    return null;
  }
}

/**
 * Fetches popular TYPO3 extensions from Packagist
 * @param {number} limit - Number of extensions to fetch
 * @returns {Promise<Array>} List of popular TYPO3 extensions
 */
export async function fetchPopularTYPO3Extensions(limit = 50) {
  try {
    // Search for popular TYPO3 extensions
    const searchTerms = [
      'typo3 extension',
      'typo3-cms-extension',
      'typo3/cms'
    ];
    
    const allResults = [];
    
    // Fetch results for each search term
    for (const searchTerm of searchTerms) {
      try {
        const response = await axios.get(`https://packagist.org/search.json?q=${encodeURIComponent(searchTerm)}&type=typo3-cms-extension&per_page=${limit}`);
        
        if (response.data && response.data.results) {
          // Add results to our collection
          allResults.push(...response.data.results);
        }
      } catch (error) {
        console.error(`Error searching for ${searchTerm}:`, error);
      }
    }
    
    // Deduplicate by package name
    const uniqueResults = [];
    const seenPackages = new Set();
    
    for (const result of allResults) {
      if (!seenPackages.has(result.name)) {
        seenPackages.add(result.name);
        uniqueResults.push(result);
      }
    }
    
    // Sort by downloads
    const sortedResults = uniqueResults.sort((a, b) => b.downloads - a.downloads);
    
    // Limit results
    return sortedResults.slice(0, limit);
  } catch (error) {
    console.error('Error fetching popular TYPO3 extensions:', error);
    return [];
  }
} 