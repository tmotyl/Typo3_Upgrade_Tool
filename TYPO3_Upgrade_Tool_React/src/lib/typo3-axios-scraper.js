import axios from 'axios';

/**
 * Known LTS version patterns for TYPO3
 */
const LTS_PATTERNS = {
  6: ['.2'],
  7: ['.6'],
  8: ['.7'],
  9: ['.5'],
  10: ['.4'],
  11: ['.5'],
  12: ['.4'],
  13: ['.4']
};

// Extension mappings cache with TTL
let extensionMappingsCache = null;
let extensionMappingsCacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches TYPO3 version information from the official API through our proxy
 * @returns {Promise<Array>} Array of TYPO3 version objects
 */
export async function fetchTYPO3VersionsWithAxios() {
  try {
    // Define the major versions we want to fetch (from TYPO3 7 to 13)
    const majorVersions = [7, 8, 9, 10, 11, 12, 13];
    const versions = [];

    console.log('Starting to fetch TYPO3 versions...');

    // Fetch data for each major version through our proxy
    for (const majorVersion of majorVersions) {
      try {
        console.log(`Fetching major version ${majorVersion}...`);
        
        // Fetch major version data
        const response = await axios.get(`http://localhost:3000/api/typo3/${majorVersion}`);
        
        // Create a version object from the major version data
        if (response.data) {
          try {
            const versionObject = createVersionObject(
              response.data.version.toString(),
              response.data,
              response.data.lts || false
            );
            versions.push(versionObject);
          } catch (error) {
            console.warn(`Failed to process version ${majorVersion}:`, error.message);
            continue;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch TYPO3 version ${majorVersion}:`, error.message);
        continue;
      }
    }

    console.log(`Total versions found: ${versions.length}`);

    // Sort versions by version number in descending order
    const sortedVersions = versions.sort((a, b) => {
      const versionA = a.version.split('.').map(Number);
      const versionB = b.version.split('.').map(Number);
      
      for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
        const numA = versionA[i] || 0;
        const numB = versionB[i] || 0;
        if (numA !== numB) {
          return numB - numA;
        }
      }
      return 0;
    });

    console.log('Versions sorted successfully');
    return sortedVersions;

  } catch (error) {
    console.error('Error fetching TYPO3 versions:', error);
    throw error;
  }
}

/**
 * Creates a version object from API data
 * @param {string} version - Version number
 * @param {Object} data - Version data from API
 * @param {boolean} isLTS - Whether this is an LTS version
 * @returns {Object} Formatted version object
 */
function createVersionObject(version, data, isLTS = false) {
  // Extract support information
  const support = {
    active_until: data.maintained_until || 'Unknown',
    security_until: data.elts_until || 'Unknown'
  };

  // Extract PHP version requirements
  let phpRequirements = {
    min: 'Unknown',
    max: 'Unknown'
  };

  // Try to get PHP requirements from the requirements array
  if (data.requirements) {
    const phpReq = data.requirements.find(req => req.category === 'php' && req.name === 'php');
    if (phpReq) {
      phpRequirements = {
        min: phpReq.min || 'Unknown',
        max: phpReq.max || phpReq.min || 'Unknown'
      };
    }
  }

  // Extract database requirements
  const mysqlReq = data.requirements?.find(req => req.category === 'database' && req.name === 'mysql');
  const mysqlVersion = mysqlReq ? `${mysqlReq.min}${mysqlReq.max ? ` - ${mysqlReq.max}` : ''}` : 'Unknown';

  // Extract requirements
  const requirements = {
    php: phpRequirements,
    mysql: mysqlVersion,
    composer: '2.0+'  // Default value as it's not provided in the API
  };

  // Determine version type
  let type = 'regular';
  if (isLTS || data.lts) {
    type = 'lts';
  } else if (data.stable) {
    type = 'sts';
  } else if (data.development) {
    type = 'dev';
  }
  
  return {
    version,
    type,
    release_date: data.release_date || 'Unknown',
    support,
    requirements,
    db_changes: false,  // Not provided in the API
    install_tool_migrations: false  // Not provided in the API
  };
}

/**
 * Checks if a version is an LTS version
 * @param {number} major - Major version number
 * @param {string} fullVersion - Full version string
 * @returns {boolean} Whether this is an LTS version
 */
function isLTSVersion(major, fullVersion) {
  if (!LTS_PATTERNS[major]) return false;
  
  return LTS_PATTERNS[major].some(pattern => 
    fullVersion.startsWith(major + pattern)
  );
}

/**
 * Checks for breaking changes in version data
 * @param {Object} data - Version data
 * @param {string} type - Type of breaking change
 * @returns {boolean} Whether breaking changes exist
 */
function hasBreakingChanges(data, type) {
  if (!data.breaking_changes) return false;
  if (Array.isArray(data.breaking_changes)) {
    return data.breaking_changes.includes(type);
  }
  return false;
}

/**
 * Formats database requirements into a user-friendly string
 * @param {Object} data - Version data
 * @returns {string} Formatted database requirements
 */
function formatDatabaseRequirements(data) {
  const requirements = [];
  
  if (data.mysql_version) {
    requirements.push(`MySQL ${data.mysql_version}`);
  }
  if (data.mariadb_version) {
    requirements.push(`MariaDB ${data.mariadb_version}`);
  }
  
  return requirements.length > 0 ? requirements.join(' / ') : 'MySQL 5.5+ / MariaDB 5.5+';
}

/**
 * Formats composer requirements into a user-friendly string
 * @param {Object} data - Version data
 * @returns {string} Formatted composer requirements
 */
function formatComposerRequirements(data) {
  if (data.composer_version) return data.composer_version;
  if (data.composer_versions) return data.composer_versions;
  return '2.0+';
}

/**
 * Gets a static mapping of known TYPO3 extensions
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
    'blog': 'typo3/cms-blog'
  };
}

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
    // Start with static mappings
    const mappings = getExtensionMappings();
    
    // Update cache
    extensionMappingsCache = mappings;
    extensionMappingsCacheTime = now;
    
    return mappings;
  } catch (error) {
    console.error('Error getting extension mappings:', error);
    return getExtensionMappings();
  }
}

/**
 * Generates an upgrade command for TYPO3 and its extensions
 * @param {string} targetVersion - Target TYPO3 version
 * @param {Array} extensions - List of extensions to upgrade
 * @returns {Promise<string>} Composer command for upgrading
 */
export async function generateUpgradeCommandAsync(targetVersion, extensions = []) {
  // Ensure proper quoting of the version constraint
  const quotedCoreVersion = `"^${targetVersion.replace(/^\^/, '')}"`;
  let command = `composer require typo3/cms-core:${quotedCoreVersion}`;
  
  if (extensions && extensions.length > 0) {
    // Get extension mappings
    const mappings = await getExtensionMappingsAsync();
    
    // Process each extension
    for (const ext of extensions) {
      let packageName = ext.name || ext.package_name || ext.key;
      if (!packageName || packageName === 'typo3/cms-core') continue;

      // For extensions without a vendor prefix
      if (!packageName.includes('/')) {
        const extensionKey = packageName.toLowerCase().replace(/_/g, '-');
        packageName = mappings[extensionKey] || `friendsoftypo3/${extensionKey}`;
      }

      command += ` ${packageName}`;
    }
  }
  
  // Add the --with-all-dependencies flag
  command += ' -W';
  
  return command;
}

/**
 * Fetches package information from Packagist API
 * @param {string} packageName - The package name to look up
 * @returns {Promise<Object|null>} Package information or null if not found
 */
export async function fetchPackagistInfo(packageName) {
  try {
    const response = await axios.get(`https://packagist.org/packages/${packageName}.json`);
    return response.data.package || null;
  } catch (error) {
    console.warn(`Failed to fetch package info for ${packageName}:`, error.message);
    return null;
  }
} 