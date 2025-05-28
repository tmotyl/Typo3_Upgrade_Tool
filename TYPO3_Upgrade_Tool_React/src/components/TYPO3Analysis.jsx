import { useState, useEffect } from 'react';
import ManualSystemInput from './ManualSystemInput';
import ProjectAnalysisResults from './ProjectAnalysisResults';
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
      if (selectedFile.type === 'application/json' || selectedFile.name.endsWith('.json')) {
        // Dla plików JSON, czytamy i parsujemy bezpośrednio
        const text = await selectedFile.text();
        const jsonData = JSON.parse(text);
        console.log('Załadowane dane JSON:', jsonData); // Debugging
        setExtensionData(jsonData);
        setDetectedVersion(jsonData.TYPO3Version);
        setAnalysisStage('results');
      } else {
        // Dla plików ZIP używamy project analyzer
        const projectAnalysis = await analyzeProject(selectedFile);
        if (projectAnalysis) {
          setExtensionData(projectAnalysis);
          setDetectedVersion(projectAnalysis.typo3?.version);
          setAnalysisStage('results');
        }
      }
    } catch (error) {
      console.error('Błąd przetwarzania pliku:', error);
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
              </p>
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
                  <div className="text-xs text-gray-600">
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Install the extension</li>
                      <li>Put the extension in the "typo3conf/ext" folder</li>
                      <li>in the root composer.json file add: {'{\"repositories\": [{\"type\": \"path\",\"url\": \"typo3conf/ext/project_export\"}]}'}</li>
                      <li>run command: composer require vendor/project-export:@dev</li>
                      <li>clear cache: ddev exec typo3cms cache:flush</li>
                      <li>activate extension: ddev exec typo3cms extension:activate project_export</li>
                      <li>go to extension manager, generate and download the project analysis file</li>
                      <li>Upload the file here for detailed compatibility analysis</li>
                    </ol>
                  </div>
                  {/* Arrow pointing down */}
                  <div className="absolute bottom-0 left-4 transform translate-y-full">
                    <div className="w-3 h-3 bg-white border-b border-r border-orange-200 transform -translate-y-1/2 rotate-45"></div>
                  </div>
                </div>
              </span>
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

  const renderAnalysisResults = () => {
    if (!extensionData) {
      console.log('Brak danych!'); // Debugging
      return null;
    }
    
    console.log('Przekazywane dane:', extensionData); // Debugging
    
    return (
      <div className="space-y-6">
        <ProjectAnalysisResults 
          data={extensionData} 
          onShowSteps={onShowSteps}
        />
        
        {/* Upgrade Options */}
        {detectedVersion && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Upgrade Options</h3>
            <div className="space-y-4">
              <button
                onClick={() => onShowSteps(extensionData)}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                View Upgrade Steps
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="typo3-header mb-6">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center">
            <h1 className="typo3-logo">TYPO3 Site Analyzer</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4">
        {analysisStage === 'upload' && renderUploadStage()}
        {analysisStage === 'analyzing' && renderAnalyzingStage()}
        {analysisStage === 'results' && renderAnalysisResults()}
      </div>
    </div>
  );
} 