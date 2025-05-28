import axios from 'axios';

/**
 * Fetches TYPO3 version information using the official TYPO3 API
 * @returns {Promise<Array>} Array of TYPO3 version data
 */
export async function fetchTYPO3Versions() {
  try {
    console.log('Fetching TYPO3 version data from API...');
    
    
    const majorVersionsResponse = await axios.get('/api/typo3/major');
    const majorVersions = majorVersionsResponse.data.majors;
    
    
    let allVersions = [];
    
    
    for (const majorVersion of Object.keys(majorVersions)) {
      try {
        console.log(`Fetching details for TYPO3 v${majorVersion}...`);
        
        
        const releasesResponse = await axios.get(`/api/typo3/major/${majorVersion}/release`);
        const releases = releasesResponse.data.releases;
        
        
        for (const releaseVersion in releases) {
          const release = releases[releaseVersion];
          
          
          let releaseType = "regular";
          if (release.lts) {
            releaseType = "lts";
          } else if (release.maintainance) {
            releaseType = "sts";
          } else if (releaseVersion.includes('dev')) {
            releaseType = "dev";
          }
          
          
          const versionData = {
            "version": releaseVersion,
            "type": releaseType,
            "release_date": release.date,
            "support": {
              "active_until": release.maintained_until || "Unknown",
              "security_until": release.elts_until || release.maintained_until || "Unknown"
            },
            "requirements": {
              "php": release.php_constraints || "Unknown",
              "mysql": parseVersionConstraint(release.mysql_constraints, release.mariadb_constraints),
              "composer": "1.5+"  
            },
            
            
            "db_changes": isMajorOrMinorRelease(releaseVersion),
            "install_tool_migrations": isMajorRelease(releaseVersion)
          };
          
          allVersions.push(versionData);
        }
      } catch (majorError) {
        console.error(`Error fetching releases for TYPO3 v${majorVersion}:`, majorError);
        
      }
    }
    
    
    allVersions.sort((a, b) => {
      const versionA = a.version.split('.').map(Number);
      const versionB = b.version.split('.').map(Number);
      
      
      if (versionA[0] !== versionB[0]) return versionB[0] - versionA[0];
      
      if (versionA[1] !== versionB[1]) return versionB[1] - versionA[1];
      
      return versionB[2] - versionA[2];
    });
    
    
    const filteredVersions = filterLatestVersions(allVersions);
    
    return filteredVersions;
  } catch (error) {
    console.error('Error fetching TYPO3 versions:', error);
    
    
    console.warn('Falling back to mock data due to API error');
    return getFallbackMockData();
  }
}

/**
 * Filters the versions to keep only the latest patch versions for each minor version
 * @param {Array} versions - List of all versions
 * @returns {Array} Filtered list of versions
 */
function filterLatestVersions(versions) {
  const latestVersionsMap = {};
  
  
  versions.forEach(version => {
    const versionParts = version.version.split('.');
    const majorMinor = `${versionParts[0]}.${versionParts[1]}`;
    
    
    if (version.version.includes('dev')) return;
    
    
    if (!latestVersionsMap[majorMinor] || 
        compareVersions(version.version, latestVersionsMap[majorMinor].version) > 0) {
      latestVersionsMap[majorMinor] = version;
    }
  });
  
  
  return Object.values(latestVersionsMap).sort((a, b) => 
    compareVersions(b.version, a.version)
  );
}

/**
 * Compares two version strings
 * @param {string} versionA - First version
 * @param {string} versionB - Second version
 * @returns {number} Comparison result: 1 if A > B, -1 if A < B, 0 if equal
 */
function compareVersions(versionA, versionB) {
  const partsA = versionA.split('.').map(Number);
  const partsB = versionB.split('.').map(Number);
  
  
  if (partsA[0] !== partsB[0]) return partsA[0] - partsB[0];
  
  if (partsA[1] !== partsB[1]) return partsA[1] - partsB[1];
  
  if (partsA.length > 2 && partsB.length > 2) return partsA[2] - partsB[2];
  
  return 0;
}

/**
 * Parses database version constraints to a user-friendly format
 * @param {string} mysqlConstraint - MySQL constraint string from API
 * @param {string} mariadbConstraint - MariaDB constraint string from API
 * @returns {string} Formatted version constraint
 */
function parseVersionConstraint(mysqlConstraint, mariadbConstraint) {
  let result = [];
  
  if (mariadbConstraint) {
    
    const mariaMatch = mariadbConstraint.match(/>=(\d+\.\d+)/);
    if (mariaMatch) {
      result.push(`${mariaMatch[1]}+`);
    }
  }
  
  if (mysqlConstraint) {
    
    const mysqlMatch = mysqlConstraint.match(/>=(\d+\.\d+)/);
    if (mysqlMatch) {
      result.push(`MySQL ${mysqlMatch[1]}+`);
    }
  }
  
  return result.length > 0 ? result.join(' / ') : "5.5+"; 
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
 * Provides fallback mock data in case the API fails
 * @returns {Array} Mock TYPO3 version data
 */
function getFallbackMockData() {
  return [
    {
      "version": "13.4",
      "type": "lts",
      "release_date": "2024-04-08",
      "support": {
        "active_until": "2026-06-30",
        "security_until": "2027-12-31"
      },
      "requirements": {
        "php": "8.2 - 8.4",
        "mysql": "10.4.3+ / MySQL 8.0.17+",
        "composer": "2.0+"
      },
      "db_changes": true,
      "install_tool_migrations": true
    },
    {
      "version": "12.4",
      "type": "lts",
      "release_date": "2023-10-03",
      "support": {
        "active_until": "2025-10-31",
        "security_until": "2026-04-30"
      },
      "requirements": {
        "php": "8.1 - 8.3",
        "mysql": "10.3+ / MySQL 8.0.17+",
        "composer": "2.0+"
      },
      "db_changes": true,
      "install_tool_migrations": false
    },
    {
      "version": "11.5",
      "type": "lts",
      "release_date": "2021-10-05",
      "support": {
        "active_until": "2023-10-31",
        "security_until": "2024-10-31"
      },
      "requirements": {
        "php": "7.4 - 8.1",
        "mysql": "10.2+ / MySQL 8.0.15+",
        "composer": "2.0+"
      },
      "db_changes": false,
      "install_tool_migrations": true
    },
    {
      "version": "10.4",
      "type": "lts",
      "release_date": "2020-04-07",
      "support": {
        "active_until": "2022-04-30",
        "security_until": "2023-04-30"
      },
      "requirements": {
        "php": "7.2 - 7.4",
        "mysql": "5.7+ / MySQL 8.0.3+",
        "composer": "1.5+"
      },
      "db_changes": true,
      "install_tool_migrations": true
    },
    {
      "version": "9.5",
      "type": "lts",
      "release_date": "2018-10-02",
      "support": {
        "active_until": "2020-09-30",
        "security_until": "2021-09-30"
      },
      "requirements": {
        "php": "7.2 - 7.3",
        "mysql": "5.5+ / MySQL 8.0+",
        "composer": "1.5+"
      },
      "db_changes": true,
      "install_tool_migrations": true
    },
    {
      "version": "8.7",
      "type": "lts",
      "release_date": "2017-04-04",
      "support": {
        "active_until": "2018-10-31",
        "security_until": "2020-03-31"
      },
      "requirements": {
        "php": "7.0 - 7.2",
        "mysql": "5.5+",
        "composer": "1.4+"
      },
      "db_changes": true,
      "install_tool_migrations": true
    },
    {
      "version": "7.6",
      "type": "lts",
      "release_date": "2015-11-10",
      "support": {
        "active_until": "2017-04-30",
        "security_until": "2018-12-31"
      },
      "requirements": {
        "php": "5.5 - 7.0",
        "mysql": "5.5+",
        "composer": "1.2+"
      },
      "db_changes": true,
      "install_tool_migrations": true
    }
  ];
} 