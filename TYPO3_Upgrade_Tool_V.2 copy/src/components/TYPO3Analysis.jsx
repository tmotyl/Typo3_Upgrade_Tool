import { useState, useEffect } from 'react';
import ManualSystemInput from './ManualSystemInput';
import { analyzeTYPO3Zip } from '../lib/zipFileAnalyzer';
import { fetchPackagistPackageInfo } from '../lib/packagist';
import { getExtensionMappings, getExtensionMappingsAsync, fetchPackagistInfo } from '../lib/typo3-axios-scraper.js';
import { analyzeProject } from '../lib/project-analyzer.js';

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

  useEffect(() => {
    // No need to load project data automatically anymore
    // We'll wait for user to upload a file
  }, []);

  // Add this helper function at the top level of your component
  const isExtensionBundled = (ext) => {
    if (typeof ext === 'string') {
      return ext.indexOf('/') === -1;
    }
    if (typeof ext.name === 'string') {
      return ext.name.indexOf('/') === -1;
    }
    if (typeof ext.key === 'string') {
      return ext.key.indexOf('/') === -1;
    }
    return true;
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      return;
    }

    setFile(selectedFile);
    setAnalysisStage('analyzing');

    try {
      // Use the project analyzer to handle both JSON and ZIP files
      const projectAnalysis = await analyzeProject(selectedFile);

      if (projectAnalysis) {
        const formattedData = {
          timestamp: projectAnalysis.exportInfo.timestamp,
          typo3: {
            version: projectAnalysis.typo3.version,
            composerInstallation: projectAnalysis.typo3.composerInstallation,
            phpVersion: projectAnalysis.php.version
          },
          extensions: [
            ...projectAnalysis.extensions.systemExtensions.list,
            ...projectAnalysis.extensions.composerExtensions.list
          ].map(ext => ({
            name: ext.name,
            version: ext.version || 'unknown',
            isComposer: ext.isComposer,
            bundled: ext.bundled
          })),
          system: {
            php: {
              version: projectAnalysis.php.version,
              isSupported: projectAnalysis.php.isSupported
            }
          }
        };

        setExtensionData(formattedData);
        setDetectedVersion(formattedData.typo3.version);
        setInstallationType(formattedData.typo3.composerInstallation ? 'composer' : 'non-composer');

        // Start analysis
        handleAnalyze(formattedData);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setAnalysisStage('upload');
    }
  };

  const handleAnalyze = (extensionContent = null) => {
    setAnalysisStage('analyzing');

    // Simulate analysis process
    setTimeout(() => {
      // If we have extension data, use it to generate more detailed results
      if (extensionContent || extensionData) {
        const data = extensionContent || extensionData;

        // Ensure we have a valid version number
        let detectedVer = data.typo3?.version || detectedVersion;
        if (!detectedVer || detectedVer === '1' || !detectedVer.includes('.')) {
          // Set a default version if none is detected or if it's invalid
          detectedVer = '11.5';
        }

        const results = {
          detectedVersion: detectedVer,
          installationType: data.typo3?.composerInstallation ? 'composer' : 'non-composer',
          extensionsFound: data.extensions?.length || 0,
          incompatibleExtensions: 0, // We'll calculate this
          deprecatedFeatures: Math.floor(Math.random() * 10), // Random for now
          upgradePath: [],
          system: {
            php: {
              version: data.system?.php?.version || data.typo3?.phpVersion || '7.4',
              isSupported: true
            }
          },
          database: {
            type: 'MySQL',
            version: '8.0',
            tableCount: 40
          },
          extDetails: (data.extensions || []).map(ext => ({
            name: ext.name || ext,
            key: ext.key || ext,
            version: ext.version || 'latest',
            title: `Extension: ${ext.name || ext}`,
            bundled: ext.bundled !== undefined ? ext.bundled : isExtensionBundled(ext),
            isCompatible: true,
            constraints: ext.constraints || {}
          }))
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
        }

        results.upgradeStrategy = generateUpgradeStrategy(data);
        setAnalysisResults(results);
      }

      setAnalysisStage('results');
    }, 1000);
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
    const currentTYPO3Version = data.typo3?.version || detectedVersion || '11.5';
    const currentPHPVersion = data.system?.php?.version || '7.4';
    const extensionsCount = data.extensions?.length || 0;
    const criticalExtensions = data.extensions?.filter(ext => {
      const extName = typeof ext === 'string' ? ext : ext.name || ext.key || '';
      return ['news', 'powermail', 'solr'].some(critical =>
        extName.toLowerCase().includes(critical.toLowerCase())
      );
    }).length || 0;

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
        const updatedResults = { ...analysisResults };

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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Project Analysis</h2>
        <p className="text-gray-600">
          Upload your project files for analysis
        </p>
      </div>

      <div className="space-y-6">
        {/* File upload section with info blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Extension Analysis Info */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-medium text-gray-900">Extension Analysis</h3>
            </div>
            <div className="relative">
              <p className="text-sm text-gray-600 mb-3">
                Analyze your TYPO3 extensions for compatibility and upgrade requirements.
                <span className="relative inline-block ml-2 group">
                  <svg className="w-5 h-5 text-orange-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 absolute left-0 bottom-full mb-2 w-96 p-4 bg-white rounded-lg shadow-lg border border-orange-200 z-50">
                    <div className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Quick Start Guide:</span>
                    </div>
                    <a
                      href="/downloads/project_export.zip"
                      download
                      className="inline-flex items-center text-sm text-orange-600 hover:text-orange-700 mb-3"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Project Export Extension
                    </a>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600">
                      <li>Install the extension</li>
                      <li>Put the extension in the "typo3conf/ext" folder</li>
                      <li>in the root composer.json file add: {'{\"repositories\": [{\"type\": \"path\",\"url\": \"typo3conf/ext/project_export\"}]}'}</li>
                      <li>run command: composer require vendor/project-export:@dev</li>
                      <li>clear cache: ddev exec typo3cms cache:flush</li>
                      <li>activate extension: ddev exec typo3cms extension:activate project_export</li>
                      <li>go to extension manager, generate and download the project analysis file</li>
                      <li>Upload the file here for detailed compatibility analysis</li>
                    </ol>
                    {/* Arrow pointing down */}
                    <div className="absolute bottom-0 left-4 transform translate-y-full">
                      <div className="w-3 h-3 bg-white border-b border-r border-orange-200 transform -translate-y-1/2 rotate-45"></div>
                    </div>
                  </div>
                </span>
              </p>
            </div>
          </div>

          {/* ZIP File Analysis Info */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="font-medium text-gray-900">ZIP Analysis</h3>
            </div>
            <p className="text-sm text-gray-600">
              Upload your TYPO3 project as a ZIP file for comprehensive analysis.
            </p>
          </div>

          {/* JSON File Analysis Info */}
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <h3 className="font-medium text-gray-900">JSON Analysis</h3>
            </div>
            <p className="text-sm text-gray-600">
              Import TYPO3 project data from a JSON export file for detailed analysis.
            </p>
          </div>
        </div>

        {/* File Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer inline-flex flex-col items-center space-y-2"
            >
              <div className="p-3 bg-orange-100 rounded-full">
                <svg
                  className="w-6 h-6 text-orange-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="text-sm text-gray-600">
                <span className="text-orange-500 font-medium">Click to upload</span> or drag and drop
              </div>
              <div className="text-xs text-gray-500">
                Supported files: TYPO3 project export (.json) or project files (.zip)
              </div>
            </label>
          </div>

          {file && (
            <div className="mt-4 bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <svg
                    className="w-8 h-8 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">{Math.round(file.size / 1024)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setFileContent(null);
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manual input option */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">- or -</p>
          <button
            onClick={() => setShowManualInput(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Enter System Details Manually
          </button>
        </div>

        {showManualInput && (
          <ManualSystemInput onSaveData={handleManualDataSave} />
        )}

        {/* Analysis button */}
        {file && !showManualInput && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => handleAnalyze()}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
            >
              Analyze Uploaded File
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalyzingStage = () => (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg shadow-sm">
      <div className="w-16 h-16 border-4 border-t-orange-600 border-b-orange-600 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
      <p className="mt-6 text-lg font-medium text-gray-700">Analyzing your TYPO3 project...</p>
      <div className="mt-4 max-w-md w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div className="h-full bg-orange-600 animate-pulse" style={{ width: '75%' }}></div>
      </div>
      <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
    </div>
  );

  const renderResultsStage = () => {
    if (!analysisResults) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center text-gray-600">
            No analysis results available. Please try analyzing your project again.
          </div>
        </div>
      );
    }

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
                                    {ext.isCoreExtension ?
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
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${selectedStrategy === 'extensions-first'
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
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${selectedStrategy === 'typo3-first'
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

  // Prepare extension data for the upgrade tool
  const prepareExtensionsForUpgrade = (extDetails) => {
    if (!extDetails || !Array.isArray(extDetails)) {
      return [];
    }

    // Map the extension details to the format expected by the upgrade tool
    return extDetails.map(ext => {
      // Handle both string and object formats
      if (typeof ext === 'string') {
        return {
          key: ext,
          name: ext,
          version: 'latest',
          isCompatible: true,
          constraints: {}
        };
      }

      // For each extension, ensure it has both name and key
      const extensionName = ext.name || ext.key || '';
      const extensionKey = ext.key || extensionName || '';

      // Some extensions may be in the format typo3/cms-xxx
      // or may need to be normalized from extension keys
      let formattedName = extensionName;

      // If the name doesn't have a vendor part (no slash), try to identify it
      if (formattedName && typeof formattedName === 'string' && formattedName.indexOf('/') === -1) {
        // Check for core extensions
        if (formattedName.startsWith('ext_') || formattedName.startsWith('tx_')) {
          formattedName = formattedName.replace(/^(ext_|tx_)/, '');
        }

        // Map common TYPO3 core extensions
        const coreExtensions = ['fluid', 'extbase', 'backend', 'frontend', 'install', 'form', 'felogin', 'scheduler'];
        if (coreExtensions.indexOf(formattedName) !== -1) {
          formattedName = `typo3/cms-${formattedName}`;
        }
      }

      return {
        key: extensionKey,
        name: formattedName || extensionKey,
        version: ext.version || 'latest',
        isCompatible: ext.isCompatible !== false,
        constraints: ext.constraints || {}
      };
    });
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