import axios from 'axios';

/**
 * Fetches TYPO3 version information from the official TYPO3 API
 * @returns {Promise<Array>} Array of TYPO3 version information
 */
export async function fetchTYPO3VersionsWithAxios() {
  try {
    // Use official TYPO3 API to get version information
    const response = await axios.get('https://get.typo3.org/json');
    
    // Process and format the data
    const formattedData = [];
    
    // Iterate through each major version
    for (const majorVersion in response.data) {
      if (Object.prototype.hasOwnProperty.call(response.data, majorVersion)) {
        const versionData = response.data[majorVersion];
        
        // Get all releases for this major version (not just the latest)
        const releases = versionData.releases || {};
        
        // Process each release individually
        for (const releaseVersion in releases) {
          // Skip alpha/beta/dev versions unless explicitly requested
          if (releaseVersion.includes('alpha') || releaseVersion.includes('beta')) {
            continue;
          }
          
          const releaseInfo = releases[releaseVersion];
          
          // Determine version type (LTS, STS, Regular, DEV)
          let versionType = "regular";
          
          if (releaseInfo.lts) {
            versionType = "lts";
          } else if (releaseInfo.maintainance) {
            versionType = "sts";
          } else if (releaseVersion.includes('dev')) {
            versionType = "dev";
          } else {
            // Determine type based on version pattern
            const minorVersion = parseInt(releaseVersion.split('.')[1], 10);
            
            // LTS versions typically have specific minor version numbers
            if (minorVersion === 4 || minorVersion === 5) {
              versionType = "lts";
            }
          }
          
          // Create formatted version data with better defaults for missing values
          const formattedVersion = {
            version: releaseVersion,
            type: versionType,
            release_date: releaseInfo.date || new Date().toISOString().split('T')[0],
            support: {
              active_until: releaseInfo.maintained_until || calculateSupportDate(releaseVersion, 'active'),
              security_until: releaseInfo.elts_until || releaseInfo.maintained_until || calculateSupportDate(releaseVersion, 'security')
            },
            requirements: {
              php: releaseInfo.php_versions || releaseInfo.php_constraints || determinePHPVersion(releaseVersion),
              mysql: formatDatabaseRequirements(releaseInfo.mysql_constraints, releaseInfo.mariadb_constraints),
              composer: formatComposerRequirements(releaseInfo.composer_constraints)
            },
            db_changes: isMajorOrMinorRelease(releaseVersion),
            install_tool_migrations: isMajorRelease(releaseVersion)
          };
          
          formattedData.push(formattedVersion);
        }
      }
    }
    
    // Sort versions in descending order
    const sortedData = formattedData.sort((a, b) => {
      return compareVersions(b.version, a.version);
    });
    
    // Select only the latest patch version for each minor version
    const latestVersions = getLatestPatchVersions(sortedData);
    
    // If we have data but it's incomplete, supplement with local data
    if (latestVersions.length > 0) {
      const localData = await fetchLocalData();
      return mergeVersionData(latestVersions, localData);
    }
    
    return latestVersions;
    
  } catch (error) {
    console.error('Error fetching TYPO3 version information:', error);
    // Fall back to local data in case of API failure
    return fetchLocalData();
  }
}

/**
 * Filters the versions to keep only the latest patch version for each minor version
 * @param {Array} versions - All version data
 * @returns {Array} - Filtered list with only the latest patch versions
 */
function getLatestPatchVersions(versions) {
  const latestVersions = {};
  
  versions.forEach(version => {
    const versionParts = version.version.split('.');
    // Handle both "major.minor" and "major.minor.patch" formats
    const majorMinor = versionParts.length > 1 ? `${versionParts[0]}.${versionParts[1]}` : version.version;
    
    // Skip dev versions in latest patch determination
    if (version.version.includes('dev')) {
      // For dev versions, just add them directly
      const key = `${majorMinor}-dev`;
      if (!latestVersions[key]) {
        latestVersions[key] = version;
      }
      return;
    }
    
    // For regular/lts/sts versions, keep the highest patch level
    if (!latestVersions[majorMinor] || 
        compareVersions(version.version, latestVersions[majorMinor].version) > 0) {
      latestVersions[majorMinor] = version;
    }
  });
  
  // Get values from object
  return Object.values(latestVersions);
}

/**
 * Merge remote and local data, preferring remote data but filling in gaps
 * @param {Array} remoteData - Data from the API
 * @param {Array} localData - Local data from JSON file
 * @returns {Array} - Merged data
 */
async function mergeVersionData(remoteData, localData) {
  // Create a map of local versions for quick lookup
  const localVersionMap = {};
  localData.forEach(version => {
    localVersionMap[version.version] = version;
  });
  
  // Process each remote version and supplement with local data if needed
  const mergedData = remoteData.map(remoteVersion => {
    const localVersion = localVersionMap[remoteVersion.version];
    
    // If we don't have local data for this version, return remote data
    if (!localVersion) return remoteVersion;
    
    // Merge data, preferring remote data but using local data for missing fields
    return {
      ...remoteVersion,
      // Ensure type is consistent
      type: remoteVersion.type || localVersion.type,
      // Use local release date if remote is missing
      release_date: remoteVersion.release_date || localVersion.release_date,
      // Merge support data
      support: {
        active_until: remoteVersion.support.active_until !== "Unknown" ? 
          remoteVersion.support.active_until : localVersion.support.active_until,
        security_until: remoteVersion.support.security_until !== "Unknown" ? 
          remoteVersion.support.security_until : localVersion.support.security_until
      },
      // Merge requirements data
      requirements: {
        php: remoteVersion.requirements.php !== "Unknown" ? 
          remoteVersion.requirements.php : localVersion.requirements.php,
        mysql: remoteVersion.requirements.mysql || localVersion.requirements.mysql,
        composer: remoteVersion.requirements.composer || localVersion.requirements.composer
      }
    };
  });
  
  // Add specific versions we want to ensure are present
  const requiredVersionTypes = [
    { majorVersion: "13", minorVersion: "4", type: "lts" },
    { majorVersion: "12", minorVersion: "4", type: "lts" },
    { majorVersion: "11", minorVersion: "5", type: "lts" },
    { majorVersion: "13", minorVersion: "3", type: "sts" },
    { majorVersion: "13", minorVersion: "0", type: "dev" }
  ];
  
  // Add these specific versions from local data if they exist
  requiredVersionTypes.forEach(req => {
    const versionKey = `${req.majorVersion}.${req.minorVersion}`;
    const exists = mergedData.some(v => v.version.startsWith(versionKey));
    
    if (!exists) {
      // Look for a matching version in local data
      const localVersion = localData.find(v => 
        v.version.startsWith(versionKey) && 
        (v.type === req.type || !req.type)
      );
      
      if (localVersion) {
        mergedData.push(localVersion);
      } else {
        // Create synthetic data if we don't have it
        mergedData.push(createSyntheticVersion(req.majorVersion, req.minorVersion, req.type));
      }
    }
  });
  
  // Ensure we have at least one of each type
  const types = ["lts", "sts", "regular", "dev"];
  types.forEach(type => {
    const hasType = mergedData.some(v => v.type === type);
    if (!hasType) {
      // Add a synthetic version of this type
      let syntheticVersion;
      switch (type) {
        case "lts":
          syntheticVersion = createSyntheticVersion("13", "4", "lts");
          break;
        case "sts":
          syntheticVersion = createSyntheticVersion("13", "3", "sts");
          break;
        case "dev":
          syntheticVersion = createSyntheticVersion("13", "0", "dev");
          break;
        default:
          syntheticVersion = createSyntheticVersion("13", "2", "regular");
          break;
      }
      mergedData.push(syntheticVersion);
    }
  });
  
  // Sort all versions
  return mergedData.sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Creates a synthetic version when we don't have real data
 * @param {string} major - Major version number
 * @param {string} minor - Minor version number
 * @param {string} type - Version type
 * @returns {Object} - Synthetic version object
 */
function createSyntheticVersion(major, minor, type = "regular") {
  const version = `${major}.${minor}`;
  const now = new Date();
  const year = now.getFullYear();
  
  return {
    version: version,
    type: type,
    release_date: `${year}-01-01`,
    support: {
      active_until: calculateSupportDate(version, 'active'),
      security_until: calculateSupportDate(version, 'security')
    },
    requirements: {
      php: determinePHPVersion(version),
      mysql: type === "lts" ? "10.3+ / MySQL 8.0+" : "5.5+ / MySQL 5.5+",
      composer: type === "lts" || type === "sts" ? "2.0+" : "1.5+"
    },
    db_changes: minor === "0",
    install_tool_migrations: minor === "0"
  };
}

/**
 * Calculate a support date based on the release version and type
 * @param {string} version - TYPO3 version
 * @param {string} type - 'active' or 'security'
 * @returns {string} - Estimated support end date
 */
function calculateSupportDate(version, type) {
  try {
    // Extract major.minor from version string
    const versionMatch = version.match(/^(\d+)\.(\d+)/);
    if (!versionMatch) return "Unknown";
    
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    
    // Parse release date from version or use current year if not available
    const releaseYear = new Date().getFullYear();
    
    // LTS typically gets 3 years active + 1 year security
    // Regular releases get shorter support
    let activeYears = 1;
    let securityYears = 0.5;
    
    // If it's an LTS version (*.4 or *.5 depending on TYPO3 version)
    if (minor === 4 || minor === 5 || (major >= 12 && minor === 4)) {
      activeYears = 1.5;
      securityYears = 1;
    }
    
    // Calculate date
    const date = new Date(releaseYear, 0); // January 1st of release year
    if (type === 'active') {
      date.setFullYear(date.getFullYear() + activeYears);
    } else { // security
      date.setFullYear(date.getFullYear() + activeYears + securityYears);
    }
    
    // Format as YYYY-MM-DD
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  } catch (error) {
    return "Unknown";
  }
}

/**
 * Determine PHP version based on TYPO3 version
 * @param {string} version - TYPO3 version
 * @returns {string} - PHP version requirements
 */
function determinePHPVersion(version) {
  try {
    const majorVersion = parseInt(version.split('.')[0], 10);
    
    // Map TYPO3 major versions to PHP requirements
    switch (majorVersion) {
      case 13:
        return "8.2 - 8.4";
      case 12:
        return "8.1 - 8.3";
      case 11:
        return "7.4 - 8.1";
      case 10:
        return "7.2 - 7.4";
      case 9:
        return "7.2 - 7.3";
      case 8:
        return "7.0 - 7.2";
      case 7:
        return "5.5 - 7.0";
      default:
        if (majorVersion > 13) {
          return "8.3+"; // Future versions
        }
        return "7.0+"; // Older versions
    }
  } catch (error) {
    return "PHP requirements unknown";
  }
}

/**
 * Finds the latest release version from a list of releases
 * @param {Object} releases - Object containing release information
 * @returns {string|null} The latest release version or null if none found
 */
function findLatestRelease(releases) {
  let latestVersion = null;
  
  for (const version in releases) {
    if (!latestVersion || compareVersions(version, latestVersion) > 0) {
      // Skip development versions
      if (!version.includes('dev')) {
        latestVersion = version;
      }
    }
  }
  
  return latestVersion;
}

/**
 * Compares two version strings
 * @param {string} versionA - First version string
 * @param {string} versionB - Second version string
 * @returns {number} Comparison result: 1 if A > B, -1 if A < B, 0 if equal
 */
function compareVersions(versionA, versionB) {
  const partsA = versionA.split('.').map(Number);
  const partsB = versionB.split('.').map(Number);
  
  // Compare major version
  if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
  
  // Compare minor version
  if (partsA[1] !== partsB[1]) return partsA[1] - partsB[1];
  
  // Compare patch version if available
  if (partsA.length > 2 && partsB.length > 2) return partsA[2] - partsB[2];
  
  return 0;
}

/**
 * Formats database requirements into a user-friendly string
 * @param {string} mysqlConstraint - MySQL constraint string
 * @param {string} mariadbConstraint - MariaDB constraint string
 * @returns {string} Formatted database requirements
 */
function formatDatabaseRequirements(mysqlConstraint, mariadbConstraint) {
  const requirements = [];
  
  if (mariadbConstraint) {
    const match = mariadbConstraint.match(/>=(\d+\.\d+)/);
    if (match) {
      requirements.push(`${match[1]}+`);
    }
  }
  
  if (mysqlConstraint) {
    const match = mysqlConstraint.match(/>=(\d+\.\d+)/);
    if (match) {
      requirements.push(`MySQL ${match[1]}+`);
    }
  }
  
  return requirements.length > 0 ? requirements.join(' / ') : "5.5+ / MySQL 5.5+";
}

/**
 * Formats composer requirements into a user-friendly string
 * @param {string} composerConstraint - Composer constraint string
 * @returns {string} Formatted composer requirements
 */
function formatComposerRequirements(composerConstraint) {
  if (!composerConstraint) return "1.5+";
  
  const match = composerConstraint.match(/>=(\d+\.\d+)/);
  return match ? `${match[1]}+` : "1.5+";
}

/**
 * Determines if a version is a major or minor release (likely needs DB changes)
 * @param {string} version - Version string
 * @returns {boolean} Whether DB changes are likely needed
 */
function isMajorOrMinorRelease(version) {
  const parts = version.split('.');
  return parts.length > 2 && parts[2] === '0';
}

/**
 * Determines if a version is a major release (likely needs install tool migrations)
 * @param {string} version - Version string
 * @returns {boolean} Whether install tool migrations are likely needed
 */
function isMajorRelease(version) {
  const parts = version.split('.');
  return parts.length > 1 && parts[1] === '0';
}

/**
 * Fetches local TYPO3 version data as a fallback
 * @returns {Promise<Array>} Array of TYPO3 version data from local file
 */
async function fetchLocalData() {
  try {
    // Import the JSON data directly
    const localData = await import('../data/typo3-upgrade-data.json', {
      assert: { type: 'json' }
    });
    return localData.default;
  } catch (error) {
    console.error('Error loading local TYPO3 data:', error);
    return [];
  }
}

/**
 * Builds a list of known TYPO3 extension mappings
 * @returns {Object} Mapping of extension keys to package names
 */
export function getExtensionMappings() {
  return {
    // Core team extensions
    'headless': 'friendsoftypo3/headless',
    'news': 'georgringer/news',
    'gridelements': 'gridelementsteam/gridelements',
    'mask': 'mask/mask',
    'base_distribution': 'typo3/cms-base-distribution',
    'form_framework': 'typo3/cms-form',
    // Common community extensions
    'solr': 'apache-solr-for-typo3/solr',
    'powermail': 'in2code/powermail',
    'rx_shariff': 'reelworx/rx-shariff',
    'container': 'b13/container',
    'felogin': 'typo3/cms-felogin',
    'redirects': 'typo3/cms-redirects',
    'seo': 'typo3/cms-seo',
    'fluid_styled_content': 'typo3/cms-fluid-styled-content',
    'scheduler': 'typo3/cms-scheduler',
    'tt_address': 'friendsoftypo3/tt-address',
    'image_manipulation': 'typo3/cms-image-manipulation',
    'google_sitemap': 'dmitryd/typo3-realurl-google-sitemap',
    'realurl': 'dmitryd/typo3-realurl',
    'bootstrap_package': 'bk2k/bootstrap-package',
    'site_language_redirection': 'sitegeist/site-language-redirection',
    'backend_theme': 'typo3/cms-backend',
    'blog': 'typo3/cms-blog',
    // Add more mappings as needed
  };
}

// Create a cache for Packagist package mappings to avoid repeated API calls
const packageCache = new Map();

/**
 * Generates an upgrade command for TYPO3, including extensions from the project
 * @param {string} targetVersion - Target TYPO3 version
 * @param {Array} extensions - List of extensions from the project
 * @returns {string} Composer command for upgrading
 */
export function generateUpgradeCommand(targetVersion, extensions = []) {
  // Ensure proper quoting of the version constraint ONLY for the core package
  const quotedCoreVersion = `"^${targetVersion.replace(/^\^/, '')}"`;
  
  let command = `composer require typo3/cms-core:${quotedCoreVersion}`;
  
  // Add extensions if available
  if (extensions && extensions.length > 0) {
    const composerExtensions = extensions.filter(ext => {
      const extName = ext.name || ext.package_name || ext.key;
      return extName && extName !== 'typo3/cms-core';
    });
    
    if (composerExtensions.length > 0) {
      // Get the known extension mappings
      const extensionMappings = getExtensionMappings();
      
      // Add each extension to the composer command WITHOUT version constraints
      composerExtensions.forEach(ext => {
        // Try to get a proper package name
        let packageName = ext.name || ext.package_name || ext.key;
        
        // Skip typo3/cms-core which is already included
        if (packageName === 'typo3/cms-core') return;
        
        // For extensions without a slash in the name, use known vendor mappings
        if (packageName && !packageName.includes('/')) {
          // Check if we have a mapping for this extension
          const extensionKey = packageName.toLowerCase().replace(/_/g, '-').replace(/\./g, '-');
          if (extensionMappings[extensionKey]) {
            packageName = extensionMappings[extensionKey];
          } else if (extensionKey === 'base-distribution') {
            // Special case for base-distribution
            packageName = 'typo3/cms-base-distribution';
          } else {
            // For unknown extensions, use a better fallback format
            
            // Common vendor prefixes based on naming patterns
            if (extensionKey.startsWith('t3') || extensionKey.startsWith('typo3')) {
              packageName = `typo3/${extensionKey}`;
            } else if (ext.author && typeof ext.author === 'string') {
              // If author info is available, use it as vendor
              const authorName = ext.author.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
              
              packageName = `${authorName}/${extensionKey}`;
            } else {
              // Default fallback using common community namespacing
              packageName = `friendsoftypo3/${extensionKey}`;
            }
          }
        }
        
        if (packageName) {
          // Add the extension to the command WITHOUT version constraint
          command += ` ${packageName}`;
        }
      });
    }
  }
  
  // Add the --with-all-dependencies flag
  command += ' -W';
  
  return command;
}

/**
 * Fetches package information from Packagist API with improved search
 * @param {string} packageName - The package name or extension key to look up
 * @returns {Promise<Object|null>} Package information or null if not found
 */
export async function fetchPackagistInfo(packageName) {
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

/**
 * Builds a dynamically fetched mapping of TYPO3 extensions
 * @returns {Promise<Object>} Mapping of extension keys to package names
 */
export async function fetchExtensionMappings() {
  const mappings = {};
  
  try {
    // First get popular extensions
    const popularExtensions = await fetchPopularTYPO3Extensions(100);
    
    // Process each extension
    for (const extension of popularExtensions) {
      try {
        // Extract the extension key from the package name
        const nameParts = extension.name.split('/');
        if (nameParts.length === 2) {
          let extensionKey = nameParts[1].toLowerCase();
          
          // Clean up the extension key
          extensionKey = extensionKey
            .replace(/^typo3-cms-/, '')
            .replace(/^typo3-/, '')
            .replace(/-/g, '_');
          
          // Add to our mappings
          mappings[extensionKey] = extension.name;
        }
      } catch (error) {
        console.error(`Error processing extension ${extension.name}:`, error);
      }
    }
    
    // Add some common extensions that might not be in the popular list
    const commonExtensions = [
      'headless',
      'news',
      'gridelements', 
      'mask',
      'form',
      'fluid_styled_content',
      'felogin',
      'redirects',
      'seo',
      'scheduler',
      'base_distribution'
    ];
    
    // Special case mapping
    mappings['base_distribution'] = 'typo3/cms-base-distribution';
    
    for (const extensionKey of commonExtensions) {
      if (!mappings[extensionKey]) {
        try {
          const packageInfo = await fetchPackagistInfo(extensionKey);
          if (packageInfo && packageInfo.name) {
            mappings[extensionKey] = packageInfo.name;
          }
        } catch (error) {
          console.error(`Error fetching package info for ${extensionKey}:`, error);
        }
      }
    }
    
    return mappings;
  } catch (error) {
    console.error('Error building extension mappings:', error);
    // Fall back to static mappings
    return getExtensionMappings();
  }
}

// Extension mappings cache with TTL
let extensionMappingsCache = null;
let extensionMappingsCacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Gets extension mappings with caching
 * @param {boolean} forceRefresh - Whether to force a refresh of the cache
 * @returns {Promise<Object>} Mapping of extension keys to package names
 */
export async function getExtensionMappingsAsync(forceRefresh = false) {
  // Check if we have a valid cache
  const now = Date.now();
  if (!forceRefresh && extensionMappingsCache && (now - extensionMappingsCacheTime < CACHE_TTL)) {
    return extensionMappingsCache;
  }
  
  try {
    // Fetch new mappings
    const mappings = await fetchExtensionMappings();
    
    // Update cache
    extensionMappingsCache = mappings;
    extensionMappingsCacheTime = now;
    
    return mappings;
  } catch (error) {
    console.error('Error getting extension mappings:', error);
    
    // Fall back to static mappings
    return getExtensionMappings();
  }
}

/**
 * Generates an upgrade command for TYPO3, including extensions from the project
 * @param {string} targetVersion - Target TYPO3 version
 * @param {Array} extensions - List of extensions from the project
 * @returns {Promise<string>} Composer command for upgrading
 */
export async function generateUpgradeCommandAsync(targetVersion, extensions = []) {
  // Ensure proper quoting of the version constraint ONLY for the core package
  const quotedCoreVersion = `"^${targetVersion.replace(/^\^/, '')}"`;
  
  // Convert target version to major.minor
  const majorVersion = parseInt(targetVersion.split('.')[0], 10);
  const minorVersion = parseInt(targetVersion.split('.')[1] || '0', 10);
  
  let command = `composer require typo3/cms-core:${quotedCoreVersion}`;
  
  // Add extensions if available
  if (extensions && extensions.length > 0) {
    const composerExtensions = extensions.filter(ext => {
      const extName = ext.name || ext.package_name || ext.key;
      return extName && extName !== 'typo3/cms-core';
    });
    
    if (composerExtensions.length > 0) {
      // Try to get real extension mappings from Packagist
      const mappings = await getExtensionMappingsAsync();
      
      // Process each extension
      for (const ext of composerExtensions) {
        let packageName = ext.name || ext.package_name || ext.key;
        
        // Skip typo3/cms-core which is already included
        if (packageName === 'typo3/cms-core') continue;
        
        // For extensions without a slash in the name, try to find the proper package name
        if (packageName && !packageName.includes('/')) {
          // Normalize extension key
          const extensionKey = packageName.toLowerCase().replace(/_/g, '-').replace(/\./g, '-');
          
          // Check if we have a known mapping
          if (mappings[extensionKey]) {
            packageName = mappings[extensionKey];
          } else if (extensionKey === 'base-distribution') {
            // Special case for base-distribution
            packageName = 'typo3/cms-base-distribution';
          }
          // Check if we have this package in cache
          else if (packageCache.has(extensionKey)) {
            packageName = packageCache.get(extensionKey);
          }
          // Try to fetch from Packagist if not in cache
          else {
            try {
              // First try with common prefixes to avoid unnecessary API calls
              if (extensionKey.startsWith('t3') || extensionKey.startsWith('typo3')) {
                packageName = `typo3/${extensionKey}`;
              } else {
                // Try to find on Packagist
                const packageInfo = await fetchPackagistInfo(extensionKey);
                if (packageInfo && packageInfo.name) {
                  packageName = packageInfo.name;
                  // Cache the result
                  packageCache.set(extensionKey, packageInfo.name);
                } else {
                  // Fall back to using author information
                  if (ext.author && typeof ext.author === 'string') {
                    const authorName = ext.author.toLowerCase()
                      .replace(/[^a-z0-9]/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '');
                    
                    packageName = `${authorName}/${extensionKey}`;
                  } else {
                    // Default fallback using common community namespacing
                    packageName = `friendsoftypo3/${extensionKey}`;
                  }
                  
                  // Cache the fallback too to avoid repeated lookups
                  packageCache.set(extensionKey, packageName);
                }
              }
            } catch (error) {
              console.error(`Error looking up package for ${extensionKey}:`, error);
              // Use a fallback
              packageName = `friendsoftypo3/${extensionKey}`;
              packageCache.set(extensionKey, packageName);
            }
          }
        }
        
        if (packageName) {
          // Add the extension to the command WITHOUT version constraint
          command += ` ${packageName}`;
        }
      }
    }
  }
  
  // Add the --with-all-dependencies flag
  command += ' -W';
  
  return command;
}