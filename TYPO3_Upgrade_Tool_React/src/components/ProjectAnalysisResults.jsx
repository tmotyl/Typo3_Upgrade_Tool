import React, { useState, useEffect } from 'react';

export default function ProjectAnalysisResults({ data, onShowSteps, installationType }) {
  if (!data) return null;

  const [targetVersion, setTargetVersion] = useState('12.4');
  const [coreExpanded, setCoreExpanded] = useState(false);
  const [thirdPartyExpanded, setThirdPartyExpanded] = useState(false);
  const [extensionCompatibility, setExtensionCompatibility] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Generate TYPO3 versions from 4.5 to 12.4
  const generateVersions = () => {
    const versions = [];
    for (let major = 13; major >= 4; major--) {
      if (major === 13) {
        versions.push('13.4', '13.3', '13.2', '13.1', '13.0');
      } else if (major === 12) {
        versions.push('12.4');
      } else if (major === 11) {
        versions.push('11.5');
      } else if (major === 10) {
        versions.push('10.4');
      } else if (major === 9) {
        versions.push('9.5');
      } else if (major === 8) {
        versions.push('8.7');
      } else if (major === 7) {
        versions.push('7.6');
      } else if (major === 6) {
        versions.push('6.2');
      } 
    }
    return versions;
  };

  // Function to check TYPO3 version compatibility from package requirements
  const isCompatibleWithTypo3Version = (requirements, targetVersion) => {
    if (!requirements || !requirements['typo3/cms-core']) {
      return 'unknown';
    }
    
    const versionConstraint = requirements['typo3/cms-core'];
    // Simple version check - can be enhanced for more complex version constraints
    if (versionConstraint.includes(targetVersion)) {
      return 'compatible';
    }
    return 'incompatible';
  };

  // Function to fetch package information through the proxy
  const fetchPackageInfo = async (packageName) => {
    try {
      // Use the proxy endpoint instead of direct Packagist API call
      const response = await fetch(`/api/packagist/${encodeURIComponent(packageName)}`);
      if (!response.ok) {
        throw new Error('Package not found');
      }
      const data = await response.json();
      
      // Extract the latest version information from the Packagist response
      if (data.packages && data.packages[packageName]) {
        const versions = Object.keys(data.packages[packageName]);
        if (versions.length > 0) {
          const latestVersion = versions[0];
          return data.packages[packageName][latestVersion];
        }
      }
      throw new Error('Invalid package data format');
    } catch (error) {
      console.error(`Error fetching package ${packageName}:`, error);
      return null;
    }
  };

  // Effect to fetch compatibility information when target version changes
  useEffect(() => {
    const checkExtensionsCompatibility = async () => {
      setIsLoading(true);
      const compatibility = {};
      
      const thirdPartyExtensions = data.InstalledExtensions.filter(ext => ext.Vendor !== 'typo3');
      
      // List of local extensions that should skip Packagist check
      const localExtensions = ['vendor/project_export', 'filip/system_export'];
      
      // Process extensions in batches to avoid too many concurrent requests
      const batchSize = 5;
      for (let i = 0; i < thirdPartyExtensions.length; i += batchSize) {
        const batch = thirdPartyExtensions.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (ext) => {
            // Format package name correctly - remove duplicate vendor name if present
            let packageName = ext.ExtensionKey;
            if (packageName.startsWith(ext.Vendor + '/')) {
              packageName = packageName.substring(ext.Vendor.length + 1);
            }
            packageName = `${ext.Vendor}/${packageName}`.toLowerCase();

            // Skip Packagist check for local extensions
            if (localExtensions.includes(packageName)) {
              compatibility[ext.ExtensionKey] = {
                status: 'unknown',
                latestVersion: 'N/A',
                isLocal: true
              };
              return;
            }

            try {
              const packageInfo = await fetchPackageInfo(packageName);
              
              if (packageInfo) {
                compatibility[ext.ExtensionKey] = {
                  status: isCompatibleWithTypo3Version(packageInfo.require, targetVersion),
                  latestVersion: packageInfo.version,
                  packageUrl: `https://packagist.org/packages/${packageName}`
                };
              } else {
                compatibility[ext.ExtensionKey] = {
                  status: 'unknown',
                  latestVersion: 'N/A'
                };
              }
            } catch (error) {
              compatibility[ext.ExtensionKey] = {
                status: 'unknown',
                latestVersion: 'N/A'
              };
            }
          })
        );
      }
      
      setExtensionCompatibility(compatibility);
      setIsLoading(false);
    };

    if (data.InstalledExtensions?.length > 0) {
      checkExtensionsCompatibility();
    }
  }, [targetVersion, data.InstalledExtensions]);

  const handleCreateUpgradePath = () => {
    const upgradeInfo = {
      currentVersion: data.TYPO3Version,
      targetVersion: targetVersion,
      extensions: data.InstalledExtensions || [],
      installationType: data.installationType || 'composer'
    };
    onShowSteps(upgradeInfo);
  };

  // Calculate compatibility statistics
  const extensions = data.InstalledExtensions || [];
  const incompatibleCount = 0; // We'll implement compatibility check later
  const compatibleCount = extensions.length - incompatibleCount;

  const getCompatibilityBadge = (extension) => {
    const compatibility = extensionCompatibility[extension.ExtensionKey];
    
    if (!compatibility) {
      return (
        <span className="flex items-center text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5"></span>
          Checking...
        </span>
      );
    }

    switch (compatibility.status) {
      case 'compatible':
        return (
          <span className="flex items-center text-green-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
            Compatible
          </span>
        );
      case 'incompatible':
        return (
          <span className="flex items-center text-red-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
            Incompatible
          </span>
        );
      case 'unknown':
        return (
          <span className="flex items-center text-yellow-500">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5"></span>
            Unknown
          </span>
        );
      default:
        return (
          <span className="flex items-center text-red-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
            Error
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Ready to Upgrade Section */}
        <div className="px-6 py-3 bg-[rgb(249,115,22)] rounded-lg pt-6 pb-6">
          <h2 className="text-xl text-white mb-2">Ready to Upgrade Your TYPO3 Site?</h2>
          <p className="text-orange-100 mb-6">
            Select your target TYPO3 version and get a detailed upgrade path with step-by-step instructions.
          </p>
          <div className="grid grid-cols-[200px,200px,1fr] gap-6 items-start">
            <div className="space-y-2">
              <div className="text-orange-100">Current Version</div>
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 bg-white/10 text-white rounded w-full">
                  TYPO3 {data.TYPO3Version}
                </div>
                <svg className="w-5 h-5 text-orange-100 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-orange-100">Target Version</div>
              <select 
                className="w-full px-4 py-2 bg-white rounded text-gray-900"
                value={targetVersion}
                onChange={(e) => setTargetVersion(e.target.value)}
              >
                {generateVersions().map((version) => (
                  <option 
                    key={version} 
                    value={version}
                  >
                    TYPO3 {version}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreateUpgradePath}
              className="px-4 py-2 bg-white text-orange-600 rounded hover:bg-orange-50 transition-colors font-medium justify-self-end"
            >
              Create Upgrade Path →
            </button>
          </div>

          <div className="mt-6 flex items-start gap-2 bg-orange-50 p-4 rounded text-orange-700">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">
              Our upgrade path builder will provide you with a detailed guide including code changes, extension compatibility issues, and database migrations.
            </p>
          </div>
        </div>

        {/* Analysis Summary Header */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center gap-3">
            <h2 className="text-gray-700 text-base font-normal">Analysis Summary</h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-sm">TYPO3 11.5 → {targetVersion}</span>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{installationType === 'composer' ? 'Composer' : 'Non-Composer'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Extensions Panel */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-700 text-base font-normal">Extensions</h3>
              <div className="flex items-start">
                <span className="text-2xl font-normal">27</span>
              </div>

            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Compatible:</span>
                <span className="text-gray-600">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Incompatible:</span>
                <span className="text-gray-600">27</span>
              </div>
            </div>

            {/* Extension Compatibility Table - Now Scrollable */}
            <div className="mt-4">
              <h4 className="text-sm font-normal text-gray-700 mb-2">Extension compatibility with TYPO3 {targetVersion} (27)</h4>
              <div className="bg-white rounded-lg space-y-4">
                {/* Core Extensions Container */}
                <div>
                  <button 
                    className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setCoreExpanded(!coreExpanded)}
                  >
                    <span className="text-sm font-medium text-gray-700">Core Extensions</span>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transform transition-transform ${coreExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {coreExpanded && (
                    <div className="mt-2 max-h-[200px] overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Extension</th>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Version</th>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Compatibility</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {data.InstalledExtensions && data.InstalledExtensions
                            .filter(ext => ext.Vendor === 'typo3')
                            .map((ext, idx) => (
                              <tr key={ext.ExtensionKey || idx}>
                                <td className="py-1.5 text-gray-900">{ext.ExtensionKey}</td>
                                <td className="py-1.5 text-gray-600">{ext.Version}</td>
                                <td className="py-1.5">
                                  <span className="flex items-center text-red-500">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                                    Incompatible
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Third-party Extensions Container */}
                <div>
                  <button 
                    className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setThirdPartyExpanded(!thirdPartyExpanded)}
                  >
                    <span className="text-sm font-medium text-gray-700">Third-party Extensions</span>
                    <div className="flex items-center gap-2">
                      {isLoading && (
                        <span className="text-xs text-gray-500">Checking compatibility...</span>
                      )}
                      <svg 
                        className={`w-5 h-5 text-gray-500 transform transition-transform ${thirdPartyExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {thirdPartyExpanded && (
                    <div className="mt-2 max-h-[200px] overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Extension</th>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Version</th>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Latest Version</th>
                            <th className="text-left py-2 text-xs font-normal text-gray-600">Compatibility</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {data.InstalledExtensions && data.InstalledExtensions
                            .filter(ext => ext.Vendor !== 'typo3')
                            .map((ext, idx) => {
                              const compatibility = extensionCompatibility[ext.ExtensionKey];
                              return (
                                <tr key={ext.ExtensionKey || idx}>
                                  <td className="py-1.5 text-gray-900">
                                    {compatibility?.packageUrl ? (
                                      <a 
                                        href={compatibility.packageUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        {ext.ExtensionKey}
                                      </a>
                                    ) : (
                                      ext.ExtensionKey
                                    )}
                                  </td>
                                  <td className="py-1.5 text-gray-600">{ext.Version}</td>
                                  <td className="py-1.5 text-gray-600">
                                    {compatibility?.latestVersion || 'N/A'}
                                  </td>
                                  <td className="py-1.5">
                                    {getCompatibilityBadge(ext)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deprecated Features Panel */}
          <div className="bg-white rounded-lg p-4">

          <div className="flex justify-between items-start">
              <h3 className="text-gray-700 text-base font-normal">System Information</h3>
            </div>
            {/* System Information */}
            <div className="mt-4">
              <div className="space-y-4">
                {/* Database Information */}
                <div>
                  <div className="bg-gray-50 p-3 rounded text-xs">
                    <div className="grid grid-cols-2 gap-y-1">
                      <div className="text-gray-600">Database Type:</div>
                      <div className="font-mono">{data?.DatabaseInfo?.Type}</div>
                      <div className="text-gray-600">Database Version:</div>
                      <div className="font-mono">{data?.DatabaseInfo?.Version}</div>
                      <div className="text-gray-600">Database Platform:</div>
                      <div className="font-mono">{data?.DatabaseInfo?.Platform}</div>
                    </div>
                  </div>
                </div>

                {/* Web Server Information */}
                <div>
                  <div className="bg-gray-50 p-3 rounded text-xs">
                    <div className="grid grid-cols-2 gap-y-1">
                      <div className="text-gray-600">Server Type:</div>
                      <div className="font-mono">{data?.WebServerInfo?.ServerType}</div>
                      <div className="text-gray-600">Server Software:</div>
                      <div className="font-mono">{data?.WebServerInfo?.ServerSoftware}</div>
                      <div className="text-gray-600">Operating System:</div>
                      <div className="font-mono">{data?.WebServerInfo?.OperatingSystem}</div>
                      <div className="text-gray-600">Current PHP Version:</div>
                      <div className="font-mono">{data.PHPVersion || data.typo3?.phpVersion}</div>
                      <div className="text-gray-600">Current TYPO3 Version:</div>
                      <div className="font-mono">{data.TYPO3Version || data.typo3?.version}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade Path Panel */}
          <div className="bg-white rounded-lg p-4">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-700 text-base font-normal">Deprecated Features</h3>
              <span className="text-2xl font-normal">3</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              These features need to be updated before upgrading
            </p>
            <div className="mt-4 space-y-4">
              <div className="bg-orange-50 p-3 rounded">
                <h4 className="text-sm font-medium text-orange-800 mb-2">Important Upgrade Notes</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-orange-700 ml-1">
                  <li>Always upgrade one TYPO3 version at a time</li>
                  <li>For best results, follow the LTS to LTS upgrade path</li>
                  <li>Create a full backup before each upgrade step</li>
                  <li>Test thoroughly in a staging environment</li>
                </ul>
              </div>
            </div>
          </div>
      
        </div>
      </div>
    </div>
  );
} 