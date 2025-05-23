import JSZip from 'jszip';

/**
 * Analyzes a TYPO3 project zip file and extracts relevant information
 * @param {File} zipFile - The uploaded zip file
 * @returns {Promise<Object>} - Object containing extracted TYPO3 project information
 */
export async function analyzeTYPO3Zip(zipFile) {
  try {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(zipFile);
    
    // Initialize data structure
    const data = {
      timestamp: Date.now(),
      typo3: {
        version: null,
        composerInstallation: false,
        phpVersion: null
      },
      extensions: [],
      system: {
        php: {
          version: null,
          platformVersion: null
        },
        allowedPlugins: {}
      },
      database: {},
      composerJson: null,
      files: {
        totalCount: Object.keys(zipContent.files).length,
        analyzedPaths: []
      }
    };
    
    // Check if this is a composer installation
    const composerJsonFile = findFile(zipContent, 'composer.json');
    if (composerJsonFile) {
      // Add to analyzed paths
      data.files.analyzedPaths.push(composerJsonFile);
      
      data.typo3.composerInstallation = true;
      const composerJsonContent = await zipContent.files[composerJsonFile].async('string');
      try {
        const composerJson = JSON.parse(composerJsonContent);
        data.composerJson = composerJson;
        
        // Extract TYPO3 version from composer.json
        if (composerJson.require && composerJson.require['typo3/cms-core']) {
          const versionConstraint = composerJson.require['typo3/cms-core'];
          const versionMatch = versionConstraint.match(/^\^?(\d+\.\d+)/);
          if (versionMatch) {
            data.typo3.version = versionMatch[1] + '.0'; // Add .0 as placeholder for patch version
          }
        }
        
        // Extract PHP version
        if (composerJson.require && composerJson.require.php) {
          data.typo3.phpVersion = composerJson.require.php.replace(/^\^?~?/g, '');
          data.system.php.version = data.typo3.phpVersion;
        }
        
        // Extract PHP platform version
        if (composerJson.config && composerJson.config.platform && composerJson.config.platform.php) {
          data.system.php.platformVersion = composerJson.config.platform.php;
        }
        
        // Extract allowed plugins
        if (composerJson.config && composerJson.config['allow-plugins']) {
          data.system.allowedPlugins = composerJson.config['allow-plugins'];
        }
        
        // Extract extensions
        await extractExtensionsFromComposer(zipContent, composerJson, data);
      } catch (error) {
        console.error('Error parsing composer.json:', error);
      }
    } else {
      // Non-composer installation
      data.typo3.composerInstallation = false;
      
      // Try to find TYPO3 version from other files
      await extractTYPO3VersionFromNonComposer(zipContent, data);
      
      // Extract extensions from typical ext locations
      await extractExtensionsFromFolder(zipContent, data);
    }
    
    // Find LocalConfiguration.php to get database info
    await extractDatabaseInfo(zipContent, data);
    
    // Add some key TYPO3 paths to analyzed paths if they exist
    const keyPaths = [
      'public/index.php',
      'index.php',
      'typo3/index.php',
      'typo3/sysext/',
      'typo3conf/',
      'public/typo3conf/'
    ];
    
    for (const path of keyPaths) {
      const exists = Object.keys(zipContent.files).some(key => key.startsWith(path));
      if (exists && !data.files.analyzedPaths.includes(path)) {
        data.files.analyzedPaths.push(path);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error analyzing zip file:', error);
    throw error;
  }
}

/**
 * Find a file in the zip content by pattern
 * @param {Object} zipContent - JSZip content
 * @param {string} pattern - File pattern to search for
 * @returns {string|null} - Path to the found file or null
 */
function findFile(zipContent, pattern) {
  const keys = Object.keys(zipContent.files);
  // First try exact match at root level
  const exactRootMatch = keys.find(key => key === pattern);
  if (exactRootMatch) return exactRootMatch;
  
  // Then try with any path
  return keys.find(key => key.endsWith(pattern));
}

/**
 * Find files matching a pattern in the zip content
 * @param {Object} zipContent - JSZip content
 * @param {RegExp} pattern - Regex pattern to match against file paths
 * @returns {Array<string>} - Array of matching file paths
 */
function findFiles(zipContent, pattern) {
  return Object.keys(zipContent.files).filter(key => pattern.test(key));
}

/**
 * Extract extensions from composer.json
 * @param {Object} zipContent - JSZip content
 * @param {Object} composerJson - Parsed composer.json content
 * @param {Object} data - Data object to populate
 */
async function extractExtensionsFromComposer(zipContent, composerJson, data) {
  const extensions = [];
  const versionConstraint = composerJson.require && composerJson.require['typo3/cms-core']
    ? composerJson.require['typo3/cms-core']
    : null;
  
  // Record analyzed path
  if (!data.files.analyzedPaths) {
    data.files.analyzedPaths = [];
  }
  data.files.analyzedPaths.push('composer.json');
  
  // Helper function to process a package dependency
  const processPackage = (packageName, version, isDev = false) => {
    // Skip core and PHP requirements
    if (packageName === 'typo3/cms-core' || packageName === 'php') {
      return;
    }
    
    // Process TYPO3 core extensions
    if (packageName.startsWith('typo3/cms-')) {
      const extName = packageName.replace('typo3/cms-', '');
      extensions.push({
        key: extName,
        name: packageName,
        version: version.replace(/^\^?~?/g, ''),
        title: `TYPO3 Core Extension: ${extName}`,
        bundled: true,
        isActive: true, // Core extensions are typically active
        isDev: isDev,
        isCompatible: true, // Core extensions are assumed compatible
        constraints: {
          depends: {
            typo3: versionConstraint
          }
        }
      });
    } 
    // Process community/third-party extensions
    else if (packageName.includes('/') && !packageName.startsWith('php')) {
      // Check if it's a known TYPO3 extension type or has a type hint in composer.json
      const isExtension = 
        (composerJson.dependencies && 
          composerJson.dependencies[packageName] && 
          composerJson.dependencies[packageName].type === 'typo3-cms-extension') ||
        packageName.includes('-extension') ||
        packageName.includes('-ext-') ||
        packageName.includes('/typo3-') ||
        packageName.match(/\/(ext|extension)-/);
      
      // Extract extension key from package name
      const nameParts = packageName.split('/');
      let extKey = nameParts.length > 1 ? nameParts[1] : packageName;
      
      // Clean up extension key - remove typo3- prefix if present
      extKey = extKey.replace(/^typo3-/, '').replace(/^ext-/, '');
      
      extensions.push({
        key: extKey,
        name: packageName,
        version: version.replace(/^\^?~?/g, ''),
        title: `Extension: ${packageName}`,
        bundled: false,
        isActive: !isDev, // Assume active if not dev dependency
        isDev: isDev,
        isExtension: isExtension, // Flag if it's definitely an extension
        isCompatible: null, // Will determine compatibility later
        constraints: {
          depends: {
            typo3: versionConstraint // Assuming same constraint as core by default
          }
        }
      });
    }
  };
    
  // Process regular dependencies
  for (const [packageName, version] of Object.entries(composerJson.require || {})) {
    processPackage(packageName, version, false);
  }
  
  // Also include dev dependencies - they may contain important test/development extensions
  for (const [packageName, version] of Object.entries(composerJson['require-dev'] || {})) {
    processPackage(packageName, version, true);
  }
  
  // Check for extension management packages which might indicate additional extensions
  const hasExtManager = (composerJson.require && composerJson.require['helhum/typo3-console']) ||
                        (composerJson.require && composerJson.require['typo3/cms-composer-installers']) ||
                        (composerJson.require && composerJson.require['typo3/cms-cli']);
  
  if (hasExtManager) {
    data.hasExtensionManager = true;
  }
  
  // Look for actual extension files in the zip and try to get more info
  for (const extension of extensions) {
    const extensionFolder = findExtensionFolder(zipContent, extension.key);
    if (extensionFolder) {
      await enrichExtensionData(zipContent, extension, extensionFolder);
    }
  }
  
  data.extensions = extensions;
}

/**
 * Extract TYPO3 version from files in non-composer installations
 * @param {Object} zipContent - JSZip content
 * @param {Object} data - Data object to populate
 */
async function extractTYPO3VersionFromNonComposer(zipContent, data) {
  // Try to find version from sysext/core/Classes/Information/Typo3Version.php first
  const versionFilePaths = [
    'typo3/sysext/core/Classes/Information/Typo3Version.php',
    'typo3_src/typo3/sysext/core/Classes/Information/Typo3Version.php',
    'typo3_src/typo3/sysext/core/Classes/Core/SystemEnvironmentBuilder.php', // For older TYPO3 versions
  ];
  
  for (const versionFilePath of versionFilePaths) {
    const versionFile = findFile(zipContent, versionFilePath);
    if (versionFile) {
      // Add to analyzed paths
      data.files.analyzedPaths.push(versionFile);
      
      try {
        const fileContent = await zipContent.files[versionFile].async('string');
        
        // Try to extract version from Typo3Version.php first (TYPO3 v9+)
        let versionMatch = fileContent.match(/const\s+VERSION\s*=\s*'(\d+\.\d+\.\d+)'/);
        
        // For older versions, try different patterns
        if (!versionMatch) {
          versionMatch = fileContent.match(/TYPO3_version\s*=\s*'(\d+\.\d+\.\d+)'/);
        }
        
        if (versionMatch) {
          data.typo3.version = versionMatch[1];
          break;
        }
      } catch (error) {
        console.error(`Error reading ${versionFilePath}:`, error);
      }
    }
  }
  
  // If still no version found, try from LocalConfiguration.php
  if (!data.typo3.version) {
    const configFile = findFile(zipContent, 'LocalConfiguration.php');
    if (configFile) {
      // Add to analyzed paths
      data.files.analyzedPaths.push(configFile);
      
      try {
        const fileContent = await zipContent.files[configFile].async('string');
        const versionMatch = fileContent.match(/'version'\s*=>\s*'([^']+)'/);
        if (versionMatch) {
          data.typo3.version = versionMatch[1];
        }
      } catch (error) {
        console.error('Error reading LocalConfiguration.php:', error);
      }
    }
  }
  
  // If still no version found, try to guess from the folder structure
  if (!data.typo3.version) {
    // TYPO3 v10+ has a public folder in typical installations
    const hasPublicFolder = Object.keys(zipContent.files).some(key => key.startsWith('public/'));
    if (hasPublicFolder) {
      data.typo3.version = '10.4.0'; // Estimate
    } else {
      // TYPO3 v8+ has asset handling which usually means following files exist
      const hasV8Structure = Object.keys(zipContent.files).some(key => 
        key.includes('typo3/sysext/core/Resources/Public/Icons/'));
      if (hasV8Structure) {
        data.typo3.version = '8.7.0'; // Estimate
      } else {
        data.typo3.version = '7.6.0'; // Default fallback
      }
    }
  }
}

/**
 * Extract extensions from folder structure
 * @param {Object} zipContent - JSZip content
 * @param {Object} data - Data object to populate
 */
async function extractExtensionsFromFolder(zipContent, data) {
  const extensions = [];
  const extensionFolders = [
    // Common extension locations - adding more paths for better detection
    /^typo3conf\/ext\/([^\/]+)\//,
    /^typo3\/ext\/([^\/]+)\//,
    /^typo3\/sysext\/([^\/]+)\//,
    /^public\/typo3conf\/ext\/([^\/]+)\//,
    /^public\/typo3\/ext\/([^\/]+)\//,
    /^public\/typo3\/sysext\/([^\/]+)\//,
    /^ext\/([^\/]+)\//,
    /^vendor\/([^\/]+\/[^\/]+)\/(?:Configuration|Classes|Resources)\//,
    /^vendor\/([^\/]+\/[^-]+\-ext\-[^\/]+)\//,
    /^packages\/[^\/]+\/([^\/]+)\/(?:Configuration|Classes|Resources)\//
  ];
  
  // Initialize analyzedPaths if not already done
  if (!data.files.analyzedPaths) {
    data.files.analyzedPaths = [];
  }
  
  // Get unique extension folders from paths
  const extFolders = new Map();
  
  for (const key of Object.keys(zipContent.files)) {
    for (const pattern of extensionFolders) {
      const match = key.match(pattern);
      if (match && match[1]) {
        const extKey = match[1];
        const extPath = key.substring(0, key.indexOf(extKey) + extKey.length);
        
        // Only add if not already found
        if (!extFolders.has(extKey)) {
          extFolders.set(extKey, extPath);
          
          // Record only the extension root path
          if (!data.files.analyzedPaths.includes(extPath)) {
            data.files.analyzedPaths.push(extPath);
          }
        }
        break;
      }
    }
  }
  
  // Try to extract from PackageStates.php if available
  const installedExtensions = await extractExtensionsFromPackageStates(zipContent, data);
  if (installedExtensions.length > 0) {
    for (const ext of installedExtensions) {
      // Find the actual folder for each extension if not already known
      if (!extFolders.has(ext.key)) {
        const extFolder = findExtensionFolder(zipContent, ext.key);
        if (extFolder) {
          extFolders.set(ext.key, extFolder);
          if (!data.files.analyzedPaths.includes(extFolder)) {
            data.files.analyzedPaths.push(extFolder);
          }
        }
        extensions.push(ext);
      }
    }
  }
  
  // Process each extension folder
  for (const [extKey, extPath] of extFolders) {
    // Skip if this extension was already added from PackageStates.php
    if (extensions.some(e => e.key === extKey)) {
      continue;
    }
    
    // Look for ext_emconf.php
    const emconfPath = `${extPath}/ext_emconf.php`;
    if (zipContent.files[emconfPath]) {
      // Record analyzed path for ext_emconf.php
      if (!data.files.analyzedPaths.includes(emconfPath)) {
        data.files.analyzedPaths.push(emconfPath);
      }
      
      try {
        const emconfContent = await zipContent.files[emconfPath].async('string');
        
        // Extract basic info from ext_emconf.php
        const titleMatch = emconfContent.match(/'title'\s*=>\s*'([^']+)'/);
        const versionMatch = emconfContent.match(/'version'\s*=>\s*'([^']+)'/);
        const constraintMatch = emconfContent.match(/'constraints'\s*=>\s*array\s*\([^\)]+\'typo3\'\s*=>\s*\'([^\']+)\'/s);
        
        const extension = {
          key: extKey,
          name: extKey,
          title: titleMatch ? titleMatch[1] : `Extension: ${extKey}`,
          version: versionMatch ? versionMatch[1] : '1.0.0',
          bundled: extPath.includes('/sysext/'),
          isActive: true, // Assume active if found in file system
          isCompatible: null,
          constraints: {
            depends: {
              typo3: constraintMatch ? constraintMatch[1] : null
            }
          }
        };
        
        extensions.push(extension);
      } catch (error) {
        console.error(`Error reading ext_emconf.php for ${extKey}:`, error);
      }
    } else {
      // If no ext_emconf.php, try composer.json in extension folder
      const extComposerPath = `${extPath}/composer.json`;
      if (zipContent.files[extComposerPath]) {
        // Record analyzed path for composer.json
        if (!data.files.analyzedPaths.includes(extComposerPath)) {
          data.files.analyzedPaths.push(extComposerPath);
        }
        
        try {
          const composerContent = await zipContent.files[extComposerPath].async('string');
          const composerJson = JSON.parse(composerContent);
          
          const extension = {
            key: extKey,
            name: composerJson.name || extKey,
            title: composerJson.description || `Extension: ${extKey}`,
            version: composerJson.version || '1.0.0',
            bundled: extPath.includes('/sysext/'),
            isActive: true, // Assume active if found in file system
            isCompatible: null,
            constraints: {
              depends: {
                typo3: composerJson.require && composerJson.require['typo3/cms-core'] 
                  ? composerJson.require['typo3/cms-core'] 
                  : null
              }
            }
          };
          
          extensions.push(extension);
        } catch (error) {
          console.error(`Error reading composer.json for ${extKey}:`, error);
        }
      } else {
        // Try to check for Extension class file or other extension markers
        const classFile = findFiles(zipContent, new RegExp(`${extKey}\/Classes\/.*\.php$`));
        const hasClassFiles = classFile.length > 0;
        
        // Basic info if no detailed files found
        extensions.push({
          key: extKey,
          name: extKey,
          title: `Extension: ${extKey}`,
          version: '1.0.0',
          bundled: extPath.includes('/sysext/'),
          isActive: true, // Assume active if found in file system
          isCompatible: null,
          hasClassFiles: hasClassFiles,
          constraints: {
            depends: {
              typo3: null
            }
          }
        });
      }
    }
  }
  
  data.extensions = extensions;
}

/**
 * Extract extensions from PackageStates.php file
 * @param {Object} zipContent - JSZip content
 * @param {Object} data - Data object to populate
 * @returns {Array} - Array of extension objects
 */
async function extractExtensionsFromPackageStates(zipContent, data) {
  const extensions = [];
  const packageStatesFiles = [
    'typo3conf/PackageStates.php',
    'public/typo3conf/PackageStates.php',
    'var/PackageStates.php'
  ];
  
  let packageStatesFile = null;
  for (const file of packageStatesFiles) {
    if (zipContent.files[file]) {
      packageStatesFile = file;
      break;
    }
  }
  
  if (!packageStatesFile) {
    return extensions;
  }
  
  // Record analyzed path
  if (!data.files.analyzedPaths.includes(packageStatesFile)) {
    data.files.analyzedPaths.push(packageStatesFile);
  }
  
  try {
    const fileContent = await zipContent.files[packageStatesFile].async('string');
    
    // Extract the packages array contents from PHP file
    const packagesMatch = fileContent.match(/\'packages\'\s*=>\s*array\s*\(([\s\S]*?),?\s*\),/);
    if (!packagesMatch) {
      return extensions;
    }
    
    const packagesContent = packagesMatch[1];
    const packageEntries = packagesContent.match(/'([^']+)'\s*=>\s*array\s*\(([\s\S]*?),?\s*\)/g);
    
    if (!packageEntries) {
      return extensions;
    }
    
    for (const entry of packageEntries) {
      const packageKeyMatch = entry.match(/'([^']+)'/);
      if (!packageKeyMatch) continue;
      
      const packageKey = packageKeyMatch[1];
      
      // Skip core packages if they'll be detected elsewhere
      if (packageKey === 'core') continue;
      
      // Extract state (active/inactive)
      const stateMatch = entry.match(/'state'\s*=>\s*'([^']+)'/);
      const packageState = stateMatch ? stateMatch[1] : 'inactive';
      
      // Extract package path
      const pathMatch = entry.match(/'packagePath'\s*=>\s*'([^']+)'/);
      const packagePath = pathMatch ? pathMatch[1] : null;
      
      // Determine if it's a system extension
      const isBundled = packagePath && (
        packagePath.includes('/sysext/') || 
        packagePath.includes('/typo3/sysext/') ||
        packagePath.startsWith('EXT:') && packageKey.startsWith('core')
      );
      
      extensions.push({
        key: packageKey,
        name: packageKey,
        title: `Extension: ${packageKey}`,
        version: null, // Will need to get from extension files
        bundled: isBundled,
        isActive: packageState === 'active',
        isCompatible: null,
        packagePath: packagePath,
        constraints: {
          depends: {
            typo3: null // Will need to get from extension files
          }
        }
      });
    }
  } catch (error) {
    console.error(`Error reading PackageStates.php:`, error);
  }
  
  // For each extension found in PackageStates, try to enhance with metadata from files
  for (const extension of extensions) {
    if (extension.packagePath) {
      const fullPath = extension.packagePath.replace(/^EXT:/, '');
      // Check for ext_emconf.php
      const emconfPath = findFile(zipContent, `${fullPath}ext_emconf.php`);
      if (emconfPath) {
        try {
          const emconfContent = await zipContent.files[emconfPath].async('string');
        
          // Extract basic info from ext_emconf.php
          const titleMatch = emconfContent.match(/'title'\s*=>\s*'([^']+)'/);
          const versionMatch = emconfContent.match(/'version'\s*=>\s*'([^']+)'/);
          const constraintMatch = emconfContent.match(/'constraints'\s*=>\s*array\s*\([^\)]+\'typo3\'\s*=>\s*\'([^\']+)\'/s);
          
          if (titleMatch) extension.title = titleMatch[1];
          if (versionMatch) extension.version = versionMatch[1];
          if (constraintMatch) extension.constraints.depends.typo3 = constraintMatch[1];
        } catch (error) {
          console.error(`Error enhancing extension data for ${extension.key}:`, error);
        }
      }
    }
  }
  
  return extensions;
}

/**
 * Find folder containing an extension by key
 * @param {Object} zipContent - JSZip content
 * @param {string} extensionKey - Extension key to find
 * @returns {string|null} - Path to extension folder or null
 */
function findExtensionFolder(zipContent, extensionKey) {
  // Support for kebab-case or snake_case in extension keys
  const normalizedKey = extensionKey.replace(/_/g, '-');
  const snakeCaseKey = extensionKey.replace(/-/g, '_');
  
  const possiblePaths = [
    // Standard paths
    `typo3conf/ext/${extensionKey}/`,
    `typo3/ext/${extensionKey}/`,
    `typo3/sysext/${extensionKey}/`,
    `public/typo3conf/ext/${extensionKey}/`,
    `public/typo3/ext/${extensionKey}/`,
    `public/typo3/sysext/${extensionKey}/`,
    `ext/${extensionKey}/`,
    // Paths with normalized key (kebab case)
    `typo3conf/ext/${normalizedKey}/`,
    `typo3/ext/${normalizedKey}/`,
    `typo3/sysext/${normalizedKey}/`,
    `public/typo3conf/ext/${normalizedKey}/`,
    `public/typo3/ext/${normalizedKey}/`,
    `public/typo3/sysext/${normalizedKey}/`,
    `ext/${normalizedKey}/`,
    // Paths with snake case key
    `typo3conf/ext/${snakeCaseKey}/`,
    `typo3/ext/${snakeCaseKey}/`,
    `typo3/sysext/${snakeCaseKey}/`,
    `public/typo3conf/ext/${snakeCaseKey}/`,
    `public/typo3/ext/${snakeCaseKey}/`,
    `public/typo3/sysext/${snakeCaseKey}/`,
    `ext/${snakeCaseKey}/`,
    // Composer vendor paths
    `vendor/typo3/cms-${extensionKey}/`,
    `vendor/typo3/cms-${normalizedKey}/`,
  ];
  
  // Add possible vendor paths for known vendor prefixes
  const commonVendors = ['friendsoftypo3', 'georgringer', 'helhum', 'b13', 'in2code', 'mask', 'cobweb', 'dmitryd', 'lolli', 'derhansen', 'bk2k', 'causal', 'cpsit', 'ehaerer', 'extcode'];
  
  for (const vendor of commonVendors) {
    possiblePaths.push(`vendor/${vendor}/${extensionKey}/`);
    possiblePaths.push(`vendor/${vendor}/${normalizedKey}/`);
    // Add variations for common naming patterns
    possiblePaths.push(`vendor/${vendor}/typo3-${extensionKey}/`);
    possiblePaths.push(`vendor/${vendor}/typo3-${normalizedKey}/`);
    possiblePaths.push(`vendor/${vendor}/ext-${extensionKey}/`);
    possiblePaths.push(`vendor/${vendor}/ext-${normalizedKey}/`);
  }
  
  // Add custom package paths
  possiblePaths.push(`packages/${extensionKey}/`);
  possiblePaths.push(`packages/extensions/${extensionKey}/`);
  possiblePaths.push(`packages/${normalizedKey}/`);
  possiblePaths.push(`packages/extensions/${normalizedKey}/`);
  
  // First try exact matches
  for (const path of possiblePaths) {
    if (Object.keys(zipContent.files).some(key => key.startsWith(path))) {
      return path;
    }
  }
  
  // If no exact match, try to find by matching pattern in vendor directory
  const vendorExtPattern = new RegExp(`vendor/[^/]+/(?:[^/]*${extensionKey}[^/]*|[^/]*${normalizedKey}[^/]*)/(?:composer\.json|ext_emconf\.php|Classes/)`);
  const vendorMatches = Object.keys(zipContent.files).filter(key => vendorExtPattern.test(key));
  
  if (vendorMatches.length > 0) {
    // Extract the base path from the first match
    const match = vendorMatches[0];
    const basePath = match.substring(0, match.indexOf('/', match.indexOf('/', match.indexOf('/') + 1) + 1) + 1);
    return basePath;
  }
  
  return null;
}

/**
 * Enrich extension data with more information from extension folder
 * @param {Object} zipContent - JSZip content
 * @param {Object} extension - Extension object to enrich
 * @param {string} extensionFolder - Path to extension folder
 */
async function enrichExtensionData(zipContent, extension, extensionFolder) {
  // Track what files we've found to determine extension type
  const extensionFiles = {
    hasEmconf: false,
    hasComposer: false,
    hasClassesFolder: false,
    hasControllers: false,
    hasRepositories: false,
    hasModels: false,
    hasTca: false,
    hasTcaOverrides: false,
    hasTypoScript: false,
    hasTemplates: false,
    hasSqlFile: false,
    hasHooks: false,
    hasExtTables: false,
    hasExtLocalconf: false,
    hasLocallang: false,
    hasConfiguration: false,
    hasIconsFolder: false
  };
  
  // Check for ext_emconf.php
  const emconfPath = `${extensionFolder}ext_emconf.php`;
  if (zipContent.files[emconfPath]) {
    extensionFiles.hasEmconf = true;
    try {
      const emconfContent = await zipContent.files[emconfPath].async('string');
      
      // Extract title from ext_emconf.php
      const titleMatch = emconfContent.match(/'title'\s*=>\s*'([^']+)'/);
      if (titleMatch) {
        extension.title = titleMatch[1];
      }
      
      // Extract version from ext_emconf.php
      const versionMatch = emconfContent.match(/'version'\s*=>\s*'([^']+)'/);
      if (versionMatch) {
        extension.version = versionMatch[1];
      }
      
      // Extract constraints from ext_emconf.php
      const constraintMatch = emconfContent.match(/'constraints'\s*=>\s*array\s*\([^\)]+\'typo3\'\s*=>\s*\'([^\']+)\'/s);
      if (constraintMatch) {
        extension.constraints.depends.typo3 = constraintMatch[1];
      }
      
      // Extract other information
      const categoryMatch = emconfContent.match(/'category'\s*=>\s*'([^']+)'/);
      if (categoryMatch) {
        extension.category = categoryMatch[1];
      }
      
      const authorMatch = emconfContent.match(/'author'\s*=>\s*'([^']+)'/);
      if (authorMatch) {
        extension.author = authorMatch[1];
      }
      
      const authorEmailMatch = emconfContent.match(/'author_email'\s*=>\s*'([^']+)'/);
      if (authorEmailMatch) {
        extension.authorEmail = authorEmailMatch[1];
      }
      
      const authorCompanyMatch = emconfContent.match(/'author_company'\s*=>\s*'([^']+)'/);
      if (authorCompanyMatch) {
        extension.authorCompany = authorCompanyMatch[1];
      }
      
      const stateMatch = emconfContent.match(/'state'\s*=>\s*'([^']+)'/);
      if (stateMatch) {
        extension.state = stateMatch[1];
      }
    } catch (error) {
      console.error(`Error enriching extension data for ${extension.key}:`, error);
    }
  }
  
  // Check for composer.json in the extension
  const composerPath = `${extensionFolder}composer.json`;
  if (zipContent.files[composerPath]) {
    extensionFiles.hasComposer = true;
    try {
      const composerContent = await zipContent.files[composerPath].async('string');
      const composerJson = JSON.parse(composerContent);
      
      // Use description as title if available
      if (composerJson.description) {
        extension.title = composerJson.description;
      }
      
      // Use version from composer.json if available
      if (composerJson.version) {
        extension.version = composerJson.version;
      }
      
      // Extract TYPO3 dependency from composer.json
      if (composerJson.require && composerJson.require['typo3/cms-core']) {
        extension.constraints.depends.typo3 = composerJson.require['typo3/cms-core'];
      }
      
      // Extract extension type
      if (composerJson.type) {
        extension.composerType = composerJson.type;
        // Flag definitely as extension if type is set correctly
        if (composerJson.type === 'typo3-cms-extension') {
          extension.isExtension = true;
        }
      }
      
      // Extract authors
      if (composerJson.authors && composerJson.authors.length > 0) {
        const author = composerJson.authors[0];
        extension.author = author.name || extension.author;
        extension.authorEmail = author.email || extension.authorEmail;
        extension.authorHomepage = author.homepage || extension.authorHomepage;
      }
      
      // Extract keywords
      if (composerJson.keywords && composerJson.keywords.length > 0) {
        extension.keywords = composerJson.keywords;
      }
    } catch (error) {
      console.error(`Error reading composer.json for ${extension.key}:`, error);
    }
  }
  
  // Check for extension structure to determine type
  // Classes folder
  const classesFolder = `${extensionFolder}Classes/`;
  extensionFiles.hasClassesFolder = Object.keys(zipContent.files).some(key => key.startsWith(classesFolder));
  
  // Check for Controllers (MVC pattern)
  extensionFiles.hasControllers = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${classesFolder}Controller/`) || key.match(/Classes\/.*Controller\.php$/));
  
  // Check for Domain/Models (Extbase)
  extensionFiles.hasModels = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${classesFolder}Domain/Model/`) || key.match(/Classes\/.*Model\.php$/));
  
  // Check for Repositories (Extbase)
  extensionFiles.hasRepositories = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${classesFolder}Domain/Repository/`) || key.match(/Classes\/.*Repository\.php$/));
  
  // Check for TCA files
  extensionFiles.hasTca = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Configuration/TCA/`) || key === `${extensionFolder}Configuration/TCA.php`);
  
  // Check for TCA overrides
  extensionFiles.hasTcaOverrides = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Configuration/TCA/Overrides/`));
  
  // Check for TypoScript files
  extensionFiles.hasTypoScript = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Configuration/TypoScript/`) || 
    key.endsWith('.typoscript') || key.endsWith('.ts') || 
    key.includes(`${extensionFolder}ext_typoscript_`));
  
  // Check for templates
  extensionFiles.hasTemplates = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Resources/Private/Templates/`) || 
    key.endsWith('.html') || key.endsWith('.fluid'));
  
  // Check for SQL file
  extensionFiles.hasSqlFile = Object.keys(zipContent.files).some(key => 
    key === `${extensionFolder}ext_tables.sql` || key.endsWith('.sql'));
  
  // Check for hooks
  extensionFiles.hasHooks = Object.keys(zipContent.files).some(key => 
    key.includes(`${classesFolder}Hooks/`) || 
    key.match(/Classes\/.*Hook\.php$/) || 
    key.match(/XCLASS/i) ||
    key.includes('$GLOBALS[\'TYPO3_CONF_VARS\'][\'SC_OPTIONS\']'));
  
  // Check for ext_tables.php
  extensionFiles.hasExtTables = zipContent.files[`${extensionFolder}ext_tables.php`] !== undefined;
  
  // Check for ext_localconf.php
  extensionFiles.hasExtLocalconf = zipContent.files[`${extensionFolder}ext_localconf.php`] !== undefined;
  
  // Check for language files
  extensionFiles.hasLocallang = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Resources/Private/Language/`) || 
    key.includes('locallang') || key.endsWith('.xlf') || key.endsWith('.xml'));
  
  // Check for Configuration folder
  extensionFiles.hasConfiguration = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Configuration/`));
  
  // Check for icons folder
  extensionFiles.hasIconsFolder = Object.keys(zipContent.files).some(key => 
    key.startsWith(`${extensionFolder}Resources/Public/Icons/`));
  
  // Determine extension type based on files found
  const extensionType = determineExtensionType(extensionFiles);
  
  // Add file information to extension
  extension.files = extensionFiles;
  extension.type = extensionType;
  
  // Check for extension icon
  const iconPaths = [
    `${extensionFolder}ext_icon.png`,
    `${extensionFolder}ext_icon.svg`,
    `${extensionFolder}ext_icon.gif`,
    `${extensionFolder}Resources/Public/Icons/Extension.png`,
    `${extensionFolder}Resources/Public/Icons/Extension.svg`
  ];
  
  for (const iconPath of iconPaths) {
    if (zipContent.files[iconPath]) {
      extension.hasIcon = true;
      extension.iconPath = iconPath;
      break;
    }
  }
  
  return extension;
}

/**
 * Determine the extension type based on files found
 * @param {Object} files - Extension files object
 * @returns {string} - Extension type
 */
function determineExtensionType(files) {
  if (files.hasControllers && files.hasModels && files.hasRepositories) {
    return 'extbase';
  } else if (files.hasClassesFolder && files.hasTca) {
    return 'modern';
  } else if (files.hasExtTables && files.hasExtLocalconf) {
    return 'classic';
  } else if (files.hasTypoScript && files.hasTemplates) {
    return 'frontend';
  } else if (files.hasTcaOverrides) {
    return 'customization';
  } else if (files.hasHooks) {
    return 'hook';
  } else {
    return 'unknown';
  }
}

/**
 * Extract database information
 * @param {Object} zipContent - JSZip content
 * @param {Object} data - Data object to populate
 */
async function extractDatabaseInfo(zipContent, data) {
  const configFiles = [
    'typo3conf/LocalConfiguration.php',
    'public/typo3conf/LocalConfiguration.php',
    'config/system/settings.php', // For newer installations
    '.env' // For installations using env files
  ];
  
  for (const configFile of configFiles) {
    const file = findFile(zipContent, configFile);
    if (file) {
      // Add to analyzed paths if not already added
      if (!data.files.analyzedPaths.includes(file)) {
        data.files.analyzedPaths.push(file);
      }
      
      try {
        const content = await zipContent.files[file].async('string');
        
        if (file.endsWith('.php')) {
          // Try to extract database info from PHP configuration
          const dbHostMatch = content.match(/'host'\s*=>\s*'([^']+)'/);
          const dbNameMatch = content.match(/'database'\s*=>\s*'([^']+)'/);
          const dbDriverMatch = content.match(/'driver'\s*=>\s*'([^']+)'/);
          
          data.database = {
            type: dbDriverMatch ? dbDriverMatch[1] : 'mysql',
            host: dbHostMatch ? dbHostMatch[1] : 'localhost',
            name: dbNameMatch ? dbNameMatch[1] : null,
            tableCount: null // Will attempt to determine from SQL dumps
          };
        } else if (file.endsWith('.env')) {
          // Try to extract from env file
          const dbHostMatch = content.match(/DB_HOST=([^\r\n]+)/);
          const dbNameMatch = content.match(/DB_NAME=([^\r\n]+)/);
          const dbDriverMatch = content.match(/DB_DRIVER=([^\r\n]+)/);
          
          data.database = {
            type: dbDriverMatch ? dbDriverMatch[1] : 'mysql',
            host: dbHostMatch ? dbHostMatch[1] : 'localhost',
            name: dbNameMatch ? dbNameMatch[1] : null,
            tableCount: null // Will attempt to determine from SQL dumps
          };
        }
        
        break;
      } catch (error) {
        console.error(`Error extracting database info from ${configFile}:`, error);
      }
    }
  }
  
  // Try to find SQL dump files and count tables
  if (data.database) {
    // Common paths for SQL dumps in TYPO3 projects
    const sqlDumpLocations = [
      /\.sql$/i,                        // Any .sql file
      /backup.*\.sql$/i,                // Backup SQL files
      /dump.*\.sql$/i,                  // Dump SQL files
      /database.*\.sql$/i,              // Database SQL files
      /typo3temp\/dumps\/.*\.sql$/i,    // TYPO3 temp dumps
      /typo3conf\/.*\.sql$/i            // SQL files in typo3conf
    ];
    
    // Find SQL files
    const sqlFiles = Object.keys(zipContent.files).filter(path => {
      return sqlDumpLocations.some(pattern => pattern.test(path)) && 
             !zipContent.files[path].dir; // Ensure it's a file, not a directory
    });
    
    // Process the first SQL file found to count tables
    if (sqlFiles.length > 0) {
      try {
        const sqlContent = await zipContent.files[sqlFiles[0]].async('string');
        
        // Count CREATE TABLE statements to estimate number of tables
        const createTableMatches = sqlContent.match(/CREATE\s+TABLE\s+[`"']([^`"']+)[`"']/gi);
        if (createTableMatches) {
          data.database.tableCount = createTableMatches.length;
          
          // Record the SQL file we analyzed
          if (!data.files.analyzedPaths.includes(sqlFiles[0])) {
            data.files.analyzedPaths.push(sqlFiles[0]);
          }
          
          // Try to determine database version from SQL dump
          const mysqlVersionMatch = sqlContent.match(/MySQL.*?(\d+\.\d+\.\d+)/i);
          const mariadbVersionMatch = sqlContent.match(/MariaDB.*?(\d+\.\d+\.\d+)/i);
          
          if (mysqlVersionMatch) {
            data.database.version = mysqlVersionMatch[1];
            data.database.type = 'mysql';
          } else if (mariadbVersionMatch) {
            data.database.version = mariadbVersionMatch[1];
            data.database.type = 'mariadb';
          }
        }
      } catch (error) {
        console.error(`Error analyzing SQL file ${sqlFiles[0]}:`, error);
      }
    }
    
    // If we still don't have a table count or DB version, set defaults
    if (!data.database.tableCount) {
      // Estimate based on TYPO3 version and extensions
      const extensionCount = data.extensions.length;
      // Base table count (core TYPO3) + estimate for extensions
      data.database.tableCount = 40 + Math.min(extensionCount * 2, 60);
    }
    
    if (!data.database.version) {
      // Set a version based on TYPO3 version requirements
      const typo3Version = parseInt(data.typo3.version?.split('.')[0] || '10', 10);
      
      if (typo3Version >= 12) {
        data.database.version = '8.0.0'; // TYPO3 v12+ typically uses MySQL 8.0+
      } else if (typo3Version >= 10) {
        data.database.version = '5.7.0'; // TYPO3 v10-11 typically uses MySQL 5.7+
      } else {
        data.database.version = '5.5.0'; // Older TYPO3 versions
      }
    }
  }
} 