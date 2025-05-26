import { useState, useEffect, useCallback } from "react";
import { generateUpgradeCommandAsync } from "../lib/typo3-axios-scraper.js";

export default function TYPO3UpgradeTool({ initialCurrentVersion = '', initialTargetVersion = '', upgradeMethod = 'console', extensions = [] }) {
  const [currentVersion, setCurrentVersion] = useState(initialCurrentVersion);
  const [targetVersion, setTargetVersion] = useState(initialTargetVersion);
  const [upgradePath, setUpgradePath] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [installationType, setInstallationType] = useState('composer'); // 'composer' or 'non-composer'
  const [allowDowngrade, setAllowDowngrade] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({}); // To track which steps are expanded
  const [expandedSubSteps, setExpandedSubSteps] = useState({}); // To track which substeps are expanded
  const [currentUpgradeMethod, setCurrentUpgradeMethod] = useState(upgradeMethod);
  const [extensionList, setExtensionList] = useState(extensions);
  
  // New state variables for step-by-step navigation
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSubStepIndex, setCurrentSubStepIndex] = useState(0);
  const [stepViewMode, setStepViewMode] = useState('list'); // 'list' or 'step-by-step'
  const [completedSteps, setCompletedSteps] = useState({});
  
  // Use upgradeMethod when it changes
  useEffect(() => {
    if (upgradeMethod !== currentUpgradeMethod) {
      setCurrentUpgradeMethod(upgradeMethod);
    }
  }, [upgradeMethod]);
  
  // Use initialCurrentVersion and initialTargetVersion when they change
  useEffect(() => {
    if (initialCurrentVersion && initialCurrentVersion !== currentVersion) {
      setCurrentVersion(initialCurrentVersion);
    }
    if (initialTargetVersion && initialTargetVersion !== targetVersion) {
      setTargetVersion(initialTargetVersion);
    }
  }, [initialCurrentVersion, initialTargetVersion]);

  // Use extensions when they change
  useEffect(() => {
    if (extensions && extensions.length > 0) {
      setExtensionList(extensions);
      
      // Fetch the upgrade command with the new extensions if we have a target version
      if (targetVersion) {
        fetchUpgradeCommand(targetVersion);
      }
    }
  }, [extensions]);

  // Effect to fetch the upgrade command asynchronously for better extension parsing
  const [upgradeCommands, setUpgradeCommands] = useState({});
  
  // Async function to fetch upgrade command with extensions
  const fetchUpgradeCommand = useCallback(async (version) => {
    if (!version) return null;
    
    try {
      // Only fetch if we have extensions and the command isn't already cached
      if (extensionList && extensionList.length > 0 && !upgradeCommands[version]) {
        // Format version for API if needed (remove patch version)
        const formattedVersion = version.split('.').slice(0, 2).join('.');
        
        const command = await generateUpgradeCommandAsync(formattedVersion, extensionList);
        
        // Cache the fetched command
        setUpgradeCommands(prev => ({
          ...prev,
          [version]: command
        }));
        
        return command;
      }
    } catch (error) {
      console.error('Error fetching upgrade command:', error);
    }
    
    // Return cached command if available
    return upgradeCommands[version] || generateUpgradeCommand(version, extensionList);
  }, [extensionList, upgradeCommands]);

  // Function to navigate to the next step
  const goToNextStep = () => {
    const currentStep = upgradePath[currentStepIndex];
    
    // If the current step has sub-steps
    if (currentStep?.steps && currentStep.steps.length > 0) {
      // If there are more sub-steps
      if (currentSubStepIndex < currentStep.steps.length - 1) {
        setCurrentSubStepIndex(prev => prev + 1);
      } else {
        // Move to the next main step
        if (currentStepIndex < upgradePath.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          setCurrentSubStepIndex(0);
        }
      }
    } else {
      // No sub-steps, move to the next main step
      if (currentStepIndex < upgradePath.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
        setCurrentSubStepIndex(0);
      }
    }
    
    // Mark the current step as completed
    setCompletedSteps(prev => ({
      ...prev,
      [`${currentStepIndex}-${currentSubStepIndex}`]: true
    }));
  };
  
  // Function to go to the previous step
  const goToPreviousStep = () => {
    if (currentSubStepIndex > 0) {
      setCurrentSubStepIndex(prev => prev - 1);
    } else if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      const prevStep = upgradePath[currentStepIndex - 1];
      if (prevStep?.steps && prevStep.steps.length > 0) {
        setCurrentSubStepIndex(prevStep.steps.length - 1);
      } else {
        setCurrentSubStepIndex(0);
      }
    }
  };
  
  // Function to directly navigate to a specific step
  const goToStep = (stepIndex, subStepIndex = 0) => {
    setCurrentStepIndex(stepIndex);
    setCurrentSubStepIndex(subStepIndex);
  };
  
  // Function to toggle between list view and step-by-step view
  const toggleViewMode = () => {
    setStepViewMode(prev => prev === 'list' ? 'step-by-step' : 'list');
    if (stepViewMode === 'list') {
      // Reset navigation state when switching to step-by-step mode
      setCurrentStepIndex(0);
      setCurrentSubStepIndex(0);
    }
  };
  
  // Function to check if a step is completed
  const isStepCompleted = (stepIndex, subStepIndex) => {
    return completedSteps[`${stepIndex}-${subStepIndex}`] === true;
  };
  
  // Function to get the total number of steps (main steps and sub-steps)
  const getTotalSteps = () => {
    let total = 0;
    upgradePath.forEach(step => {
      if (step.steps && step.steps.length > 0) {
        total += step.steps.length;
      } else {
        total += 1;
      }
    });
    return total;
  };
  
  // Function to get the current step number (across all versions)
  const getCurrentStepNumber = () => {
    let count = 0;
    
    for (let i = 0; i < currentStepIndex; i++) {
      const step = upgradePath[i];
      if (step?.steps && step.steps.length > 0) {
        count += step.steps.length;
      } else {
        count += 1;
      }
    }
    
    // Add the current sub-steps
    count += currentSubStepIndex + 1;
    
    return count;
  };

  // Function to copy a command to clipboard
  const copyToClipboard = (command) => {
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    });
  };

  // Define the major TYPO3 versions and their upgrade paths
  const typo3Versions = [
    { version: '6.2', lts: true, releaseDate: '2014-03-25', eolDate: '2017-03-31' },
    { version: '7.6', lts: true, releaseDate: '2015-11-10', eolDate: '2018-11-30' },
    { version: '8.7', lts: true, releaseDate: '2017-04-04', eolDate: '2020-03-31' },
    { version: '9.5', lts: true, releaseDate: '2018-10-02', eolDate: '2021-09-30' },
    { version: '10.4', lts: true, releaseDate: '2020-04-28', eolDate: '2023-04-30' },
    { version: '11.5', lts: true, releaseDate: '2021-10-05', eolDate: '2024-10-31' },
    { version: '12.4', lts: true, releaseDate: '2023-04-25', eolDate: '2026-04-30' },
    { version: '13.0', lts: false, releaseDate: '2023-10-03', eolDate: '2024-04-30' },
    { version: '13.1', lts: false, releaseDate: '2023-11-07', eolDate: '2024-05-31' },
    { version: '13.2', lts: false, releaseDate: '2023-12-12', eolDate: '2024-06-30' },
    { version: '13.3', lts: false, releaseDate: '2024-01-23', eolDate: '2024-07-31' },
    { version: '13.4', lts: true, releaseDate: '2024-04-16', eolDate: '2027-04-30' }
  ];
  
  // Fetch upgrade command when target version or extensions change
  useEffect(() => {
    if (targetVersion && extensionList.length > 0) {
      fetchUpgradeCommand(targetVersion);
    }
  }, [targetVersion, extensionList, fetchUpgradeCommand]);
  
  // Calculate upgrade path when versions change
  useEffect(() => {
    if (currentVersion && targetVersion) {
      calculateUpgradePath();
    } else {
      setUpgradePath([]);
    }
  }, [currentVersion, targetVersion, installationType, allowDowngrade, upgradeCommands, currentUpgradeMethod]);
  
  const getVersionObject = (versionString) => {
    // Parse version string to match against our version list
    const versionParts = versionString.split('.');
    const majorMinor = versionParts.length >= 2 ? `${versionParts[0]}.${versionParts[1]}` : versionString;
    
    return typo3Versions.find(v => v.version === majorMinor);
  };

  const calculateUpgradePath = () => {
    setIsCalculating(true);

    // Extract major.minor versions for comparison
    const currentParts = currentVersion.trim().split('.');
    const targetParts = targetVersion.trim().split('.');
    
    if (currentParts.length === 0 || targetParts.length === 0) {
      setUpgradePath([]);
      setIsCalculating(false);
      return;
    }
    
    const currentMajor = parseInt(currentParts[0], 10);
    const currentMinor = currentParts.length > 1 ? parseInt(currentParts[1], 10) : 0;
    const targetMajor = parseInt(targetParts[0], 10);
    const targetMinor = targetParts.length > 1 ? parseInt(targetParts[1], 10) : 0;
    
    // Check if we're downgrading but downgrade is not allowed
    const isDowngrade = currentMajor > targetMajor || (currentMajor === targetMajor && currentMinor > targetMinor);
    
    if (isDowngrade && !allowDowngrade) {
      setUpgradePath([{ 
        message: 'Downgrading to an older version is not recommended. Enable the downgrade option if you wish to proceed.', 
        isWarning: true 
      }]);
      setIsCalculating(false);
      return;
    }
    
    // Check if versions are the same
    if (currentMajor === targetMajor && currentMinor === targetMinor) {
      setUpgradePath([{ 
        message: 'Current version and target version are the same.', 
        isWarning: true 
      }]);
      setIsCalculating(false);
      return;
    }
    
    // Generate upgrade path
    const path = [];
    
    // Get the actual version objects
    const startVersion = getVersionObject(`${currentMajor}.${currentMinor}`);
    const endVersion = getVersionObject(`${targetMajor}.${targetMinor}`);
    
    if (!startVersion) {
      path.push({ message: `Unknown current version: ${currentVersion}`, isError: true });
    }
    
    if (!endVersion) {
      path.push({ message: `Unknown target version: ${targetVersion}`, isError: true });
    }
    
    if (!startVersion || !endVersion) {
      setUpgradePath(path);
      setIsCalculating(false);
      return;
    }
    
    // Different logic for upgrade vs downgrade
    if (isDowngrade) {
      // For downgrade, we'll create a direct path with appropriate warnings
      path.push({
        from: startVersion.version,
        to: endVersion.version,
        complexity: "Very High",
        breaking: true,
        isDowngrade: true,
        steps: getDowngradeSteps(startVersion.version, endVersion.version, installationType, currentUpgradeMethod),
        warnings: [
          "Downgrading is not officially supported by TYPO3",
          "Data loss is possible during downgrade",
          "You may need to manually downgrade extensions"
        ],
        publishInfo: {
          canPublish: true,
          message: `After downgrading from ${startVersion.version} to ${endVersion.version}, it's crucial to thoroughly test your website before going public. Downgrading is not officially supported and may cause data loss or functionality issues.`
        }
      });
    } else {
      // For upgrade, find appropriate LTS versions as stepping stones
      const ltsVersionsBetween = typo3Versions.filter(v => {
        const vParts = v.version.split('.');
        const vMajor = parseInt(vParts[0], 10);
        return v.lts && vMajor > currentMajor && vMajor <= targetMajor;
      });
      
      // Check if we're within the same major version
      const isSameMajorVersion = currentMajor === targetMajor;
      
      // Check if within the same major version, the target version is older (would be a downgrade)
      const isInternalDowngrade = isSameMajorVersion && currentMinor > targetMinor;
      
      // Only add LTS paths if it's not an internal downgrade within the same major version
      if (ltsVersionsBetween.length > 0 && !isInternalDowngrade) {
        // Add first step from current to first LTS higher than current
        const firstLTSHigher = ltsVersionsBetween[0];
        
        // Preload upgrade command if we have extensions (for all steps now, not just the last one)
        if (extensionList && extensionList.length > 0) {
          fetchUpgradeCommand(firstLTSHigher.version);
        }
        
        path.push({
          from: startVersion.version,
          to: firstLTSHigher.version,
          complexity: getUpgradeComplexity(startVersion.version, firstLTSHigher.version),
          breaking: true,
          steps: getUpgradeSteps(startVersion.version, firstLTSHigher.version, installationType, currentUpgradeMethod),
          extensionsIncluded: extensionList && extensionList.length > 0,
          publishInfo: {
            canPublish: true,
            message: `After upgrading from ${startVersion.version} to ${firstLTSHigher.version}, it's recommended to publish and test your website before proceeding to the next upgrade. This will help you identify any issues specific to this upgrade step.`
          }
        });
        
        // Add remaining LTS steps
        for (let i = 1; i < ltsVersionsBetween.length; i++) {
          // Preload upgrade command for this step too
          if (extensionList && extensionList.length > 0) {
            fetchUpgradeCommand(ltsVersionsBetween[i].version);
          }
          
          path.push({
            from: ltsVersionsBetween[i-1].version,
            to: ltsVersionsBetween[i].version,
            complexity: getUpgradeComplexity(ltsVersionsBetween[i-1].version, ltsVersionsBetween[i].version),
            breaking: true,
            steps: getUpgradeSteps(ltsVersionsBetween[i-1].version, ltsVersionsBetween[i].version, installationType, currentUpgradeMethod),
            extensionsIncluded: extensionList && extensionList.length > 0,
            publishInfo: {
              canPublish: true,
              message: `After upgrading from ${ltsVersionsBetween[i-1].version} to ${ltsVersionsBetween[i].version}, it's recommended to publish and test your website before proceeding to the next upgrade. This will help you identify any issues specific to this upgrade step.`
            }
          });
        }
        
        // Add final step to target if needed
        if (ltsVersionsBetween[ltsVersionsBetween.length - 1].version !== endVersion.version) {
          // Preload upgrade command for the final step
          if (extensionList && extensionList.length > 0) {
            fetchUpgradeCommand(endVersion.version);
          }
          
          path.push({
            from: ltsVersionsBetween[ltsVersionsBetween.length - 1].version,
            to: endVersion.version,
            complexity: getUpgradeComplexity(ltsVersionsBetween[ltsVersionsBetween.length - 1].version, endVersion.version),
            breaking: !(endVersion.version.split('.')[0] === ltsVersionsBetween[ltsVersionsBetween.length - 1].version.split('.')[0]),
            steps: getUpgradeSteps(ltsVersionsBetween[ltsVersionsBetween.length - 1].version, endVersion.version, installationType, currentUpgradeMethod),
            extensionsIncluded: extensionList && extensionList.length > 0,
            publishInfo: {
              canPublish: true,
              message: `After completing the final upgrade to ${endVersion.version}, you should thoroughly test your website before going public with the upgrade.`
            }
          });
        }
      } else {
        // If we are trying to do an internal downgrade, show a warning instead
        if (isInternalDowngrade) {
          path.push({ 
            message: `Downgrading from ${currentVersion} to ${targetVersion} within the same major version is not recommended. Enable the downgrade option if you wish to proceed.`, 
            isWarning: true 
          });
        } else {
          // Direct upgrade (only if there are no LTS versions in between)
          // Preload upgrade command for direct upgrade
          if (extensionList && extensionList.length > 0) {
            fetchUpgradeCommand(endVersion.version);
          }
          
          path.push({
            from: startVersion.version,
            to: endVersion.version,
            complexity: getUpgradeComplexity(startVersion.version, endVersion.version),
            breaking: startVersion.version.split('.')[0] !== endVersion.version.split('.')[0],
            steps: getUpgradeSteps(startVersion.version, endVersion.version, installationType, currentUpgradeMethod),
            extensionsIncluded: extensionList && extensionList.length > 0,
            publishInfo: {
              canPublish: true,
              message: `After completing the upgrade from ${startVersion.version} to ${endVersion.version}, you should thoroughly test your website before going public with the upgrade.`
            }
          });
        }
      }
    }
    
    setUpgradePath(path);
    setIsCalculating(false);
    
    // Initialize all steps and substeps to be expanded by default
    const initialExpandedState = {};
    const initialSubStepsState = {};
    
    path.forEach((step, stepIndex) => {
      initialExpandedState[stepIndex] = true;
      
      if (step.steps) {
        step.steps.forEach((_, subStepIndex) => {
          initialSubStepsState[`${stepIndex}-${subStepIndex}`] = true;
        });
      }
    });
    
    setExpandedSteps(initialExpandedState);
    setExpandedSubSteps(initialSubStepsState);
  };

  const getDowngradeSteps = (fromVersion, toVersion, installType, upgradeMethod = 'console') => {
    const fromMajor = parseInt(fromVersion.split('.')[0], 10);
    const toMajor = parseInt(toVersion.split('.')[0], 10);
    
    // Common steps for both installation types
    const commonSteps = [
      {
        title: "Check system requirements (PHP, MySQL, etc.)",
        commands: upgradeMethod === 'console' ? [
          "php -v",
          "mysql --version",
          "php -r \"echo 'Memory limit: ' . ini_get('memory_limit') . PHP_EOL;\"",
          "php -r \"echo 'Max execution time: ' . ini_get('max_execution_time') . PHP_EOL;\""
        ] : [
          "# Verify system compatibility with the older TYPO3 version",
          "1. Check PHP version requirements for the target TYPO3 version:",
          `   a. TYPO3 ${toVersion} requires PHP version: ${
            toMajor >= 12 ? '8.1 - 8.3' : 
            toMajor >= 11 ? '7.4 - 8.2' : 
            toMajor >= 10 ? '7.2 - 7.4' : 
            toMajor >= 9 ? '7.2 - 7.3' : 
            toMajor >= 8 ? '7.0 - 7.2' : 
            toMajor >= 7 ? '5.5 - 7.2' : 
            '5.5 or higher'
          }`,
          "   b. Older TYPO3 versions may not work with newer PHP versions",
          "2. Review your current environment in TYPO3 backend:",
          "   a. Navigate to Admin Tools > Environment > Environment Status",
          "   b. Check PHP, MySQL/MariaDB versions and settings"
        ]
      },
      {
        title: "Backup before downgrading",
        commands: upgradeMethod === 'console' ? [
          "# Create database backup",
          "mysqldump -u [username] -p [database] > typo3_backup_$(date +%Y%m%d).sql",
          "# Create files backup",
          installType === 'composer' 
            ? "tar -czf typo3_files_backup_$(date +%Y%m%d).tar.gz public/ config/ var/"
            : "tar -czf typo3_files_backup_$(date +%Y%m%d).tar.gz ."
        ] : [
          "# Create additional backup immediately before downgrade",
          "1. Create a database backup (if you haven't in previous steps)",
          "2. Create a files backup (if you haven't in previous steps)",
          "3. Document your backup strategy and location of backup files",
          "4. Create a rollback plan in case the downgrade fails"
        ]
      },
      {
        title: "Run TYPO3 Upgrade Wizard",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer' 
            ? "./vendor/bin/typo3 upgrade:run" 
            : "typo3/sysext/core/bin/typo3 upgrade:run"
        ] : [
          "# Run the Upgrade Wizards for the downgraded version",
          "1. After downgrading the TYPO3 core files:",
          "   a. Log in to the TYPO3 backend as administrator",
          "   b. Navigate to Admin Tools > Upgrade > Upgrade Wizard",
          "   c. Run each wizard as needed"
        ]
      },
      {
        title: "Update database schema",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer'
            ? "./vendor/bin/typo3 database:updateschema"
            : "typo3/sysext/core/bin/typo3 database:updateschema"
        ] : [
          "# Update database schema through Admin Panel",
          "1. Navigate to Admin Tools > Maintenance > Database Analyzer",
          "2. Update the database schema as needed"
        ]
      },
      {
        title: "Clear all caches",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer'
            ? "./vendor/bin/typo3 cache:flush"
            : "typo3/sysext/core/bin/typo3 cache:flush"
        ] : [
          "# Clear all TYPO3 caches",
          "1. Click on the flush cache icon in the top toolbar",
          "2. Select 'Flush all caches' from the dropdown menu"
        ]
      }
    ];
    
    // Steps specific to composer installation
    const composerSteps = [
      {
        title: "Downgrade composer.json to target TYPO3 version",
        commands: upgradeMethod === 'console' ? [
          // Use cached command if available, otherwise fall back to generated one
          upgradeCommands[toVersion] || generateUpgradeCommand(toVersion, extensionList)
        ] : [
          "# Update composer.json file for TYPO3 version downgrade",
          "# Replace the TYPO3 version constraints with the target version"
        ]
      },
      {
        title: "Run composer update",
        commands: upgradeMethod === 'console' ? [
          "# Update all packages (recommended)",
          "composer update",
          "# Or update only TYPO3 packages",
          "composer update typo3/cms-* --with-dependencies"
        ] : [
          "# Run composer update via command line",
          "1. Open a terminal/command prompt",
          "2. Navigate to your TYPO3 project root directory",
          "3. Execute: composer update"
        ]
      }
    ];
    
    // Non-composer specific downgrade steps
    const nonComposerSteps = [
      {
        title: "Download and extract the older TYPO3 version",
        commands: upgradeMethod === 'console' ? [
          `# Download TYPO3 version ${toVersion}`,
          `wget https://get.typo3.org/${toVersion} -O typo3_src-${toVersion}.tar.gz`,
          `# Extract the archive`,
          `tar -xzf typo3_src-${toVersion}.tar.gz`,
          `# Remove the archive`,
          `rm typo3_src-${toVersion}.tar.gz`
        ] : [
          "# Manually download and extract older TYPO3 source files",
          `1. Visit https://get.typo3.org/${toVersion} in your browser`,
          "2. Download the .tar.gz or .zip package",
          "3. Extract and upload the files to your server"
        ]
      },
      {
        title: "Update symlinks to point to older source",
        commands: upgradeMethod === 'console' ? [
          "# Backup existing symlink first",
          "mv typo3_src typo3_src_backup",
          "# Create new symlink to the old version",
          `ln -s typo3_src-${toVersion} typo3_src`,
          "# Verify the symlink was updated correctly",
          "ls -la typo3_src"
        ] : [
          "# Manually update symlinks on server",
          "1. Rename your current 'typo3_src' symlink to 'typo3_src_backup'",
          `2. Create a new symlink named 'typo3_src' pointing to 'typo3_src-${toVersion}'`
        ]
      }
    ];
    
    // Combine steps based on installation type
    return [
      ...(installType === 'composer' ? composerSteps : nonComposerSteps),
      ...commonSteps
    ];
  };

  const getUpgradeSteps = (fromVersion, toVersion, installType, upgradeMethod = 'console') => {
    const fromMajor = parseInt(fromVersion.split('.')[0], 10);
    const toMajor = parseInt(toVersion.split('.')[0], 10);
    const majorVersionJump = toMajor - fromMajor;
    
    // Common steps for both installation types and upgrade methods
    const commonSteps = [
      {
        title: "Check system requirements (PHP, MySQL, etc.)",
        commands: upgradeMethod === 'console' ? [
          "php -v",
          "mysql --version"
        ] : [
          "# Verify system requirements in TYPO3 Admin Panel",
          "1. Log in to TYPO3 backend as administrator",
          "2. Navigate to Admin Tools > Settings > Configuration Presets",
          "3. Click 'System Information' in the left menu",
          "4. Review the PHP version - ensure it meets requirements for TYPO3 " + toVersion,
          "5. Check the MySQL/MariaDB version in the database section",
          "6. Verify memory_limit and max_execution_time values are sufficient",
          "7. Run the Environment module (Admin Tools > Environment > Environment Status)",
          "8. Ensure all status checks are green or resolve any warnings"
        ]
      },
      {
        title: "Run TYPO3 Upgrade Wizard",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer' 
            ? "./vendor/bin/typo3 upgrade:run" 
            : "typo3/sysext/core/bin/typo3 upgrade:run"
        ] : [
          "# Execute the upgrade wizards through the Admin Panel",
          "1. Log in to TYPO3 backend as administrator",
          "2. Navigate to Admin Tools > Upgrade > Upgrade Wizard",
          "3. The system will check for available upgrade wizards",
          "4. For each wizard listed, read the description carefully",
          "5. Click 'Perform updates' button for each wizard one at a time",
          "6. Watch for success messages after each wizard completes",
          "7. If any wizard fails, note the error message and try again",
          "8. If you encounter 'Data too long for column lang at row 1', run this SQL query: ALTER TABLE be_users MODIFY lang varchar(20) DEFAULT '' NOT NULL;",
          "9. Continue until all wizards have been executed successfully",
          "10. Some wizards may require multiple runs - follow on-screen instructions"
        ]
      },
      {
        title: "Update database schema",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer'
            ? "./vendor/bin/typo3 database:updateschema"
            : "typo3/sysext/core/bin/typo3 database:updateschema"
        ] : [
          "# Update database schema through Admin Panel",
          "1. Navigate to Admin Tools > Maintenance > Database Analyzer",
          "2. In the 'Compare current database with specification' section:",
          "3. Select 'Display only tables/fields which need to be updated'",
          "4. Click 'Compare current database with specification' button",
          "5. Review the suggested changes carefully",
          "6. For safe operations, click 'Update database schema - SAFE OPERATIONS'",
          "7. Wait for the operations to complete",
          "8. If needed, click 'Update database schema - DESTRUCTIVE OPERATIONS'",
          "9. Verify that all database changes have been applied successfully",
          "10. Note: Create a database backup before performing destructive operations"
        ],
        note: "If you encounter a 503 error with 'Incorrect integer value: info for column level at row 1', run this SQL query: ALTER TABLE sys_log MODIFY level int(1) unsigned DEFAULT '0' NOT NULL;",
        warning: "⚠️ Some database columns may need manual fixing due to data type changes between TYPO3 versions."
      },
      {
        title: "Clear all caches",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer'
            ? "./vendor/bin/typo3 cache:flush"
            : "typo3/sysext/core/bin/typo3 cache:flush"
        ] : [
          "# Clear all system caches through Admin Panel",
          "1. Click on the 'Flush cache' icon in the TYPO3 top toolbar (lightning bolt icon)",
          "2. Select 'Flush all caches' from the dropdown menu",
          "3. Alternative method: Go to Admin Tools > Maintenance > Flush Caches",
          "4. Select 'Flush all caches' option",
          "5. Click the 'Execute' button",
          "6. Wait for the confirmation message",
          "7. Check the frontend to ensure changes are reflected",
          "8. If needed, clear browser caches as well"
        ]
      }
    ];
    
    // Steps specific to composer installation
    const composerSteps = [
      {
        title: "Update composer.json to target TYPO3 version",
        commands: upgradeMethod === 'console' ? [
          // CHANGED: Always use extensionList for all upgrade steps, not just the final one
          // Previously only used extensions for the final step to target version
          upgradeCommands[toVersion] || 
          (extensionList && extensionList.length > 0 
            ? generateUpgradeCommand(toVersion, extensionList)
            : `composer require typo3/cms-core:"^${toVersion}" -W`)
        ] : [
          "# Update composer.json file for TYPO3 version upgrade",
          "1. Access your server via SSH or command line terminal",
          "2. Navigate to your TYPO3 root directory",
          "3. Execute this command to update your TYPO3 version:",
          `   composer require typo3/cms-core:"^${toVersion}" -W`,
          "4. This will automatically update your composer.json file",
          "5. Note: This step cannot be performed through the Admin Panel",
          "6. If you don't have command line access, contact your hosting provider or system administrator"
        ],
        note: "Use the -W flag (equivalent to --with-all-dependencies) to properly resolve dependencies. Do NOT use the --update-with-dependencies flag as it may cause dependency conflicts.",
        warning: "⚠️ WARNING: Using the incorrect flag (--update-with-dependencies) can lead to unresolvable dependency conflicts."
      },
      {
        title: "Run composer update",
        commands: upgradeMethod === 'console' ? [
          "# Update all packages (recommended)",
          "composer update",
          "# Or update only TYPO3 packages",
          "composer update typo3/cms-* --with-dependencies"
        ] : [
          "# Run composer update via command line",
          "1. Access your server via SSH or command line terminal",
          "2. Navigate to your TYPO3 root directory",
          "3. Execute one of these commands:",
          "   - For full update: composer update",
          "   - For TYPO3 packages only: composer update typo3/cms-* --with-dependencies",
          "4. Watch for any error messages during the update process",
          "5. If dependencies cannot be resolved, you may need to update extensions first",
          "6. After completion, log in to the TYPO3 backend to verify the update",
          "7. Note: This step cannot be performed through the Admin Panel interface",
          "8. If you don't have command line access, please work with your hosting provider"
        ]
      },
      {
        title: "Check for extension compatibility",
        commands: upgradeMethod === 'console' ? [
          `# Check if any extensions are incompatible with TYPO3 ${toVersion}`,
          `composer prohibits typo3/cms-core ^${toVersion}`,
          "# List all installed packages",
          "composer show"
        ] : [
          "# Check extension compatibility in Extension Manager",
          "1. Log in to TYPO3 backend",
          "2. Navigate to Admin Tools > Extensions > Installed Extensions",
          "3. Look for extensions marked with warning or error icons",
          "4. Hover over any warning/error icons to see compatibility details",
          "5. For each incompatible extension, check if an update is available:",
          "   a. Go to Admin Tools > Extensions > Get Extensions",
          "   b. Search for the extension by key or name",
          "   c. Check if a compatible version is available",
          "6. Make a list of extensions that need updating or replacement",
          "7. For custom extensions, review code for compatibility issues",
          "8. Consider disabling non-critical extensions that cannot be updated",
          "9. Document decisions for each problematic extension"
        ]
      }
    ];
    
    // Steps specific to non-composer installation
    const nonComposerSteps = [
      {
        title: "Download and extract the new TYPO3 source",
        commands: upgradeMethod === 'console' ? [
          `# Download TYPO3 version ${toVersion}`,
          `wget https://get.typo3.org/${toVersion} -O typo3_src-${toVersion}.tar.gz`,
          `# Extract the archive`,
          `tar -xzf typo3_src-${toVersion}.tar.gz`,
          `# Remove the archive`,
          `rm typo3_src-${toVersion}.tar.gz`
        ] : [
          "# Manually download and extract TYPO3 source files",
          `1. Visit https://get.typo3.org/${toVersion} in your browser`,
          "2. Download the .tar.gz or .zip package to your computer",
          "3. Extract the archive on your local computer",
          `4. This creates a new directory called 'typo3_src-${toVersion}'`,
          "5. Using FTP, SFTP or your hosting control panel:",
          `   a. Upload the entire 'typo3_src-${toVersion}' directory to your web server`,
          `   b. Place it in the same directory as your current typo3_src directory`,
          "6. Ensure file permissions match your current installation",
          "7. Note: This step requires direct file system access to your server"
        ]
      },
      {
        title: "Update symlinks to point to new source",
        commands: upgradeMethod === 'console' ? [
          "# Backup existing symlink first",
          "mv typo3_src typo3_src_backup",
          "# Create new symlink to the new version",
          `ln -s typo3_src-${toVersion} typo3_src`,
          "# Verify the symlink was updated correctly",
          "ls -la typo3_src"
        ] : [
          "# Manually update symlinks on server",
          "1. Using FTP, SFTP or your hosting control panel:",
          "2. Rename your current 'typo3_src' symlink to 'typo3_src_backup'",
          `3. Create a new symlink named 'typo3_src' pointing to 'typo3_src-${toVersion}'`,
          "4. If your hosting doesn't support symlinks via FTP:",
          "   a. Edit your index.php and additional .php files in web root",
          `   b. Update all references from old TYPO3 source path to 'typo3_src-${toVersion}'`,
          "5. Verify by checking your TYPO3 backend version after changes",
          "6. Keep the backup for a few days until you confirm everything works",
          "7. Note: This step requires direct file system access to your server"
        ]
      },
      {
        title: "Clear all caches manually",
        commands: upgradeMethod === 'console' ? [
          "# Remove all cache files",
          "rm -rf typo3temp/var/cache/*",
          "# Clear additional temporary files",
          "rm -rf typo3temp/assets/*"
        ] : [
          "# Clear TYPO3 cache files manually",
          "1. Through the TYPO3 backend:",
          "   a. Navigate to Admin Tools > Maintenance > Flush Caches",
          "   b. Select and execute 'Flush all caches'",
          "2. If the backend is not accessible, manually clear caches via FTP:",
          "   a. Navigate to the typo3temp/var/cache/ directory",
          "   b. Delete all directories and files inside it",
          "   c. Also clear the typo3temp/assets/ directory",
          "3. Check the var/ directory for any lock files and remove them",
          "4. Reload the TYPO3 backend and verify it works correctly",
          "5. If you encounter a white screen, check web server error logs"
        ]
      },
      {
        title: "Update extensions",
        commands: upgradeMethod === 'console' ? [
          "# Note: In non-Composer mode, you'll need to update extensions through the Extension Manager",
          "# Access TYPO3 backend and go to Admin Tools > Extensions > Extension Manager",
          "# Or download extensions from https://extensions.typo3.org/ and install manually"
        ] : [
          "# Update extensions through the TYPO3 Extension Manager",
          "1. Log in to the TYPO3 backend",
          "2. Navigate to Admin Tools > Extensions > Get Extensions",
          "3. Click on the 'Update extension list' button (refresh icon)",
          "4. For each installed extension:",
          "   a. Check if updates are available (look for update icons)",
          "   b. Click the update icon next to extensions with available updates",
          "   c. Follow the update instructions for each extension",
          "5. For custom or local extensions:",
          "   a. Download compatible versions from https://extensions.typo3.org/",
          "   b. Go to Admin Tools > Extensions > Install Extensions",
          "   c. Upload the extension .zip files",
          "6. After updating all extensions:",
          "   a. Clear all caches again",
          "   b. Test functionality of updated extensions",
          "7. If an extension is not compatible, consider alternatives or disabling it"
        ]
      }
    ];
    
    // Steps based on version jump size
    const versionJumpSteps = [];
    
    if (majorVersionJump >= 2) {
      versionJumpSteps.push({
        title: "Review deprecation logs before upgrading",
        commands: upgradeMethod === 'console' ? [
          "grep -r 'deprecated' typo3temp/var/log/"
        ] : [
          "# Check deprecation logs in TYPO3 to identify potential issues",
          "1. Enable deprecation logging in Install Tool:",
          "   a. Navigate to Admin Tools > Settings > Configure Installation-Wide Options",
          "   b. Find [SYS][exceptionalErrors] and set it to 12290 to show deprecation notices",
          "   c. Save configuration changes",
          "2. Review deprecation logs:",
          "   a. Navigate to Admin Tools > Log > Deprecation Log",
          "   b. Look for deprecated function calls in your custom extensions",
          "   c. Make note of all deprecated functionality being used",
          "3. Check file-based logs:",
          "   a. Using FTP, navigate to typo3temp/var/log/ directory",
          "   b. Download and review any deprecation*.log files",
          "4. Create an action plan to address deprecated code before upgrading",
          "5. Reset exceptionalErrors to your normal production setting after gathering information"
        ]
      });
      versionJumpSteps.push({
        title: "Check for breaking changes in extensions",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer'
            ? "composer prohibits typo3/cms-core:^" + toVersion
            : "# Manual check required for extension compatibility"
        ] : [
          "# Thoroughly review extension compatibility with the target TYPO3 version",
          "1. Inventory all your installed extensions:",
          "   a. Navigate to Admin Tools > Extensions > Installed Extensions",
          "   b. Create a list of all extensions, noting custom vs. public extensions",
          "2. For each major extension, check compatibility:",
          "   a. Visit the extension documentation or GitHub repository",
          `   b. Verify if the extension officially supports TYPO3 ${toVersion}`,
          "   c. Look for any known issues with the target version",
          "3. For public extensions:",
          "   a. Check the TYPO3 Extension Repository at https://extensions.typo3.org/",
          `   b. Verify version compatibility with TYPO3 ${toVersion}`,
          "   c. Read release notes for breaking changes",
          "4. For custom extensions:",
          "   a. Review the code for TYPO3 API usage that might have changed",
          "   b. Check against TYPO3 upgrade documentation for breaking changes",
          "   c. Make a list of code changes needed",
          "5. Develop a mitigation plan for each extension with compatibility issues",
          "6. Consider creating test copies of critical extensions for pre-upgrade testing"
        ]
      });
    }
    
    if (majorVersionJump >= 1) {
      versionJumpSteps.push({
        title: "Update PHP to required version",
        commands: upgradeMethod === 'console' ? [
          "# Update PHP based on TYPO3 requirements",
          toMajor >= 12 ? "# PHP 8.1+ required for TYPO3 12+" :
          toMajor >= 11 ? "# PHP 7.4+ required for TYPO3 11+" :
          toMajor >= 10 ? "# PHP 7.2+ required for TYPO3 10+" :
          "# Check TYPO3 requirements for PHP version"
        ] : [
          "# Update PHP version to meet TYPO3 requirements",
          "1. Determine the minimum PHP version required:",
          toMajor >= 12 ? "   - TYPO3 12 requires PHP 8.1 or higher" :
          toMajor >= 11 ? "   - TYPO3 11 requires PHP 7.4 or higher" :
          toMajor >= 10 ? "   - TYPO3 10 requires PHP 7.2 or higher" :
          "   - Check TYPO3 requirements documentation for your target version",
          "2. Check your current PHP version in TYPO3 backend:",
          "   a. Navigate to Admin Tools > Environment > Environment Status",
          "   b. Look for the PHP Version entry",
          "3. To update PHP on your hosting:",
          "   a. For shared hosting: Contact your hosting provider to upgrade PHP",
          "   b. For managed servers: Use your hosting control panel (e.g., cPanel, Plesk)",
          "      - Look for 'PHP Version' or 'PHP Configuration'",
          "      - Select the appropriate PHP version",
          "   c. For dedicated servers: Update PHP through your server's package manager",
          "4. After updating PHP, check your extensions for PHP compatibility",
          "5. Return to TYPO3 backend and verify the new PHP version is detected correctly",
          "6. Clear all caches and test your website thoroughly"
        ]
      });
      versionJumpSteps.push({
        title: "Update extensions for compatibility",
        commands: upgradeMethod === 'console' ? [
          installType === 'composer'
            ? "composer update"
            : "# Manually update extensions from TER or Extension Manager"
        ] : [
          "# Update all extensions to versions compatible with the target TYPO3 version",
          "1. In the TYPO3 backend, navigate to Admin Tools > Extensions:",
          "2. For TER (TYPO3 Extension Repository) extensions:",
          "   a. Go to 'Get Extensions' section",
          "   b. Click 'Update extension list' to fetch latest versions",
          "   c. Look for extensions with update markers",
          "   d. Update each extension one by one",
          "   e. Test functionality after each update",
          "3. For locally modified extensions:",
          "   a. Create backups of your customizations",
          "   b. Download fresh versions from TER",
          "   c. Reapply your modifications carefully",
          "   d. Test thoroughly after each update",
          "4. For custom extensions:",
          "   a. Identify and fix any deprecated code usage",
          "   b. Update ext_emconf.php to indicate compatibility with new TYPO3 version",
          "   c. Test extension functionality thoroughly",
          "5. For extensions without compatible updates:",
          "   a. Look for alternative extensions with similar functionality",
          "   b. Consider if the extension is still necessary",
          "   c. Disable non-critical extensions that cannot be updated",
          "6. After all updates, clear caches and verify system functionality"
        ]
      });
    }
    
    // Combine steps based on installation type
    return [
      ...(installType === 'composer' ? composerSteps : nonComposerSteps),
      ...versionJumpSteps,
      ...commonSteps
    ];
  };
  
  const getUpgradeComplexity = (fromVersion, toVersion) => {
    const fromParts = fromVersion.split('.').map(Number);
    const toParts = toVersion.split('.').map(Number);
    
    const majorVersionJump = toParts[0] - fromParts[0];
    
    if (majorVersionJump >= 3) return 'Very High';
    if (majorVersionJump === 2) return 'High';
    if (majorVersionJump === 1) return 'Medium';
    return 'Low';
  };

  const getComplexityColor = (complexity) => {
    switch (complexity) {
      case 'Very High': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleGeneratePDF = () => {
    // First switch to list view mode
    setStepViewMode('list');
    
    // Expand all steps and substeps
    const newStepState = {};
    const newSubStepState = {};
    
    upgradePath.forEach((_, stepIndex) => {
      newStepState[stepIndex] = true;
      if (upgradePath[stepIndex]?.steps) {
        upgradePath[stepIndex].steps.forEach((_, subStepIndex) => {
          newSubStepState[`${stepIndex}-${subStepIndex}`] = true;
        });
      }
    });
    
    setExpandedSteps(newStepState);
    setExpandedSubSteps(newSubStepState);
    
    // Delay printing to allow DOM updates to complete
    setTimeout(() => {
      // Set page title for PDF
      const originalTitle = document.title;
      document.title = `TYPO3 Upgrade Path: ${currentVersion} to ${targetVersion}`;
      
      // Add metadata in print-only section
      const metadataElement = document.createElement('div');
      metadataElement.className = 'print-metadata';
      metadataElement.innerHTML = `
        <div style="display:none;" class="print:block print:mb-4">
          <h1 class="text-xl font-bold">TYPO3 ${upgradePath.some(step => step.isDowngrade) ? 'Downgrade' : 'Upgrade'} Guide</h1>
          <p>From version ${currentVersion} to ${targetVersion}</p>
          <p>Installation type: ${installationType === 'composer' ? 'Composer' : 'Non-Composer'}</p>
          <p>Upgrade method: ${currentUpgradeMethod === 'console' ? 'Console (Terminal)' : 'Admin Panel'}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <p>© ${new Date().getFullYear()} Macopedia</p>
        </div>
      `;
      
      const container = document.querySelector('.max-w-3xl');
      container.prepend(metadataElement);
      
      // Print/save as PDF
      window.print();
      
      // Cleanup
      setTimeout(() => {
        document.title = originalTitle;
        container.removeChild(metadataElement);
      }, 100);
    }, 1000); // Increased delay to 1000ms to ensure DOM updates
  };
  
  // Toggle step expansion
  const toggleStepExpansion = (stepIndex) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepIndex]: !prev[stepIndex]
    }));
  };

  // Check if a step is expanded
  const isStepExpanded = (stepIndex) => {
    // Default to expanded if not set
    return expandedSteps[stepIndex] !== false;
  };

  // Toggle substep expansion
  const toggleSubStepExpansion = (stepIndex, subStepIndex) => {
    const key = `${stepIndex}-${subStepIndex}`;
    setExpandedSubSteps(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check if a substep is expanded
  const isSubStepExpanded = (stepIndex, subStepIndex) => {
    const key = `${stepIndex}-${subStepIndex}`;
    // Default to expanded if not set
    return expandedSubSteps[key] !== false;
  };

  // Helper function to generate the composer command with extensions
  const generateUpgradeCommand = (toVersion, extensionsList) => {
    // Start with the basic command for the core
    let command = `composer require typo3/cms-core:"^${toVersion}"`;
    
    if (extensionsList && extensionsList.length > 0) {
      // Add each extension to the command if available
      const addedExtensions = [];
      
      // Add TYPO3 system extensions first
      extensionsList.forEach(ext => {
        if (ext.Vendor === 'typo3' && ext.ExtensionKey !== 'core') {
          const packageName = `typo3/cms-${ext.ExtensionKey}`;
          command += ` ${packageName}`;
          addedExtensions.push(packageName);
        }
      });

      // Add third-party extensions
      extensionsList.forEach(ext => {
        if (ext.Vendor !== 'typo3' && ext.ExtensionKey !== 'core') {
          let packageName;
          
          // Special case for typo3-console
          if (ext.ExtensionKey === 'helhum/typo3-console' || ext.ExtensionKey === 'typo3-console') {
            packageName = 'helhum/typo3-console';
          }
          // Handle extensions with vendor
          else if (ext.Vendor && ext.ExtensionKey) {
            packageName = `${ext.Vendor}/${ext.ExtensionKey.toLowerCase()}`;
          }
          
          // Add package to command if we have a valid name and it's not already added
          if (packageName && !addedExtensions.includes(packageName)) {
            command += ` ${packageName}`;
            addedExtensions.push(packageName);
          }
        }
      });
    }
    
    // Add the with-all-dependencies flag
    command += ' -W';
    
    return command;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 print:shadow-none print:p-0">
      <div className="max-w-3xl mx-auto">
        {/* PDF Header - Only visible when printing */}
        <div className="hidden print:block print:mb-8 print:border-b print:border-gray-300 print:pb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-black">TYPO3 {upgradePath.some(step => step.isDowngrade) ? 'Downgrade' : 'Upgrade'} Path</h1>
              <p className="text-gray-600">From version {currentVersion} to {targetVersion}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Generated: {new Date().toLocaleDateString()}</p>
              <p className="text-sm text-gray-600">Installation type: {installationType === 'composer' ? 'Composer' : 'Non-Composer'}</p>
              <p className="text-sm text-gray-600">© {new Date().getFullYear()} Macopedia</p>
            </div>
          </div>
        </div>
        
        <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2 print:text-black">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-orange-600 print:text-black">
            <path d="M12 5v14"></path>
            <path d="m19 12-7 7-7-7"></path>
          </svg>
          Version Upgrade Path
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 print:hidden">
          <div>
            <label htmlFor="current-version" className="block text-sm font-medium text-gray-700 mb-2">
              Current TYPO3 Version
            </label>
            <div className="relative">
              <select
                id="current-version"
                value={currentVersion}
                onChange={(e) => setCurrentVersion(e.target.value)}
                className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white appearance-none"
              >
                <option value="">Select version</option>
                {typo3Versions.map(version => (
                  <option key={version.version} value={version.version}>
                    {version.version}{version.lts ? ' LTS' : ''} {version.eolDate < new Date().toISOString().split('T')[0] ? '(EOL)' : ''}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">Your current installed TYPO3 version</p>
          </div>
          
          <div>
            <label htmlFor="target-version" className="block text-sm font-medium text-gray-700 mb-2">
              Target TYPO3 Version
            </label>
            <div className="relative">
              <select
                id="target-version"
                value={targetVersion}
                onChange={(e) => setTargetVersion(e.target.value)}
                className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white appearance-none"
              >
                <option value="">Select version</option>
                {typo3Versions.map(version => (
                  <option key={version.version} value={version.version}>
                    {version.version}{version.lts ? ' LTS' : ''} {version.eolDate < new Date().toISOString().split('T')[0] ? '(EOL)' : ''}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500">The version you want to upgrade to</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Installation Type:</span>
            <div className="flex border border-gray-300 rounded-md">
              <button 
                onClick={() => setInstallationType('composer')}
                className={`px-3 py-1.5 text-sm ${installationType === 'composer' ? 'bg-orange-100 text-orange-700 border-orange-500' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Composer
              </button>
              <button 
                onClick={() => setInstallationType('non-composer')}
                className={`px-3 py-1.5 text-sm border-l ${installationType === 'non-composer' ? 'bg-orange-100 text-orange-700 border-orange-500' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Non-Composer
              </button>
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              id="allow-downgrade"
              type="checkbox"
              checked={allowDowngrade}
              onChange={() => setAllowDowngrade(!allowDowngrade)}
              className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label htmlFor="allow-downgrade" className="ml-2 text-sm text-gray-700">
              Allow Downgrade Path (not recommended)
            </label>
          </div>
        </div>
        
        {/* Upgrade Method selector - HIGHLIGHTED */}
        <div className="mb-8 bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
          <h3 className="text-md font-semibold text-orange-700 mb-3">Choose Upgrade Method:</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex border border-gray-300 rounded-md bg-white">
              <button 
                onClick={() => setCurrentUpgradeMethod('console')}
                className={`px-4 py-2 text-sm font-medium ${currentUpgradeMethod === 'console' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Console Upgrade
              </button>
              <button 
                onClick={() => setCurrentUpgradeMethod('admin-panel')}
                className={`px-4 py-2 text-sm font-medium border-l ${currentUpgradeMethod === 'admin-panel' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Admin Panel Upgrade
              </button>
            </div>
            <div className="text-sm text-gray-600">
              <strong className="text-gray-700">Currently selected:</strong> {currentUpgradeMethod === 'console' 
                ? 'Terminal-based upgrade (requires server access)' 
                : 'TYPO3 Admin Panel interface (no terminal required)'}
            </div>
          </div>
        </div>
        
        {/* Original Upgrade Method selector - hidden in case it's still needed elsewhere */}
        <div className="mb-8 hidden">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Upgrade Method:</span>
            <div className="flex border border-gray-300 rounded-md">
              <button 
                onClick={() => setCurrentUpgradeMethod('console')}
                className={`px-3 py-1.5 text-sm ${currentUpgradeMethod === 'console' ? 'bg-orange-100 text-orange-700 border-orange-500' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Console Upgrade
              </button>
              <button 
                onClick={() => setCurrentUpgradeMethod('admin-panel')}
                className={`px-3 py-1.5 text-sm border-l ${currentUpgradeMethod === 'admin-panel' ? 'bg-orange-100 text-orange-700 border-orange-500' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Admin Panel Upgrade
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500 ml-24">
            {currentUpgradeMethod === 'console' 
              ? 'Terminal-based upgrade process with direct file access' 
              : 'Upgrade through the TYPO3 Admin Panel interface'}
          </p>
        </div>
        
        {isCalculating ? (
          <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg print:hidden">
            <div className="w-8 h-8 border-4 border-t-orange-600 border-b-orange-600 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
            <p className="ml-3 text-gray-600">Calculating upgrade path...</p>
          </div>
        ) : upgradePath.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8 print:border-0">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 print:bg-white">
              <h3 className="text-base font-medium text-gray-700 print:text-black">
                {upgradePath.some(step => step.isDowngrade) ? 'Downgrade Path' : 'Upgrade Path'}
              </h3>
            </div>
            
            <div className="p-4">
              {upgradePath.some(step => step.isError) ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4 print:border-black print:bg-white">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Error calculating upgrade path
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <ul className="list-disc pl-5 space-y-1">
                          {upgradePath.filter(step => step.isError).map((step, index) => (
                            <li key={index}>{step.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : upgradePath.some(step => step.isWarning) ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4 print:border-black print:bg-white">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Upgrade Note
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>{upgradePath.find(step => step.isWarning)?.message}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100 print:border-black">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20 print:bg-white print:border print:border-black print:text-black">
                        {upgradePath.length} Step{upgradePath.length !== 1 ? 's' : ''}
                      </span>
                      {upgradePath.some(step => step.isDowngrade) && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 print:bg-white print:border print:border-black print:text-black">
                          Downgrade
                        </span>
                      )}
                      <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 print:bg-white print:border print:border-black print:text-black">
                        {installationType === 'composer' ? 'Composer' : 'Non-Composer'}
                      </span>
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 print:bg-white print:border print:border-black print:text-black">
                        {currentUpgradeMethod === 'console' ? 'Console' : 'Admin Panel'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const allExpanded = Object.values(expandedSteps).every(value => value);
                          
                          // Create new state for main steps
                          const newStepState = {};
                          upgradePath.forEach((_, index) => {
                            newStepState[index] = !allExpanded;
                          });
                          
                          // Create new state for substeps
                          const newSubStepState = {};
                          upgradePath.forEach((step, stepIndex) => {
                            if (step.steps) {
                              step.steps.forEach((_, subStepIndex) => {
                                newSubStepState[`${stepIndex}-${subStepIndex}`] = !allExpanded;
                              });
                            }
                          });
                          
                          setExpandedSteps(newStepState);
                          setExpandedSubSteps(newSubStepState);
                        }}
                        className="text-orange-600 hover:text-orange-800 text-xs font-medium flex items-center gap-1"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          {Object.values(expandedSteps).every(value => value) ? (
                            <>
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </>
                          ) : (
                            <>
                              <polyline points="15 18 9 12 15 6"></polyline>
                            </>
                          )}
                        </svg>
                        {Object.values(expandedSteps).every(value => value) ? 'Collapse All' : 'Expand All'}
                      </button>
                      
                      {/* Toggle view mode button */}
                      <button
                        onClick={toggleViewMode}
                        className="text-orange-600 hover:text-orange-800 text-xs font-medium flex items-center gap-1 ml-4"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-4 w-4" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          {stepViewMode === 'list' ? (
                            // Step by step icon
                            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                          ) : (
                            // List icon
                            <path d="M3 14h18M3 6h18M3 10h18" />
                          )}
                        </svg>
                        {stepViewMode === 'list' ? 'Step-by-step Mode' : 'List Mode'}
                      </button>
                      
                      <div className="text-sm text-gray-500 print:text-black">
                        TYPO3 {currentVersion} → {targetVersion}
                      </div>
                    </div>
                  </div>
                  
                  {/* Admin Panel Notice */}
                  {currentUpgradeMethod === 'admin-panel' && (
                    <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-800">Admin Panel Upgrade Mode</h3>
                          <div className="mt-2 text-sm text-blue-700">
                            <p>These instructions will guide you through the TYPO3 upgrade process using the TYPO3 Admin Panel wherever possible. Some steps may still require command line access.</p>
                            <p className="mt-1">Follow each step in sequence for the best results.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="relative">
                    {stepViewMode === 'list' ? (
                      <div>
                        {upgradePath.map((step, index) => (
                          <div key={index} className="mb-8 relative">
                            {/* Vertical line connecting steps */}
                            {index < upgradePath.length - 1 && (
                              <div className="absolute left-4 top-8 w-0.5 bg-gray-200 h-full -z-10 print:bg-gray-500" />
                            )}
                            <div className="flex">
                              <div className="flex-shrink-0 bg-white">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                  step.isDowngrade ? 'border-red-500 bg-red-50' :
                                  step.complexity === 'Low' ? 'border-green-500 bg-green-50' : 
                                  step.complexity === 'Medium' ? 'border-yellow-500 bg-yellow-50' : 
                                  'border-red-500 bg-red-50'
                                } print:border-black print:bg-white`}>
                                  <span className="text-xs font-bold">{index + 1}</span>
                                </div>
                              </div>
                              <div className="ml-4 flex-1">
                                <div className={`p-4 border rounded-lg ${step.isDowngrade ? 'bg-red-50 text-red-800 border-red-200' : getComplexityColor(step.complexity)} print:border-black print:bg-white print:text-black`}>
                                  <div 
                                    className="flex justify-between items-start mb-2 cursor-pointer hover:opacity-80 transition-opacity group"
                                    onClick={() => toggleStepExpansion(index)}
                                  >
                                    <h4 className="text-base font-semibold group-hover:underline">
                                      {step.from} → {step.to}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white bg-opacity-60 print:border print:border-black">
                                        {step.isDowngrade ? 'Downgrade' : `${step.complexity} Complexity`}
                                      </span>
                                      <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        className={`h-5 w-5 transition-transform ${isStepExpanded(index) ? 'rotate-180' : ''}`} 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                      >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                      </svg>
                                    </div>
                                  </div>
                                  
                                  {isStepExpanded(index) && (
                                    <>
                                      {step.breaking && (
                                        <div className="mb-3 text-xs font-medium text-amber-800 flex items-center print:text-black">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                                          </svg>
                                          Contains breaking changes
                                        </div>
                                      )}
                            
                                      <div className="mt-4">
                                        <h5 className="text-sm font-medium mb-2">Required Steps:</h5>
                                        <div className="space-y-4">
                                          {step.steps && step.steps.map((subStep, subIndex) => (
                                            <div key={subIndex} className="border border-gray-200 rounded-md overflow-hidden print:border-black">
                                              <div 
                                                className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-sm font-medium text-gray-700 print:bg-white print:border-black print:text-black flex justify-between items-center cursor-pointer hover:bg-gray-100"
                                                onClick={(e) => {
                                                  e.stopPropagation(); // Prevent toggling the parent step
                                                  toggleSubStepExpansion(index, subIndex);
                                                }}
                                              >
                                                <span>{subStep.title}</span>
                                                <svg 
                                                  xmlns="http://www.w3.org/2000/svg" 
                                                  className={`h-4 w-4 transition-transform ${isSubStepExpanded(index, subIndex) ? 'rotate-180' : ''}`} 
                                                  viewBox="0 0 24 24" 
                                                  fill="none" 
                                                  stroke="currentColor" 
                                                  strokeWidth="2" 
                                                  strokeLinecap="round" 
                                                  strokeLinejoin="round"
                                                >
                                                  <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                              </div>
                                              {isSubStepExpanded(index, subIndex) && (
                                                <div className="bg-gray-800 p-3 space-y-1 print:bg-white print:border-t print:border-black">
                                                  {subStep.commands.map((cmd, cmdIndex) => (
                                                    <div key={cmdIndex} className="relative group">
                                                      <div className={`font-mono text-xs ${
                                                        currentUpgradeMethod === 'console' 
                                                          ? 'text-green-400 bg-gray-900'
                                                          : 'text-blue-600 bg-blue-50 border border-blue-200'
                                                      } rounded p-2 overflow-x-auto flex items-start print:text-black print:bg-gray-100 print:p-1`}>
                                                        {currentUpgradeMethod === 'console' && (
                                                          <span className="text-gray-500 mr-2 select-none">$</span>
                                                        )}
                                                        <span>{cmd}</span>
                                                      </div>
                                                      <button 
                                                        onClick={(e) => {
                                                          e.stopPropagation(); // Prevent toggling the step
                                                          copyToClipboard(cmd);
                                                        }}
                                                        className={`absolute top-1 right-1 p-1 rounded ${
                                                          currentUpgradeMethod === 'console'
                                                            ? 'bg-gray-700 text-gray-300 opacity-0 group-hover:opacity-100'
                                                            : 'bg-blue-100 text-blue-700 opacity-0 group-hover:opacity-100'
                                                        } transition-opacity hover:bg-gray-600 print:hidden`}
                                                        aria-label="Copy command"
                                                      >
                                                        {copiedCommand === cmd ? (
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M20 6 9 17l-5-5" />
                                                          </svg>
                                                        ) : (
                                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                          </svg>
                                                        )}
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      {step.isDowngrade && step.warnings && (
                                        <div className="mt-4 bg-red-100 p-3 rounded-md print:bg-white print:border print:border-black">
                                          <h5 className="text-sm font-medium mb-1 text-red-800 print:text-black">Warnings:</h5>
                                          <ul className="list-disc ml-5 text-sm space-y-1 text-red-800 print:text-black">
                                            {step.warnings.map((warning, wIndex) => (
                                              <li key={wIndex}>{warning}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      {/* Publication information */}
                                      {step.publishInfo && (
                                        <div className="mt-4 bg-blue-50 p-3 rounded-md print:bg-white print:border print:border-black">
                                          <h5 className="text-sm font-medium mb-1 text-blue-800 flex items-center print:text-black">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <circle cx="12" cy="12" r="10" />
                                              <line x1="12" y1="16" x2="12" y2="12" />
                                              <line x1="12" y1="8" x2="12.01" y2="8" />
                                            </svg>
                                            Publication Status
                                          </h5>
                                          <p className="text-sm text-blue-800 print:text-black mt-1">
                                            {step.publishInfo.message}
                                          </p>
                                        </div>
                                      )}
                                      
                                      {/* Add official TYPO3 link for the last step */}
                                      {index === upgradePath.length - 1 && (
                                        <div className="mt-4 bg-green-50 p-3 rounded-md print:bg-white print:border print:border-black">
                                          <h5 className="text-sm font-medium mb-1 text-green-800 flex items-center print:text-black">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <circle cx="12" cy="12" r="10" />
                                              <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            Next Steps
                                          </h5>
                                          <p className="text-sm text-green-800 print:text-black mt-1 mb-2">
                                            After completing all the upgrade steps, visit the official TYPO3 documentation for more detailed information.
                                          </p>
                                          <a 
                                            href="https://docs.typo3.org/m/typo3/guide-installation/main/en-us/Upgrade/UpgradingToSpecificVersions/Index.html" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-800"
                                          >
                                            TYPO3 Official Upgrade Guide
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                              <polyline points="15 3 21 3 21 9" />
                                              <line x1="10" y1="14" x2="21" y2="3" />
                                            </svg>
                                          </a>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main content area - takes 2/3 of the space */}
                        <div className="lg:col-span-2">
                          {upgradePath[currentStepIndex] && (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
                              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                                <h4 className="text-lg font-semibold">
                                  {upgradePath[currentStepIndex].from} → {upgradePath[currentStepIndex].to}
                                </h4>
                                <div className="flex items-center">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    upgradePath[currentStepIndex].isDowngrade 
                                      ? 'bg-red-100 text-red-700' 
                                      : upgradePath[currentStepIndex].complexity === 'Low' 
                                        ? 'bg-green-100 text-green-700' 
                                        : upgradePath[currentStepIndex].complexity === 'Medium' 
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-red-100 text-red-700'
                                  }`}>
                                    {upgradePath[currentStepIndex].isDowngrade ? 'Downgrade' : `${upgradePath[currentStepIndex].complexity} Complexity`}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="p-6">
                                {upgradePath[currentStepIndex].breaking && (
                                  <div className="mb-4 px-4 py-2 bg-amber-50 border-l-2 border-amber-500 text-sm text-amber-800">
                                    <div className="flex items-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                                      </svg>
                                      This upgrade contains breaking changes
                                    </div>
                                  </div>
                                )}
                                
                                {/* Admin Panel Notice in step-by-step view */}
                                {currentUpgradeMethod === 'admin-panel' && currentStepIndex === 0 && currentSubStepIndex === 0 && (
                                  <div className="mb-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
                                    <div className="flex">
                                      <div className="flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                          <line x1="3" y1="9" x2="21" y2="9" />
                                          <line x1="9" y1="21" x2="9" y2="9" />
                                        </svg>
                                      </div>
                                      <div className="ml-3">
                                        <h3 className="text-sm font-medium text-blue-800">Admin Panel Upgrade Mode</h3>
                                        <div className="mt-2 text-sm text-blue-700">
                                          <p>These instructions will guide you through the TYPO3 upgrade process using the TYPO3 Admin Panel wherever possible. Some steps may still require command line access.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Display current sub-step */}
                                {upgradePath[currentStepIndex].steps && upgradePath[currentStepIndex].steps[currentSubStepIndex] && (
                                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                                      <h5 className="font-medium">
                                        {currentSubStepIndex + 1}. {upgradePath[currentStepIndex].steps[currentSubStepIndex].title}
                                      </h5>
                                    </div>
                                    
                                    <div className="p-4">
                                      <div className={`${currentUpgradeMethod === 'console' ? 'bg-gray-800' : 'bg-blue-50 border border-blue-200'} p-3 space-y-3 rounded-md`}>
                                        {upgradePath[currentStepIndex].steps[currentSubStepIndex].commands.map((cmd, cmdIndex) => (
                                          <div key={cmdIndex} className="relative group">
                                            <div className={`font-mono text-xs ${currentUpgradeMethod === 'console' ? 'text-green-400 bg-gray-900' : 'text-blue-600 bg-white'} rounded p-2 overflow-x-auto flex items-start`}>
                                              {currentUpgradeMethod === 'console' && (
                                                <span className="text-gray-500 mr-2 select-none">$</span>
                                              )}
                                              <span>{cmd}</span>
                                            </div>
                                            <button 
                                              onClick={() => copyToClipboard(cmd)}
                                              className={`absolute top-1 right-1 p-1 rounded ${currentUpgradeMethod === 'console' ? 'bg-gray-700 text-gray-300' : 'bg-blue-100 text-blue-600'} opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100`}
                                              aria-label="Copy command"
                                            >
                                              {copiedCommand === cmd ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                              ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                              )}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      
                                      {upgradePath[currentStepIndex].steps[currentSubStepIndex].description && (
                                        <p className="mt-3 text-sm text-gray-600">
                                          {upgradePath[currentStepIndex].steps[currentSubStepIndex].description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Warning messages if downgrading */}
                                {upgradePath[currentStepIndex].isDowngrade && upgradePath[currentStepIndex].warnings && (
                                  <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                                    <h5 className="text-sm font-medium mb-2 text-red-800">Warnings:</h5>
                                    <ul className="list-disc ml-5 text-sm space-y-1 text-red-800">
                                      {upgradePath[currentStepIndex].warnings.map((warning, wIndex) => (
                                        <li key={wIndex}>{warning}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {/* Publication information */}
                                {upgradePath[currentStepIndex].publishInfo && (
                                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <h5 className="text-sm font-medium mb-2 text-blue-800 flex items-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                      </svg>
                                      Publication Status
                                    </h5>
                                    <p className="ml-7 text-sm text-blue-700">
                                      {upgradePath[currentStepIndex].publishInfo.message}
                                    </p>
                                  </div>
                                )}
                                
                                {/* Link to official TYPO3 upgrade documentation */}
                                {currentStepIndex === upgradePath.length - 1 && 
                                 (!upgradePath[currentStepIndex].steps || 
                                  currentSubStepIndex === upgradePath[currentStepIndex].steps.length - 1) && (
                                  <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
                                    <h5 className="text-sm font-medium mb-2 text-green-800 flex items-center">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      Next Steps
                                    </h5>
                                    <p className="ml-7 text-sm text-green-700 mb-2">
                                      You have completed all the upgrade steps. For more detailed information, visit the official TYPO3 upgrade documentation.
                                    </p>
                                    <a 
                                      href={`https://docs.typo3.org/m/typo3/guide-installation/main/en-us/Upgrade/UpgradingToSpecificVersions/Index.html`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="ml-7 inline-flex items-center text-sm font-medium text-green-600 hover:text-green-800"
                                    >
                                      TYPO3 Official Upgrade Guide
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                      </svg>
                                    </a>
                                  </div>
                                )}
                                
                                {/* Navigation buttons */}
                                <div className="mt-6 flex justify-between">
                                  <button 
                                    onClick={goToPreviousStep}
                                    disabled={currentStepIndex === 0 && currentSubStepIndex === 0}
                                    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
                                      currentStepIndex === 0 && currentSubStepIndex === 0 
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M19 12H5" />
                                      <path d="M12 19l-7-7 7-7" />
                                    </svg>
                                    Previous
                                  </button>
                                  
                                  <button 
                                    onClick={goToNextStep}
                                    disabled={
                                      currentStepIndex === upgradePath.length - 1 && 
                                      (!upgradePath[currentStepIndex].steps || 
                                       currentSubStepIndex === upgradePath[currentStepIndex].steps.length - 1)
                                    }
                                    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
                                      currentStepIndex === upgradePath.length - 1 && 
                                      (!upgradePath[currentStepIndex].steps || 
                                       currentSubStepIndex === upgradePath[currentStepIndex].steps.length - 1)
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                        : 'bg-orange-500 text-white hover:bg-orange-600'
                                    }`}
                                  >
                                    Next
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M5 12h14" />
                                      <path d="M12 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Progress information */}
                          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-md">
                            <div className="flex items-start">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500 mt-0.5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4" />
                                <path d="M12 16h.01" />
                              </svg>
                              <div>
                                <h5 className="text-sm font-medium text-orange-800">Upgrade Progress</h5>
                                <p className="mt-1 text-sm text-orange-700">
                                  Step {getCurrentStepNumber()} of {getTotalSteps()} total steps
                                </p>
                                <p className="mt-1 text-sm text-orange-700">
                                  Follow each step carefully to ensure a smooth upgrade process.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Right sidebar for navigation - takes 1/3 of the space */}
                        <div className="lg:col-span-1">
                          <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-4 overflow-y-auto max-h-[calc(100vh-2rem)]">
                            <h4 className="text-base font-medium mb-4 border-b pb-2">Upgrade Steps</h4>
                            
                            <div className="space-y-2">
                              {upgradePath.map((step, stepIndex) => (
                                <div key={stepIndex} className="mb-2">
                                  <div 
                                    className={`flex items-start p-2 rounded-md transition-colors ${
                                      currentStepIndex === stepIndex ? 'bg-orange-50 border-l-2 border-orange-500' : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mr-2 ${
                                      step.steps && step.steps.every((_, subIdx) => isStepCompleted(stepIndex, subIdx))
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-gray-200 text-gray-700'
                                    }`}>
                                      {stepIndex + 1}
                                    </div>
                                    <button 
                                      onClick={() => goToStep(stepIndex, 0)}
                                      className="text-left font-medium hover:text-orange-600 text-sm w-full min-w-0"
                                    >
                                      <span className="block truncate">{step.from} → {step.to}</span>
                                      {step.complexity && (
                                        <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full ${
                                          step.isDowngrade ? 'bg-red-100 text-red-700' :
                                          step.complexity === 'Low' ? 'bg-green-100 text-green-700' :
                                          step.complexity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          {step.isDowngrade ? 'Downgrade' : `${step.complexity} Complexity`}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  
                                  {/* Sub-steps */}
                                  {currentStepIndex === stepIndex && step.steps && (
                                    <div className="ml-8 mt-2 space-y-1 border-l-2 border-gray-100">
                                      {step.steps.map((subStep, subIndex) => (
                                        <button
                                          key={subIndex}
                                          onClick={() => goToStep(stepIndex, subIndex)}
                                          className={`w-full text-left text-sm py-2 px-3 rounded-r flex items-start gap-2 transition-colors ${
                                            currentStepIndex === stepIndex && currentSubStepIndex === subIndex 
                                              ? 'bg-orange-100 text-orange-800 border-l-2 border-orange-500 -ml-[2px]' 
                                              : isStepCompleted(stepIndex, subIndex) 
                                                ? 'text-gray-400 hover:bg-gray-50' 
                                                : 'text-gray-600 hover:bg-gray-50'
                                          }`}
                                        >
                                          {isStepCompleted(stepIndex, subIndex) && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <path d="M20 6 9 17l-5-5" />
                                            </svg>
                                          )}
                                          <span className="flex-1 min-w-0">
                                            <span className="font-mono mr-1">{subIndex + 1}.</span>
                                            <span className="break-words">{subStep.title}</span>
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {/* Progress bar */}
                            <div className="mt-6 border-t pt-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500">Progress</span>
                                <span className="text-xs font-medium">{Math.floor((getCurrentStepNumber() / getTotalSteps()) * 100)}%</span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-2 bg-orange-500 rounded-full transition-all duration-300" 
                                  style={{ width: `${Math.floor((getCurrentStepNumber() / getTotalSteps()) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center sm:justify-end print:hidden">
          {upgradePath.length > 0 && !(upgradePath.some(step => step.isError) || upgradePath.some(step => step.isWarning)) && (
            <button 
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              onClick={handleGeneratePDF}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="M12 17v-6" />
                <path d="M9 14h6" />
              </svg>
              Download PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
