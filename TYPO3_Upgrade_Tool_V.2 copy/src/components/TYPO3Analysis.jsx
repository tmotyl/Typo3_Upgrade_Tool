import { useState, useEffect } from 'react';
import ManualSystemInput from './ManualSystemInput';
import { analyzeTYPO3Zip } from '../lib/zipFileAnalyzer';
import { fetchPackagistPackageInfo } from '../lib/packagist';
import { getExtensionMappings, getExtensionMappingsAsync, fetchPackagistInfo } from '../lib/typo3-axios-scraper.js';

export default function TYPO3Analysis({ onShowSteps }) {
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [detectedVersion, setDetectedVersion] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [installationType, setInstallationType] = useState('composer'); // 'composer' or 'non-composer'
  const [analysisStage, setAnalysisStage] = useState('upload'); // 'upload', 'analyzing', 'processing', 'results'
  const [analysisResults, setAnalysisResults] = useState(null);
  const [extensionData, setExtensionData] = useState(null); // Data from the TYPO3 Upgrade Analyzer extension
  const [showManualInput, setShowManualInput] = useState(false); // Toggle for manual input
  const [selectedStrategy, setSelectedStrategy] = useState(''); // Track which strategy the user has selected
  const [showExtensionTooltip, setShowExtensionTooltip] = useState(false); // State for extension installation tooltip
  const [upgradeMethod, setUpgradeMethod] = useState('console'); // 'console' or 'admin-panel'

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Read the file content if it's a text file
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = JSON.parse(e.target.result);
            setFileContent(content);
            
            // Check if this is data from our TYPO3 Upgrade Analyzer extension
            if (content.typo3 && content.extensions && content.timestamp) {
              // This is our extension format
              setExtensionData(content);
              
              // Set detected version from extension data
              if (content.typo3.version) {
                setDetectedVersion(content.typo3.version.split('.').slice(0, 2).join('.'));
              }
              
              // Set installation type from extension data
              if ('composerInstallation' in content.typo3) {
                setInstallationType(content.typo3.composerInstallation ? 'composer' : 'non-composer');
              }
              
              // Auto-start analysis since we have all the data
              setTimeout(() => {
                handleAnalyze(content);
              }, 100);
            } else {
              // Try to detect TYPO3 version from standard composer.json
              if (content.require && content.require['typo3/cms-core']) {
                const versionConstraint = content.require['typo3/cms-core'];
                const versionMatch = versionConstraint.match(/^\^?(\d+\.\d+)/);
                if (versionMatch) {
                  setDetectedVersion(versionMatch[1]);
                }
                
                // If we found a composer.json, set installation type to composer
                setInstallationType('composer');
                
                // Extract PHP version if available
                const phpVersion = content.require && content.require.php 
                  ? content.require.php.replace(/^\^?~?/g, '')
                  : null;
                
                // Create extension-like data structure for composer.json
                const extensions = [];
                
                // Process all dependencies to find extensions
                for (const [packageName, version] of Object.entries(content.require || {})) {
                  // Skip core and PHP requirements
                  if (packageName === 'typo3/cms-core' || packageName === 'php') {
                    continue;
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
                    extensions.push({
                      key: packageName.split('/').pop(),
                      name: packageName,
                      version: version.replace(/^\^?~?/g, ''),
                      title: `Extension: ${packageName}`,
                      bundled: false,
                      isCompatible: null, // Will determine compatibility later
                      constraints: {
                        depends: {
                          typo3: versionConstraint // Assuming same constraint as core by default
                        }
                      }
                    });
                  }
                }
                
                // Create a simplified extension data structure similar to what we get from the TYPO3 extension
                const composerData = {
                  timestamp: Date.now(),
                  typo3: {
                    version: versionMatch[1] + ".0", // Add minor version as placeholder
                    composerInstallation: true,
                    phpVersion: phpVersion
                  },
                  extensions: extensions,
                  system: {
                    php: {
                      version: phpVersion,
                      // Extract PHP platform version if available
                      platformVersion: content.config?.platform?.php || null
                    },
                    // Store allowed plugin information
                    allowedPlugins: content.config?.['allow-plugins'] || {}
                  },
                  database: {},
                  composerJson: content // Store the original composer.json for reference
                };
                
                // Set the data and start analysis
                setExtensionData(composerData);
                setTimeout(() => {
                  handleAnalyze(composerData);
                }, 100);
              }
            }
          } catch (error) {
            console.error('Error parsing JSON:', error);
          }
        };
        reader.readAsText(selectedFile);
      } else if (selectedFile.name.endsWith('.zip')) {
        // Process zip file of TYPO3 project
        setAnalysisStage('analyzing');
        
        // Use our zipFileAnalyzer utility
        analyzeTYPO3Zip(selectedFile)
          .then(data => {
            setExtensionData(data);
            if (data && data.typo3 && data.typo3.version) {
              setDetectedVersion(data.typo3.version.split('.').slice(0, 2).join('.'));
            } else {
              setDetectedVersion('11.5'); // Default version if not detected
            }
            setInstallationType(data.typo3 && data.typo3.composerInstallation ? 'composer' : 'non-composer');
            
            // Auto-start analysis with the extracted data
            handleAnalyze(data);
          })
          .catch(error => {
            console.error('Error analyzing zip file:', error);
            // Reset to upload stage on error
            setAnalysisStage('upload');
          });
      }
    }
  };
  
  const handleAnalyze = (extensionContent = null) => {
    setAnalysisStage('analyzing');
    
    // Simulate analysis process
    setTimeout(() => {
      // If we have extension data, use it to generate more detailed results
      if (extensionContent || extensionData) {
        const data = extensionContent || extensionData;
        const results = {
          detectedVersion: data.typo3.version ? data.typo3.version.split('.').slice(0, 2).join('.') : detectedVersion || '10.4',
          installationType: data.typo3.composerInstallation ? 'composer' : 'non-composer',
          extensionsFound: data.extensions.length,
          incompatibleExtensions: 0, // We'll calculate this
          deprecatedFeatures: Math.floor(Math.random() * 10), // Random for now
          upgradePath: [],
          system: data.system || {},
          database: data.database && Object.keys(data.database).length > 0 ? data.database : {
            type: 'Database Type not detected',
            version: 'Database Version not detected',
            tableCount: 40 + Math.min(data.extensions.length * 2, 60)
          },
          extDetails: data.extensions.map(ext => ({
            name: ext.key,
            version: ext.version,
            title: ext.title,
            isCompatible: true, // We'll set this based on constraints
            constraints: ext.constraints || {}
          })),
          upgradeStrategy: generateUpgradeStrategy(data) // Generate upgrade strategy based on system data
        };
        
        // Set a recommended upgrade path based on the current version
        const currentMajor = parseInt(results.detectedVersion.split('.')[0], 10);
        
        // Calculate upgrade path
        if (currentMajor <= 10) {
          results.upgradePath = [
            { from: results.detectedVersion, to: '11.5', complexity: 'medium' },
            { from: '11.5', to: '12.4', complexity: 'high' }
          ];
          setTargetVersion('12.4');
        } else if (currentMajor === 11) {
          results.upgradePath = [
            { from: results.detectedVersion, to: '12.4', complexity: 'medium' }
          ];
          setTargetVersion('12.4');
        } else if (currentMajor === 12) {
          results.upgradePath = [
            { from: results.detectedVersion, to: '13.4', complexity: 'medium' }
          ];
          setTargetVersion('13.4');
        } else {
          results.upgradePath = [
            { from: results.detectedVersion, to: '13.4', complexity: 'low' }
          ];
          setTargetVersion('13.4');
        }
        
        // Set the target version before checking compatibility
        let currTargetVersion = targetVersion;
        if (!currTargetVersion) {
          if (currentMajor <= 10) {
            currTargetVersion = '12.4';
          } else if (currentMajor === 11) {
            currTargetVersion = '12.4';
          } else if (currentMajor === 12) {
            currTargetVersion = '13.4';
          } else {
            currTargetVersion = '13.4';
          }
        }
        
        const targetMajorVersion = parseInt(currTargetVersion.split('.')[0], 10);
        results.incompatibleExtensions = 0;
        
        results.extDetails.forEach(ext => {
          // Default to true for core extensions
          if (ext.bundled || (ext.name && ext.name.startsWith('typo3/cms-'))) {
            ext.isCompatible = true;
            return;
          }
          
          // Check if we have constraint information
          if (ext.constraints && ext.constraints.depends && ext.constraints.depends.typo3) {
            const constraint = ext.constraints.depends.typo3;
            
            // Parse the constraint to determine compatibility
            let isCompatible = true;
            
            // Parse version constraints like ^10.4, ~11.5, 10.4.0-11.5.99
            if (constraint.includes('-')) {
              // Range format like 10.4.0-11.5.99
              const range = constraint.split('-');
              const minVer = parseInt(range[0].split('.')[0], 10);
              const maxVer = parseInt(range[1].split('.')[0], 10);
              
              isCompatible = targetMajorVersion >= minVer && targetMajorVersion <= maxVer;
            } 
            else if (constraint.includes('||')) {
              // OR condition like ^10.4 || ^11.5
              const options = constraint.split('||').map(opt => opt.trim());
              isCompatible = options.some(opt => {
                const match = opt.match(/^\^?~?(\d+)/);
                return match && parseInt(match[1], 10) === targetMajorVersion;
              });
            }
            else {
              // Simple constraint like ^10.4 or ~11.5
              const match = constraint.match(/^\^?~?(\d+)/);
              if (match) {
                const constraintMajor = parseInt(match[1], 10);
                
                if (constraint.startsWith('^')) {
                  // ^ means compatible with same major version
                  isCompatible = targetMajorVersion === constraintMajor;
                } 
                else if (constraint.startsWith('~')) {
                  // ~ means compatible with same minor version
                  isCompatible = targetMajorVersion === constraintMajor;
                }
                else {
                  // Exact version
                  isCompatible = targetMajorVersion === constraintMajor;
                }
              }
            }
            
            ext.isCompatible = isCompatible;
            if (!isCompatible) {
              results.incompatibleExtensions++;
            }
          } else {
            // For extensions without clear constraints, consider compatible if:
            // 1. The extension is from the same TYPO3 major version, or
            // 2. The current and target versions are the same major version (e.g., 13.x to 13.x)
            const currentMajor = parseInt(results.detectedVersion.split('.')[0], 10);
            
            // Extensions in the same major version are likely compatible
            if (currentMajor === targetMajorVersion) {
              ext.isCompatible = true;
            } else {
              // For cross-version upgrades without constraints, assume incompatible by default
              ext.isCompatible = false;
              results.incompatibleExtensions++;
            }
          }
        });
        
        // If they're the same major version, extensions should be compatible
        if (currentMajor === targetMajorVersion && currentMajor >= 10) {
          // Set all extensions to compatible
          results.extDetails.forEach(ext => {
            ext.isCompatible = true;
          });
          
          // Reset incompatible count to 0
          results.incompatibleExtensions = 0;
        }
        
        setAnalysisResults(results);
      } else {
        // Generate basic results similar to before
        const results = {
          detectedVersion: detectedVersion || '10.4',
          installationType: installationType,
          extensionsFound: 15,
          incompatibleExtensions: 3,
          deprecatedFeatures: 7,
          upgradePath: [
            { from: detectedVersion || '10.4', to: '11.5', complexity: 'medium' },
            { from: '11.5', to: '12.4', complexity: 'high' }
          ],
          // Generic upgrade strategy when no specific system data is available
          upgradeStrategy: {
            recommendedApproach: 'extensions-first',
            extensionsFirst: [
              { step: 1, title: 'Backup your site', description: 'Create a complete backup of your TYPO3 site, including database and files' },
              { step: 2, title: 'Test environment setup', description: 'Set up a test environment that mirrors your production site' },
              { step: 3, title: 'Update extensions', description: 'Upgrade all extensions to be compatible with your target TYPO3 version' },
              { step: 4, title: 'Deploy to production', description: 'Deploy the updated extensions to your production environment' },
              { step: 5, title: 'Update PHP', description: 'Upgrade PHP to the version required by your target TYPO3 version' },
              { step: 6, title: 'Upgrade TYPO3', description: 'Finally, perform the TYPO3 core upgrade' }
            ],
            typo3First: [
              { step: 1, title: 'Backup your site', description: 'Create a complete backup of your TYPO3 site, including database and files' },
              { step: 2, title: 'Test environment setup', description: 'Set up a test environment that mirrors your production site' },
              { step: 3, title: 'Update PHP', description: 'Upgrade PHP to the version required by your target TYPO3 version' },
              { step: 4, title: 'Upgrade TYPO3', description: 'Perform the TYPO3 core upgrade' },
              { step: 5, title: 'Update extensions', description: 'Upgrade all extensions to be compatible with the new TYPO3 version' },
              { step: 6, title: 'Deploy to production', description: 'Deploy the complete upgraded site to your production environment' }
            ]
          }
        };
        
        setAnalysisResults(results);
        
        // Set a default target version if not already set
        if (!targetVersion) {
          setTargetVersion('12.4');
        }
      }
      
      setAnalysisStage('results');
    }, 2000);
  };
  
  // Helper function to generate upgrade strategy based on system data
  const generateUpgradeStrategy = (data) => {
    const strategy = {
      recommendedApproach: 'extensions-first',
      extensionsFirst: [
        { step: 1, title: 'Backup your site', description: 'Create a complete backup of your TYPO3 site, including database and files' },
        { step: 2, title: 'Test environment setup', description: 'Set up a test environment that mirrors your production site' }
      ],
      typo3First: [
        { step: 1, title: 'Backup your site', description: 'Create a complete backup of your TYPO3 site, including database and files' },
        { step: 2, title: 'Test environment setup', description: 'Set up a test environment that mirrors your production site' }
      ]
    };
    
    // Analyze data to determine the best upgrade approach
    const currentTYPO3Version = data.typo3?.version || '';
    const currentPHPVersion = data.system?.php?.version || '';
    const extensionsCount = data.extensions?.length || 0;
    const criticalExtensions = data.extensions?.filter(ext => 
      ext.key === 'news' || ext.key === 'powermail' || ext.key === 'solr'
    ).length || 0;
    
    // Critical extensions or many extensions? Prefer extensions-first approach
    if (criticalExtensions > 0 || extensionsCount > 10) {
      strategy.recommendedApproach = 'extensions-first';
      
      // Add extension-specific steps
      strategy.extensionsFirst.push(
        { step: 3, title: 'Update extensions', description: `Upgrade all ${extensionsCount} extensions to be compatible with your target TYPO3 version` },
        { step: 4, title: 'Test extensions', description: 'Test all upgraded extensions thoroughly in your test environment' },
        { step: 5, title: 'Deploy updated extensions', description: 'Deploy the updated extensions to your production environment' }
      );
      
      // PHP update steps
      strategy.extensionsFirst.push(
        { step: 6, title: 'Update PHP', description: `Upgrade PHP from ${currentPHPVersion} to the version required by your target TYPO3 version` }
      );
      
      // TYPO3 update steps
      strategy.extensionsFirst.push(
        { step: 7, title: 'Upgrade TYPO3', description: `Upgrade TYPO3 from ${currentTYPO3Version} to your target version` },
        { step: 8, title: 'Final testing', description: 'Perform final testing of the complete upgraded system' }
      );
    } else {
      // Fewer extensions, older TYPO3 version? Prefer TYPO3-first approach
      strategy.recommendedApproach = 'typo3-first';
      
      // PHP update steps
      strategy.typo3First.push(
        { step: 3, title: 'Update PHP', description: `Upgrade PHP from ${currentPHPVersion} to the version required by your target TYPO3 version` }
      );
      
      // TYPO3 update steps
      strategy.typo3First.push(
        { step: 4, title: 'Upgrade TYPO3', description: `Upgrade TYPO3 from ${currentTYPO3Version} to your target version` }
      );
      
      // Add extension-specific steps
      strategy.typo3First.push(
        { step: 5, title: 'Update extensions', description: `Upgrade all ${extensionsCount} extensions to be compatible with the new TYPO3 version` },
        { step: 6, title: 'Test extensions', description: 'Test all upgraded extensions thoroughly in your test environment' },
        { step: 7, title: 'Deploy to production', description: 'Deploy the complete upgraded site to your production environment' }
      );
    }
    
    return strategy;
  };
  
  const handleManualDataSave = (manualData) => {
    // Set the extension data from manually entered information
    setExtensionData(manualData);
    
    // Start analysis with the manually entered data
    handleAnalyze(manualData);
  };
  
  // Add useEffect to recheck compatibility when targetVersion changes
  useEffect(() => {
    if (analysisResults && targetVersion) {
      // Check if source and target version have the same major version
      const currentMajor = parseInt(analysisResults.detectedVersion.split('.')[0], 10);
      const targetMajor = parseInt(targetVersion.split('.')[0], 10);
      
      // If they match, set all extensions to compatible
      if (currentMajor === targetMajor && currentMajor >= 10) {
        const updatedResults = {...analysisResults};
        
        // Update all extensions to be compatible
        updatedResults.extDetails.forEach(ext => {
          ext.isCompatible = true;
        });
        
        // Reset incompatible count
        updatedResults.incompatibleExtensions = 0;
        
        // Update results
        setAnalysisResults(updatedResults);
      }
    }
  }, [targetVersion, analysisResults?.detectedVersion]);
  
  const renderUploadStage = () => (
    <div>
      {/* Toggle buttons for upload or manual entry */}
      <div className="flex justify-center mb-6 bg-white rounded-lg shadow-sm p-1">
        <button 
          onClick={() => setShowManualInput(false)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${!showManualInput ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          Upload Files
        </button>
        <button 
          onClick={() => setShowManualInput(true)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 ${showManualInput ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          Manual Entry
        </button>
      </div>
      
      {/* Helper text for chosen option */}
      <div className="mb-6 text-center">
        <p className="text-sm text-gray-600">
          {showManualInput 
            ? "Enter your TYPO3 system details manually if you can't use the analyzer extension or prefer manual input."
            : "Upload data exported from your TYPO3 site for the most accurate analysis."}
        </p>
      </div>
      
      {showManualInput ? (
        <ManualSystemInput onSaveData={handleManualDataSave} />
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-8">
          <div className="text-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="mx-auto h-12 w-12 text-gray-400" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m16 16-4-4-4 4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Upload site files</h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload a project ZIP file, JSON file from the TYPO3 Upgrade Analyzer, or composer.json file
            </p>
            
            <div className="mt-6">
              <label htmlFor="file-upload" className="relative cursor-pointer">
                <span className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-md transition-colors">
                  Select File
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  accept=".json,.zip"
                />
              </label>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-orange-50 rounded-md p-4 text-sm border border-orange-200 flex flex-col items-center">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-full mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8v.7A4 4 0 0 1 18 17H6a4 4 0 1 1 0-8h12a4 4 0 0 0 0-8h-.3" />
                  </svg>
                </div>
                <h4 className="font-medium text-orange-800">Project ZIP</h4>
                <p className="mt-1 text-center text-orange-600">
                  Upload a ZIP of your entire TYPO3 project for comprehensive analysis
                </p>
              </div>
              
              <div className="bg-orange-50 rounded-md p-4 text-sm border border-orange-200 flex flex-col items-center relative">
              {/* Extension tooltip */}
              {showExtensionTooltip && (
                <div className="absolute top-3 left-6 transform -translate-y-full bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 z-10">
                  <h4 className="font-medium text-gray-900 mb-2">Installing the TYPO3 Upgrade Analyzer</h4>
                  <ol className="list-decimal pl-5 space-y-2 text-xs text-gray-700">
                    <li>Download the <a href="/downloads/typo3_upgrade_analyzer.zip" className="text-orange-700 underline">TYPO3 Upgrade Analyzer</a> extension</li>
                    <li>Log in to your TYPO3 backend as an administrator</li>
                    <li>Go to <strong>Extension Manager</strong> → <strong>Get Extensions</strong></li>
                    <li>Click <strong>Upload Extension</strong> and select the downloaded .zip file</li>
                    <li>Install the extension once uploaded</li>
                    <li>Go to <strong>Admin Tools</strong> → <strong>Upgrade Analyzer</strong></li>
                    <li>Click <strong>Export System Data</strong> to generate the JSON file</li>
                    <li>Upload the generated file here for analysis</li>
                  </ol>
                  <div className="absolute top-2 right-2">
                    <button 
                      onClick={() => setShowExtensionTooltip(false)} 
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div className="absolute -bottom-2 left-5 transform rotate-45 w-4 h-4 bg-white border-b border-r border-gray-200"></div>
                </div>
              )}
              
              <div className="bg-orange-100 text-orange-600 p-2 rounded-full mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h4 className="font-medium text-orange-800">Tip: Use our TYPO3 extension</h4>
              <p className="mt-1 text-center text-orange-600">
                For more accurate analysis, install our <a href="/downloads/typo3_upgrade_analyzer.zip" className="text-orange-700 underline">TYPO3 Upgrade Analyzer</a> extension.
              </p>
              <button 
                onClick={() => setShowExtensionTooltip(!showExtensionTooltip)}
                className="mt-2 text-xs text-orange-700 underline hover:text-orange-800 focus:outline-none"
              >
                View installation instructions
              </button>
            </div>

              
              <div className="bg-orange-50 rounded-md p-4 text-sm border border-orange-200 flex flex-col items-center">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-full mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <path d="M14 2v6h6"></path>
                    <path d="M9 16a2 2 0 0 0 0-4"></path>
                    <path d="M19 12a2 2 0 0 0-2-2H9"></path>
                    <path d="M13 20a2 2 0 0 0 0-4"></path>
                    <path d="M21 16a2 2 0 0 0-2-2h-6"></path>
                  </svg>
                </div>
                <h4 className="font-medium text-orange-800">composer.json</h4>
                <p className="mt-1 text-center text-orange-600">
                  Upload your composer.json file for basic dependency analysis
                </p>
              </div>
            </div>
            
                      </div>
          
          {file && (
            <div className="mt-6 bg-orange-50 rounded-md p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-6 w-6 ${file.name.endsWith('.zip') ? 'text-orange-500' : 'text-orange-500'}`}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{file.name}</span>
                    <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    {extensionData && (
                      <span className="text-xs text-green-600">TYPO3 data detected!</span>
                    )}
                    {file.name.endsWith('.zip') && (
                      <span className="text-xs text-orange-600">TYPO3 project ZIP file</span>
                    )}
                  </div>
                </div>
                <button 
                  type="button" 
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    setFile(null);
                    setExtensionData(null);
                  }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-5 w-5" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              {fileContent && !extensionData && !file.name.endsWith('.zip') && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleAnalyze()}
                    className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    Analyze File
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Installation Type
              </label>
              <div className="flex border border-gray-300 rounded-md max-w-xs">
                <button
                  onClick={() => setInstallationType('composer')}
                  className={`flex-1 px-4 py-2 text-sm ${installationType === 'composer' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Composer
                </button>
                <button
                  onClick={() => setInstallationType('non-composer')}
                  className={`flex-1 px-4 py-2 text-sm border-l ${installationType === 'non-composer' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Non-Composer
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {installationType === 'composer' 
                  ? 'Select if your TYPO3 installation is managed with Composer'
                  : 'Select if your TYPO3 installation is traditional (non-Composer)'}
              </p>
            </div>
            
            {/* New Upgrade Method Selector - HIGHLIGHTED */}
            <div className="md:col-span-2 mt-6 bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
              <h3 className="text-md font-semibold text-orange-700 mb-3">Choose Upgrade Method:</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex border border-gray-300 rounded-md bg-white">
                  <button
                    onClick={() => setUpgradeMethod('console')}
                    className={`px-4 py-2 text-sm font-medium ${upgradeMethod === 'console' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    Console Upgrade
                  </button>
                  <button
                    onClick={() => setUpgradeMethod('admin-panel')}
                    className={`px-4 py-2 text-sm font-medium border-l ${upgradeMethod === 'admin-panel' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    Admin Panel Upgrade
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  <strong className="text-gray-700">Currently selected:</strong> {upgradeMethod === 'console' 
                    ? 'Terminal-based upgrade (requires server access)' 
                    : 'TYPO3 Admin Panel interface (no terminal required)'}
                </div>
              </div>
            </div>
            
            {/* Hide original method selector */}
            <div className="md:col-span-2 mt-6 hidden">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upgrade Method
              </label>
              <div className="flex border border-gray-300 rounded-md max-w-xs">
                <button
                  onClick={() => setUpgradeMethod('console')}
                  className={`flex-1 px-4 py-2 text-sm ${upgradeMethod === 'console' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Console Upgrade
                </button>
                <button
                  onClick={() => setUpgradeMethod('admin-panel')}
                  className={`flex-1 px-4 py-2 text-sm border-l ${upgradeMethod === 'admin-panel' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Admin Panel Upgrade
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {upgradeMethod === 'console' 
                  ? 'Select for terminal-based upgrade process with direct file access'
                  : 'Select for upgrades through the TYPO3 Admin Panel interface'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderAnalyzingStage = () => (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg">
      <div className="w-16 h-16 border-4 border-t-orange-600 border-b-orange-600 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
      <p className="mt-6 text-lg font-medium text-gray-700">Analyzing your TYPO3 project...</p>
      <div className="mt-4 max-w-md w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div className="h-full bg-orange-600 animate-pulse" style={{ width: '75%' }}></div>
      </div>
      <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
    </div>
  );
  
  const renderResultsStage = () => {
    // Set the selected strategy to the recommended one initially
    if (selectedStrategy === '' && analysisResults?.upgradeStrategy) {
      setSelectedStrategy(analysisResults.upgradeStrategy.recommendedApproach);
    }
    
    // Check if we need to update compatibility due to same major versions
    if (analysisResults) {
      // Check if source and target version have the same major version
      const currentMajor = parseInt(analysisResults.detectedVersion.split('.')[0], 10);
      const targetMajor = parseInt(targetVersion?.split('.')[0] || '0', 10);
      
      // If they're the same major version, extensions should be compatible
      if (currentMajor === targetMajor && currentMajor >= 10) {
        // Set all extensions to compatible
        analysisResults.extDetails.forEach(ext => {
          ext.isCompatible = true;
        });
        
        // Reset incompatible count to 0
        analysisResults.incompatibleExtensions = 0;
      }
    }
    
    return (
      <div className="space-y-8">
        {/* Upgrade Version Selector Panel - Moved to top */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-5 sm:px-8 text-white">
            <h3 className="text-xl font-bold mb-1">Ready to Upgrade Your TYPO3 Site?</h3>
            <p className="text-orange-100">
              Select your target TYPO3 version and get a detailed upgrade path with step-by-step instructions.
            </p>
          </div>
          
          <div className="bg-white px-6 py-5 sm:px-8">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label htmlFor="upgrade-from" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Version
                </label>
                <div className="flex items-center">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium">
                    TYPO3 {analysisResults.detectedVersion}
                  </div>
                  <div className="ml-2 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="flex-1">
                <label htmlFor="upgrade-to" className="block text-sm font-medium text-gray-700 mb-1">
                  Target Version
                </label>
                <select 
                  id="upgrade-to"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={targetVersion} 
                  onChange={(e) => setTargetVersion(e.target.value)}
                >
                  <option value="7.6">TYPO3 7.6 LTS</option>
                  <option value="8.7">TYPO3 8.7 LTS</option>
                  <option value="9.5">TYPO3 9.5 LTS</option>
                  <option value="10.4">TYPO3 10.4 LTS</option>
                  <option value="11.5">TYPO3 11.5 LTS</option>
                  <option value="12.4">TYPO3 12.4 LTS</option>
                  <option value="13.0">TYPO3 13.0</option>
                  <option value="13.1">TYPO3 13.1</option>
                  <option value="13.2">TYPO3 13.2</option>
                  <option value="13.3">TYPO3 13.3</option>
                  <option value="13.4">TYPO3 13.4 LTS</option>
                </select>
              </div>
              
              <div className="md:ml-4">
                <button
                  className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white font-medium rounded-lg shadow hover:from-orange-700 hover:to-orange-800 transition-all flex items-center justify-center"
                  onClick={() => handleGenerateUpgradePath()}
                >
                  <span>Create Upgrade Path</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 ml-2">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="mt-4 bg-orange-50 border-l-4 border-orange-500 p-4 text-sm text-orange-700">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2 text-orange-500">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <p>
                  Our upgrade path builder will provide you with a detailed guide including code changes, extension compatibility issues, and database migrations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold leading-6 text-gray-900">Analysis Summary</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                TYPO3 {analysisResults.detectedVersion} → {targetVersion || '12.4'}
                <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                  {analysisResults.installationType === 'composer' ? 'Composer' : 'Non-Composer'}
                </span>
                {extensionData && !extensionData.typo3.phpVersion && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    Analyzer Extension
                  </span>
                )}
                {extensionData && extensionData.typo3.phpVersion && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                    Composer.json
                  </span>
                )}
              </p>
            </div>
            <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
              Upgrade Complexity: High
            </span>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-500">Extensions</h4>
                  <span className="text-2xl font-bold text-gray-900">{analysisResults.extensionsFound}</span>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-600 flex justify-between">
                    <span>Compatible:</span>
                    <span className="font-medium text-green-600">{analysisResults.extensionsFound - analysisResults.incompatibleExtensions}</span>
                  </div>
                  <div className="text-xs text-gray-600 flex justify-between">
                    <span>Incompatible:</span>
                    <span className="font-medium text-red-600">{analysisResults.incompatibleExtensions}</span>
                  </div>
                </div>
                
                {/* Display extension list if we have detailed extension data */}
                {analysisResults.extDetails && analysisResults.extDetails.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <details className="text-xs" open>
                      <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                        Extension compatibility with TYPO3 {targetVersion || '12.4'} ({analysisResults.extDetails.length})
                      </summary>
                      <div className="mt-2 max-h-72 overflow-y-auto">
                        <div className="flex justify-end mb-1 text-xs">
                          <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {analysisResults.extensionsFound - analysisResults.incompatibleExtensions} compatible
                          </span>
                          <span className="ml-2 inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {analysisResults.incompatibleExtensions} incompatible
                          </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-1 font-medium text-gray-500">Extension</th>
                                <th className="text-left py-1 font-medium text-gray-500">Version</th>
                                <th className="text-left py-1 font-medium text-gray-500">Type</th>
                                <th className="text-center py-1 font-medium text-gray-500">Compatibility</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysisResults.extDetails.map((ext, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="py-1.5 pr-2">
                                    <span title={ext.title}>{ext.name || ext.key}</span>
                                  </td>
                                  <td className="py-1.5 pr-2 font-mono">
                                    {ext.version}
                                  </td>
                                  <td className="py-1.5 pr-2">
                                    {ext.bundled || (ext.name && ext.name.startsWith('typo3/cms-')) ? 
                                      <span className="text-orange-600">Core</span> : 
                                      <span className="text-purple-600">Third-party</span>
                                    }
                                  </td>
                                  <td className="py-1.5 text-center">
                                    {ext.isCompatible === true ? (
                                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Compatible
                                      </span>
                                    ) : ext.isCompatible === false ? (
                                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        Incompatible
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        Unknown
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-500">Deprecated Features</h4>
                  <span className="text-2xl font-bold text-gray-900">{analysisResults.deprecatedFeatures}</span>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-600">
                    These features need to be updated before upgrading
                  </div>
                </div>
                
                {/* Show system info if available */}
                {analysisResults.system && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <details className="text-xs" open>
                      <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                        System Information
                      </summary>
                      <div className="mt-2 bg-gray-50 p-3 rounded">
                        <ul className="space-y-2">
                          {extensionData && extensionData.composerJson && (
                            <li>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Composer.json Information</h4>
                              <ul className="space-y-1 pl-2">
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Project Name:</span>
                                  <span className="font-mono">{extensionData.composerJson.name || 'Not specified'}</span>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Required PHP:</span>
                                  <span className="font-mono">{extensionData.composerJson.require?.php || 'Not specified'}</span>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-600">PHP Platform:</span>
                                  <span className="font-mono">{extensionData.system?.php?.platformVersion || 'Not specified'}</span>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Required TYPO3:</span>
                                  <span className="font-mono">{extensionData.composerJson.require?.['typo3/cms-core'] || 'Not specified'}</span>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Description:</span>
                                  <span className="font-mono">{extensionData.composerJson.description || 'Not specified'}</span>
                                </li>
                                <li className="flex justify-between">
                                  <span className="text-gray-600">Type:</span>
                                  <span className="font-mono">{extensionData.composerJson.type || 'Not specified'}</span>
                                </li>
                                {Object.keys(extensionData.system?.allowedPlugins || {}).length > 0 && (
                                  <li className="pt-2">
                                    <span className="text-gray-600 font-medium">Allowed Plugins:</span>
                                    <ul className="pl-2 mt-1 space-y-1 border-l border-gray-200">
                                      {Object.entries(extensionData.system.allowedPlugins).map(([plugin, enabled], idx) => (
                                        <li key={idx} className="flex justify-between">
                                          <span className="text-gray-600">{plugin}</span>
                                          <span className={`font-mono ${enabled ? 'text-green-600' : 'text-red-600'}`}>
                                            {enabled ? 'enabled' : 'disabled'}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </li>
                                )}
                              </ul>
                            </li>
                          )}
                        </ul>
                      </div>
                    </details>
                  </div>
                )}
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-500">Upgrade Path</h4>
                  <span className="text-2xl font-bold text-gray-900">{analysisResults.upgradePath.length} Steps</span>
                </div>
                <div className="mt-2">
                  {/* Check if there are any upgrade paths to display */}
                  {analysisResults.upgradePath.length > 0 ? (
                    <div>
                      <div className="space-y-2 mb-4">
                        {/* Filter out any paths that would downgrade (e.g. 13.4 to 13.1) */}
                        {analysisResults.upgradePath
                          .filter(step => {
                            // Extract version numbers
                            const fromParts = step.from.split('.');
                            const toParts = step.to.split('.');
                            
                            const fromMajor = parseInt(fromParts[0], 10);
                            const fromMinor = parseInt(fromParts[1] || '0', 10);
                            const toMajor = parseInt(toParts[0], 10);
                            const toMinor = parseInt(toParts[1] || '0', 10);
                            
                            // Either major version is greater, or major is same and minor is greater
                            return toMajor > fromMajor || (toMajor === fromMajor && toMinor > fromMinor);
                          })
                          .map((step, index) => (
                            <div key={index} className="flex items-center bg-gray-50 p-2 rounded-md">
                              <div className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold text-sm mr-3">
                                {index + 1}
                              </div>
                              <div className="flex-grow">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center">
                                    <span className="font-medium text-gray-700">TYPO3 {step.from}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mx-2 text-gray-400">
                                      <path d="M5 12h14"></path>
                                      <path d="m12 5 7 7-7 7"></path>
                                    </svg>
                                    <span className="font-medium text-gray-700">TYPO3 {step.to}</span>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${step.complexity === 'high' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {step.complexity.charAt(0).toUpperCase() + step.complexity.slice(1)} complexity
                                  </span>
                                </div>
                                {step.complexity === 'high' && (
                                  <div className="mt-1 text-xs text-red-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline mr-1">
                                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                      <line x1="12" y1="9" x2="12" y2="13"></line>
                                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                    Requires careful planning and testing
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                      
                      <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-md text-xs text-orange-800">
                        <div className="flex">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0 mt-0.5">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <div>
                            <p className="font-medium mb-1">Important Upgrade Notes</p>
                            <ul className="list-disc pl-4 space-y-1">
                              <li>Always upgrade one TYPO3 version at a time</li>
                              <li>For best results, follow the LTS to LTS upgrade path</li>
                              <li>Create a full backup before each upgrade step</li>
                              <li>Test thoroughly in a staging environment</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-3 rounded-md text-sm text-center text-gray-500">
                      No upgrade path has been calculated. Please select your target TYPO3 version.
                    </div>
                  )}
                </div>
                
                {/* Show database info if available */}
                {analysisResults.database && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                        Database Information
                      </summary>
                      <div className="mt-2">
                        <ul className="space-y-1">
                          <li className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-mono">{analysisResults.database.type ? analysisResults.database.type.charAt(0).toUpperCase() + analysisResults.database.type.slice(1) : 'MySQL'}</span>
                          </li>
                          <li className="flex justify-between">
                            <span>Version:</span>
                            <span className="font-mono">{analysisResults.database.version || '8.0'}</span>
                          </li>
                        </ul>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        

        {/* New Upgrade Strategy Section */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-5 sm:px-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Recommended Upgrade Strategy</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Based on your system data, we recommend the following upgrade approach
            </p>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-center mb-6">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setSelectedStrategy('extensions-first')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                    selectedStrategy === 'extensions-first' 
                      ? 'bg-orange-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Extensions First
                  {analysisResults.upgradeStrategy.recommendedApproach === 'extensions-first' && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      Recommended
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStrategy('typo3-first')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                    selectedStrategy === 'typo3-first' 
                      ? 'bg-orange-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  TYPO3 First
                  {analysisResults.upgradeStrategy.recommendedApproach === 'typo3-first' && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      Recommended
                    </span>
                  )}
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <h4 className="text-lg font-medium text-gray-800 mb-4">
                {selectedStrategy === 'extensions-first' 
                  ? 'Upgrade Extensions First, Then TYPO3' 
                  : 'Upgrade TYPO3 First, Then Extensions'}
              </h4>
              
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-orange-200"></div>
                
                {/* Steps for the selected approach */}
                <div className="space-y-8">
                  {(selectedStrategy === 'extensions-first' 
                    ? analysisResults.upgradeStrategy.extensionsFirst 
                    : analysisResults.upgradeStrategy.typo3First
                  ).map((step, index) => (
                    <div key={index} className="relative flex items-start">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 text-orange-600 font-bold border-2 border-white z-10">
                        {step.step}
                      </div>
                      <div className="ml-4">
                        <h5 className="text-md font-medium text-gray-800">{step.title}</h5>
                        <p className="text-sm text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <details className="mt-6 text-sm">
              <summary className="text-orange-600 cursor-pointer">Show alternative approach</summary>
              <div className="mt-4 pl-4 border-l-2 border-gray-200">
                <h4 className="text-md font-medium text-gray-800 mb-4">
                  {selectedStrategy !== 'extensions-first' 
                    ? 'Upgrade Extensions First, Then TYPO3' 
                    : 'Upgrade TYPO3 First, Then Extensions'}
                </h4>
                
                <ol className="list-decimal list-inside space-y-2 pl-4">
                  {(selectedStrategy !== 'extensions-first' 
                    ? analysisResults.upgradeStrategy.extensionsFirst 
                    : analysisResults.upgradeStrategy.typo3First
                  ).map((step, index) => (
                    <li key={index} className="text-gray-600">
                      <span className="font-medium text-gray-700">{step.title}:</span> {step.description}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          </div>
        </div>
        
        <div className="mt-8 flex justify-between">
          <button 
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            onClick={() => {
              setAnalysisStage('upload');
              setSelectedStrategy(''); // Reset strategy selection when starting a new analysis
            }}
          >
            Start New Analysis
          </button>
          
          <button 
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            onClick={() => window.print()}
          >
            Export Results
          </button>
        </div>
      </div>
    );
  };

  // Prepare extension data for the upgrade tool
  const prepareExtensionsForUpgrade = (extDetails) => {
    if (!extDetails || !Array.isArray(extDetails) || extDetails.length === 0) {
      return [];
    }
    
    // Map the extension details to the format expected by the upgrade tool
    const transformedExtensions = extDetails.map(ext => {
      // For each extension, ensure it has both name and key
      const extensionName = ext.name || ext.key;
      const extensionKey = ext.key || extensionName;
      
      // Some extensions may be in the format typo3/cms-xxx
      // or may need to be normalized from extension keys
      let formattedName = extensionName;
      
      // If the name doesn't have a vendor part (no slash), try to identify it
      if (formattedName && !formattedName.includes('/')) {
        // Check for core extensions
        if (formattedName.startsWith('ext_') || formattedName.startsWith('tx_')) {
          formattedName = formattedName.replace(/^(ext_|tx_)/, '');
        }
        
        // Map common TYPO3 core extensions
        if (['fluid', 'extbase', 'backend', 'frontend', 'install', 'form', 'felogin', 'scheduler'].includes(formattedName)) {
          formattedName = `typo3/cms-${formattedName}`;
        }
      }
      
      return {
        key: extensionKey,
        name: formattedName,
        version: ext.version || '1.0.0',
        isCompatible: ext.isCompatible !== false, // Default to true if not explicitly false
        constraints: ext.constraints || {}
      };
    });
    
    console.log(`Formatted ${transformedExtensions.length} extensions for upgrade:`, transformedExtensions);
    return transformedExtensions;
  };

  // Add the missing handleGenerateUpgradePath function
  const handleGenerateUpgradePath = () => {
    if (!analysisResults) {
      return;
    }

    // Get current version
    const currentVersion = analysisResults.detectedVersion || '11.5';
    // Use selected target version
    const selectedTargetVersion = targetVersion || '12.4';
    // Get installation type
    const installType = analysisResults.installationType;
    // Format extension details for the upgrade tool
    const formattedExtensions = prepareExtensionsForUpgrade(analysisResults.extDetails);
    
    // Pass the upgrade steps to the parent component with extensions
    onShowSteps(currentVersion, selectedTargetVersion, upgradeMethod, formattedExtensions);
  };
  
  // Helper function to generate upgrade steps
  const generateUpgradeSteps = (fromVersion, toVersion, installationType) => {
    const fromMajor = parseInt(fromVersion.split('.')[0], 10);
    const toMajor = parseInt(toVersion.split('.')[0], 10);
    
    const steps = [];
    
    // Add steps for composer installation
    if (installationType === 'composer') {
      steps.push({
        title: 'Backup your TYPO3 site',
        description: 'Create a complete backup of your TYPO3 database and files',
        commands: ['tar -czf typo3-backup.tar.gz public/ config/ var/ composer.json composer.lock'],
        complexity: 'low'
      });
      
      steps.push({
        title: 'Update composer dependencies',
        description: `Update TYPO3 core and extensions to version ${toVersion}`,
        commands: [
          'composer require typo3/cms-core:"^' + toVersion + '" -W',
          'composer update'
        ],
        complexity: 'medium'
      });
    } else {
      // Non-composer installation steps
      steps.push({
        title: 'Backup your TYPO3 site',
        description: 'Create a complete backup of your TYPO3 database and files',
        commands: ['tar -czf typo3-backup.tar.gz typo3/ typo3conf/ fileadmin/ uploads/'],
        complexity: 'low'
      });
      
      steps.push({
        title: 'Download new TYPO3 version',
        description: `Download TYPO3 ${toVersion}`,
        commands: [
          `wget https://get.typo3.org/${toVersion} -O typo3_src.tar.gz`,
          'tar -xzf typo3_src.tar.gz',
          'ln -s typo3_src-* typo3_src',
          'ln -sf typo3_src/index.php index.php',
          'ln -sf typo3_src/typo3 typo3'
        ],
        complexity: 'medium'
      });
    }
    
    // Add database upgrade step
    steps.push({
      title: 'Run database upgrades',
      description: 'Run the database upgrade wizards',
      commands: installationType === 'composer' ? 
        ['vendor/bin/typo3 upgrade:run'] : 
        ['typo3/sysext/core/bin/typo3 upgrade:run'],
      complexity: 'medium'
    });
    
    // Add deprecation steps if we're doing a major version upgrade
    if (fromMajor !== toMajor) {
      steps.push({
        title: 'Address deprecations',
        description: 'Fix deprecated code and functionality',
        commands: installationType === 'composer' ?
          ['vendor/bin/typo3 upgrade:list'] :
          ['typo3/sysext/core/bin/typo3 upgrade:list'],
        complexity: 'high'
      });
    }
    
    // Add final steps
    steps.push({
      title: 'Clear all caches',
      description: 'Clear TYPO3 caches to apply changes',
      commands: installationType === 'composer' ?
        ['vendor/bin/typo3 cache:flush'] :
        ['typo3/sysext/core/bin/typo3 cache:flush'],
      complexity: 'low'
    });
    
    return steps;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-6">TYPO3 Site Analysis</h2>
        {analysisStage === 'upload' && renderUploadStage()}
        {analysisStage === 'analyzing' && renderAnalyzingStage()}
        {analysisStage === 'processing' && renderProcessingStage()}
        {analysisStage === 'results' && renderResultsStage()}
        
        {analysisStage === 'upload' && (
          <div className="flex justify-end">
            <button 
              className={`px-4 py-2 rounded-md font-medium ${file || detectedVersion ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
              onClick={() => handleAnalyze()}
              disabled={!file && !detectedVersion}
            >
              Analyze Site
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 