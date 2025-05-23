/**
 * Reads and parses the project data from the uploaded file
 * @param {File} file - The uploaded file (JSON or ZIP)
 * @returns {Promise<Object>} Project data including TYPO3 version, PHP version, and extensions
 */
export async function readProjectData(file) {
    try {
        if (!file) {
            throw new Error('No file provided');
        }

        // Check file type
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
            // Handle JSON file
            const text = await file.text();
            return JSON.parse(text);
        } else if (file.name.endsWith('.zip')) {
            // Handle ZIP file using zipFileAnalyzer
            const { analyzeTYPO3Zip } = await import('./zipFileAnalyzer');
            return await analyzeTYPO3Zip(file);
        } else {
            throw new Error('Unsupported file type. Please upload a JSON or ZIP file.');
        }
    } catch (error) {
        console.error('Error reading project data:', error);
        throw error;
    }
}

/**
 * Analyzes the project data and returns formatted information
 * @param {File} file - The uploaded file
 * @returns {Promise<Object>} Formatted project analysis
 */
export async function analyzeProject(file) {
    try {
        if (!file) {
            throw new Error('No file provided');
        }

        const projectData = await readProjectData(file);
        if (!projectData) {
            throw new Error('Could not read project data');
        }

        // Handle both JSON export format and ZIP analysis format
        const typo3Version = projectData.TYPO3Version || projectData.typo3?.version;
        const phpVersion = projectData.PHPVersion || projectData.typo3?.phpVersion || projectData.system?.php?.version;
        const extensions = projectData.InstalledExtensions || projectData.extensions || [];

        // Format extensions to a consistent structure
        const formattedExtensions = extensions.map(ext => {
            if (typeof ext === 'string') {
                // For core extensions, use the TYPO3 version
                const isCoreExtension = [
                    'core', 'extbase', 'fluid', 'install', 'recordlist', 'backend', 'frontend',
                    'dashboard', 'fluid_styled_content', 'filelist', 'impexp', 'form', 'seo',
                    'setup', 'rte_ckeditor', 'belog', 'beuser', 'extensionmanager', 'felogin',
                    'info', 'sys_note', 't3editor', 'tstemplate', 'viewpage'
                ].includes(ext);

                return {
                    name: ext,
                    version: isCoreExtension ? typo3Version : (ext === 'helhum/typo3-console' ? '7.1.2' : '1.0.0'),
                    isComposer: ext.includes('/'),
                    bundled: isCoreExtension,
                    isCoreExtension: isCoreExtension
                };
            }
            return {
                name: ext.name || ext.key || ext,
                version: ext.version || (ext.isCoreExtension ? typo3Version : '1.0.0'),
                isComposer: (ext.name || ext.key || ext).includes('/'),
                bundled: (ext.name || ext.key || ext).startsWith('typo3/cms-') || (ext.name || ext.key || ext).startsWith('core'),
                isCoreExtension: (ext.name || ext.key || ext).startsWith('typo3/cms-') || (ext.name || ext.key || ext).startsWith('core')
            };
        });

        return {
            typo3: {
                version: typo3Version,
                isLTS: isLTSVersion(typo3Version),
                support: determineTYPO3Support(typo3Version),
                composerInstallation: projectData.typo3?.composerInstallation || false
            },
            php: {
                version: phpVersion,
                isSupported: isPHPVersionSupported(phpVersion)
            },
            extensions: {
                systemExtensions: {
                    count: formattedExtensions.filter(ext => !ext.isComposer).length,
                    list: formattedExtensions.filter(ext => !ext.isComposer)
                },
                composerExtensions: {
                    count: formattedExtensions.filter(ext => ext.isComposer).length,
                    list: formattedExtensions.filter(ext => ext.isComposer)
                }
            },
            exportInfo: {
                timestamp: projectData.ExportTimestamp || projectData.timestamp || Date.now(),
                exportedBy: projectData.ExportedBy || 'System'
            }
        };
    } catch (error) {
        console.error('Error analyzing project:', error);
        throw error;
    }
}

/**
 * Determines if a TYPO3 version is LTS
 * @param {string} version - TYPO3 version string
 * @returns {boolean} Whether the version is LTS
 */
function isLTSVersion(version) {
    const [major, minor] = version.split('.');
    return minor === '5' || minor === '4'; // TYPO3 LTS versions typically end in .4 or .5
}

/**
 * Determines TYPO3 version support status
 * @param {string} version - TYPO3 version string
 * @returns {Object} Support status information
 */
function determineTYPO3Support(version) {
    const [major] = version.split('.');
    const majorVersion = parseInt(major, 10);

    // Current support status as of 2024
    const support = {
        isSupported: true,
        supportType: 'regular',
        endOfLife: null
    };

    if (majorVersion <= 10) {
        support.isSupported = false;
        support.supportType = 'unsupported';
        support.endOfLife = 'Already EOL';
    } else if (majorVersion === 11) {
        support.supportType = 'lts';
        support.endOfLife = '2024-10-31';
    } else if (majorVersion === 12) {
        support.supportType = 'lts';
        support.endOfLife = '2025-10-31';
    }

    return support;
}

/**
 * Checks if PHP version is still supported
 * @param {string} version - PHP version string
 * @returns {boolean} Whether the PHP version is supported
 */
function isPHPVersionSupported(version) {
    const [major, minor] = version.split('.');
    const versionNumber = parseFloat(`${major}.${minor}`);
    
    // As of 2024, PHP 7.4+ is supported by current TYPO3 versions
    return versionNumber >= 7.4;
}

/**
 * Analyzes installed extensions
 * @param {Array<string>} extensions - List of installed extensions
 * @returns {Object} Extension analysis
 */
function analyzeExtensions(extensions) {
    const systemExtensions = extensions.filter(ext => !ext.includes('/'));
    const composerExtensions = extensions.filter(ext => ext.includes('/'));

    return {
        total: extensions.length,
        systemExtensions: {
            count: systemExtensions.length,
            list: systemExtensions
        },
        composerExtensions: {
            count: composerExtensions.length,
            list: composerExtensions
        }
    };
} 