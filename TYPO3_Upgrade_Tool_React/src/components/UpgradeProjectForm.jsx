import React, { useState } from 'react';
import { analyzeProjectFromZip, generateUpgradeCommand } from '../lib/typo3-axios-scraper.js';

/**
 * Component for uploading TYPO3 projects and generating personalized upgrade paths
 */
const UpgradeProjectForm = ({ targetVersions }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [projectInfo, setProjectInfo] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [upgradeCommand, setUpgradeCommand] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  /**
   * Handle file selection
   */
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/zip') {
      setSelectedFile(file);
      setError('');
    } else {
      setSelectedFile(null);
      setError('Please select a valid ZIP file');
    }
  };

  /**
   * Handle form submission for project analysis
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a TYPO3 project ZIP file');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    
    try {
      // Create a temporary file path for the uploaded ZIP
      const reader = new FileReader();
      
      reader.onload = async () => {
        // Save file to temporary location
        const tempFilePath = `/tmp/typo3-project-${Date.now()}.zip`;
        
        // Use Blob to create file
        const blob = new Blob([reader.result], { type: 'application/zip' });
        
        // For browser-only environments, we'd need a different approach
        // In a Node.js environment, we could write to the filesystem
        
        // For demonstration purposes, we're creating a File object
        // In a real application, you would use the file system APIs
        const file = new File([blob], tempFilePath);
        
        try {
          // Analyze the project
          const info = await analyzeProjectFromZip(tempFilePath);
          setProjectInfo(info);
          
          // Set a default target version based on current version
          if (info.coreVersion && info.coreVersion !== 'unknown') {
            // Parse current version to suggest an appropriate upgrade
            const versionMatch = info.coreVersion.match(/^(\d+)/);
            if (versionMatch) {
              const currentMajor = parseInt(versionMatch[1], 10);
              
              // Find an appropriate upgrade target
              let targetVersionObj = null;
              
              if (targetVersions && targetVersions.length > 0) {
                // Try to find the next major LTS version
                targetVersionObj = targetVersions.find(v => 
                  v.type === 'lts' && 
                  parseInt(v.version.split('.')[0], 10) === currentMajor + 1
                );
                
                // If not found, suggest the current major LTS version
                if (!targetVersionObj) {
                  targetVersionObj = targetVersions.find(v => 
                    v.type === 'lts' && 
                    parseInt(v.version.split('.')[0], 10) === currentMajor
                  );
                }
                
                // If still not found, suggest the latest LTS version
                if (!targetVersionObj) {
                  targetVersionObj = targetVersions.find(v => v.type === 'lts');
                }
              }
              
              if (targetVersionObj) {
                const versionParts = targetVersionObj.version.split('.');
                if (versionParts.length >= 2) {
                  const suggestedVersion = `^${versionParts[0]}.${versionParts[1]}`;
                  setSelectedVersion(suggestedVersion);
                  
                  // Generate initial upgrade command
                  const command = generateUpgradeCommand(suggestedVersion, info.extensions);
                  setUpgradeCommand(command);
                }
              }
            }
          }
        } catch (err) {
          console.error('Error analyzing project:', err);
          setError('Failed to analyze the project. Please make sure it\'s a valid TYPO3 project.');
        }
      };
      
      reader.onerror = () => {
        setError('Error reading the file');
      };
      
      reader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      console.error('Error processing project:', err);
      setError('An error occurred while processing the project');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Handle version selection change
   */
  const handleVersionChange = (event) => {
    const version = event.target.value;
    setSelectedVersion(version);
    
    if (version && projectInfo) {
      const command = generateUpgradeCommand(version, projectInfo.extensions);
      setUpgradeCommand(command);
    } else {
      setUpgradeCommand('');
    }
  };

  /**
   * Copy upgrade command to clipboard
   */
  const copyToClipboard = () => {
    navigator.clipboard.writeText(upgradeCommand)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy command:', err);
      });
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Upload your TYPO3 project as a ZIP file to generate a personalized upgrade command 
          that includes your custom extensions. This helps ensure a smoother upgrade process.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500 mb-2">Drag & drop your TYPO3 project ZIP file</p>
            <p className="text-xs text-gray-400 mb-4">or</p>
            <input
              type="file"
              id="projectZip"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="projectZip"
              className="cursor-pointer px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              Select File
            </label>
            {selectedFile && (
              <div className="mt-4 text-sm text-gray-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={!selectedFile || isAnalyzing}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                !selectedFile || isAnalyzing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing Project...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Analyze Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      
      {projectInfo && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-500">Current TYPO3 Version</span>
                <p className="text-lg font-bold text-gray-900">{projectInfo.coreVersion}</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-500">Extensions Found</span>
                <p className="text-lg font-bold text-gray-900">{projectInfo.extensions.length}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Detected Extensions</h4>
              {projectInfo.extensions.length > 0 ? (
                <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
                  <ul className="space-y-1">
                    {projectInfo.extensions
                      .filter(ext => ext.name && !ext.name.startsWith('local/'))
                      .map((ext, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          {ext.name}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No composer-based extensions found</p>
              )}
            </div>
            
            <div className="border-t border-gray-200 pt-4">
              <label htmlFor="target-version" className="block text-sm font-medium text-gray-700 mb-2">
                Select Target TYPO3 Version
              </label>
              <select
                id="target-version"
                value={selectedVersion}
                onChange={handleVersionChange}
                className="block w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="">Select a version</option>
                {targetVersions && targetVersions.map((version, index) => {
                  const versionNumber = version.version.split('.').slice(0, 2).join('.');
                  return (
                    <option key={index} value={`^${versionNumber}`}>
                      {versionNumber} ({version.lts ? 'LTS' : version.type.toUpperCase()})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          
          {upgradeCommand && (
            <>
              <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-200">Personalized Upgrade Command</h3>
                  <button
                    onClick={copyToClipboard}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Copy Command
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 font-mono text-sm overflow-x-auto text-green-400 max-h-48">
                  <div className="flex">
                    <span className="text-gray-500 mr-2 select-none">$</span>
                    <span>{upgradeCommand}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-orange-700">
                      Run this command in your project root directory to upgrade your TYPO3 installation.
                      The command includes your core upgrade and all compatible extensions with proper version constraints.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UpgradeProjectForm; 