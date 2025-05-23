import { useState } from 'react';

export default function ManualSystemInput({ onSaveData }) {
  const [systemData, setSystemData] = useState({
    typo3: {
      version: '',
      composerInstallation: true
    },
    system: {
      os: '',
      php: {
        version: '',
        memoryLimit: '128M',
        maxExecutionTime: ''
      },
      serverSoftware: ''
    },
    database: {
      type: 'MySQL',
      version: '',
      tableCount: ''
    },
    extensions: []
  });

  const [newExtension, setNewExtension] = useState({
    key: '',
    title: '',
    version: '',
    isCompatible: true
  });
  
  const [showTextImportModal, setShowTextImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  
  // Define TYPO3 versions
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
  
  // Define PHP versions
  const phpVersions = [
    { version: '5.6', eolDate: '2018-12-31' },
    { version: '7.0', eolDate: '2018-12-03' },
    { version: '7.1', eolDate: '2019-12-01' },
    { version: '7.2', eolDate: '2020-11-30' },
    { version: '7.3', eolDate: '2021-12-06' },
    { version: '7.4', eolDate: '2022-11-28' },
    { version: '8.0', eolDate: '2023-11-26' },
    { version: '8.1', eolDate: '2024-11-25' },
    { version: '8.2', eolDate: '2025-12-08' },
    { version: '8.3', eolDate: '2026-12-07' }
  ];
  
  // Define operating systems
  const operatingSystems = [
    { name: 'Linux (Debian/Ubuntu)', value: 'debian' },
    { name: 'Linux (CentOS/RHEL)', value: 'centos' },
    { name: 'Linux (SUSE)', value: 'suse' },
    { name: 'Windows Server', value: 'windows' },
    { name: 'macOS', value: 'macos' }
  ];
  
  // Define web servers
  const webServers = [
    { name: 'Apache 2.4+', value: 'apache' },
    { name: 'Nginx', value: 'nginx' },
    { name: 'Microsoft IIS', value: 'iis' },
    { name: 'LiteSpeed', value: 'litespeed' },
    { name: 'Caddy', value: 'caddy' }
  ];
  
  // Define memory limit options
  const memoryLimits = [
    '128M', '256M', '512M', '1G', '2G', '4G'
  ];
  
  // Define database types
  const databaseTypes = [
    { name: 'MySQL', value: 'MySQL' },
    { name: 'MariaDB', value: 'MariaDB' },
    { name: 'PostgreSQL', value: 'PostgreSQL' },
    { name: 'SQLite', value: 'SQLite' },
    { name: 'MSSQL (not compatible with all TYPO3 versions)', value: 'MSSQL' }
  ];

  const handleTypo3Change = (e) => {
    const { name, value, type, checked } = e.target;
    setSystemData(prev => ({
      ...prev,
      typo3: {
        ...prev.typo3,
        [name]: type === 'checkbox' ? checked : value
      }
    }));
  };

  const handleSystemChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('php.')) {
      const phpField = name.split('.')[1];
      setSystemData(prev => ({
        ...prev,
        system: {
          ...prev.system,
          php: {
            ...prev.system.php,
            [phpField]: value
          }
        }
      }));
    } else {
      setSystemData(prev => ({
        ...prev,
        system: {
          ...prev.system,
          [name]: value
        }
      }));
    }
  };

  const handleDatabaseChange = (e) => {
    const { name, value } = e.target;
    setSystemData(prev => ({
      ...prev,
      database: {
        ...prev.database,
        [name]: value
      }
    }));
  };

  const handleExtensionChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewExtension(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addExtension = () => {
    if (newExtension.key && newExtension.version) {
      setSystemData(prev => ({
        ...prev,
        extensions: [...prev.extensions, { ...newExtension }]
      }));
      setNewExtension({
        key: '',
        title: '',
        version: '',
        isCompatible: true
      });
    }
  };

  const removeExtension = (index) => {
    setSystemData(prev => ({
      ...prev,
      extensions: prev.extensions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Add timestamp to the data
    const finalData = {
      ...systemData,
      timestamp: Date.now()
    };
    
    onSaveData(finalData);
  };

  const handleImportFromText = () => {
    setShowTextImportModal(true);
  };
  
  const processImportText = () => {
    if (!importText) {
      setShowTextImportModal(false);
      return;
    }
    
    // Try to extract information from the text
    const extractData = {
      typo3: { ...systemData.typo3 },
      system: { ...systemData.system, php: { ...systemData.system.php } },
      database: { ...systemData.database },
      extensions: [...systemData.extensions]
    };
    
    // Extract PHP version
    const phpVersionMatch = importText.match(/PHP Version (\d+\.\d+\.\d+)/i);
    if (phpVersionMatch) {
      extractData.system.php.version = phpVersionMatch[1];
    }
    
    // Extract MySQL version
    const mysqlVersionMatch = importText.match(/MySQL.+?(\d+\.\d+\.\d+)/i);
    if (mysqlVersionMatch) {
      extractData.database.version = mysqlVersionMatch[1];
    }
    
    // Extract OS
    const osMatch = importText.match(/System.+?(Windows|Linux|macOS|Darwin|Ubuntu|CentOS|Debian)/i);
    if (osMatch) {
      extractData.system.os = osMatch[1];
    }
    
    // Extract Apache/Nginx version
    const serverMatch = importText.match(/(Apache|Nginx).+?(\d+\.\d+\.\d+)/i);
    if (serverMatch) {
      extractData.system.serverSoftware = `${serverMatch[1]} ${serverMatch[2]}`;
    }
    
    // Extract memory limit
    const memoryMatch = importText.match(/memory_limit.+?(\d+[KMGP])/i);
    if (memoryMatch) {
      extractData.system.php.memoryLimit = memoryMatch[1];
    }
    
    // Extract TYPO3 version
    const typo3VersionMatch = importText.match(/TYPO3\s+(?:CMS\s+)?(\d+\.\d+\.\d+)/i);
    if (typo3VersionMatch) {
      extractData.typo3.version = typo3VersionMatch[1];
    }
    
    // Update state with extracted data
    setSystemData(extractData);
    setShowTextImportModal(false);
    setImportText('');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Manual System Information</h2>
        <button
          onClick={handleImportFromText}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
          type="button"
        >
          Auto-detect from text
        </button>
      </div>
      
      {/* Text Import Modal */}
      {showTextImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Paste System Information</h3>
                <button 
                  onClick={() => setShowTextImportModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Paste output from phpinfo(), TYPO3 system information, or any text containing system details. 
                The tool will try to automatically detect version information.
              </p>
              
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                placeholder="Paste your system information text here (phpinfo output, TYPO3 system information, etc.)"
              ></textarea>
              
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowTextImportModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={processImportText}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                  type="button"
                >
                  Extract Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-6 bg-orange-50 border border-orange-200 rounded-md p-4 text-sm text-orange-800">
        <div className="flex gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            <p className="font-medium">Manual Data Entry Guide</p>
            <ul className="mt-1 list-disc list-inside pl-1">
              <li>Enter details from your TYPO3 installation for accurate upgrade path suggestions</li>
              <li>TYPO3 version and PHP version are most critical for analysis</li>
              <li>Add at least your most important extensions to check compatibility</li>
              <li>Use "Auto-detect from text" if you have output from phpinfo() or similar</li>
            </ul>
          </div>
        </div>
      </div>
      
      <p className="text-sm text-gray-500 mb-6">
        Enter your TYPO3 system details manually for upgrade path analysis
      </p>
      
      <form onSubmit={handleSubmit}>
        {/* TYPO3 Information */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b">TYPO3 Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TYPO3 Version
              </label>
              <div className="relative">
                <select
                  name="version"
                  value={systemData.typo3.version}
                  onChange={handleTypo3Change}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 appearance-none"
                  required
                >
                  <option value="">Select TYPO3 version</option>
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
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id="composerInstallation"
                name="composerInstallation"
                checked={systemData.typo3.composerInstallation}
                onChange={handleTypo3Change}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="composerInstallation" className="ml-2 block text-sm text-gray-700">
                Composer Installation
              </label>
            </div>
          </div>
        </div>
        
        {/* System Information */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b">System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operating System
              </label>
              <div className="relative">
                <select
                  name="os"
                  value={systemData.system.os}
                  onChange={handleSystemChange}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 appearance-none"
                >
                  <option value="">Select operating system</option>
                  {operatingSystems.map(os => (
                    <option key={os.value} value={os.value}>
                      {os.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Web Server
              </label>
              <div className="relative">
                <select
                  name="serverSoftware"
                  value={systemData.system.serverSoftware}
                  onChange={handleSystemChange}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 appearance-none"
                >
                  <option value="">Select web server</option>
                  {webServers.map(server => (
                    <option key={server.value} value={server.value}>
                      {server.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PHP Version
              </label>
              <div className="relative">
                <select
                  name="php.version"
                  value={systemData.system.php.version}
                  onChange={handleSystemChange}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 appearance-none"
                  required
                >
                  <option value="">Select PHP version</option>
                  {phpVersions.map(php => (
                    <option key={php.version} value={php.version}>
                      PHP {php.version} {php.eolDate < new Date().toISOString().split('T')[0] ? '(EOL)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PHP Memory Limit
              </label>
              <div className="relative">
                <select
                  name="php.memoryLimit"
                  value={systemData.system.php.memoryLimit}
                  onChange={handleSystemChange}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 appearance-none"
                >
                  {memoryLimits.map(limit => (
                    <option key={limit} value={limit}>
                      {limit}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Database Information */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b">Database Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Type
              </label>
              <div className="relative">
                <select
                  name="type"
                  value={systemData.database.type}
                  onChange={handleDatabaseChange}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 appearance-none"
                >
                  {databaseTypes.map(db => (
                    <option key={db.value} value={db.value}>
                      {db.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-400">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
              {systemData.database.type === 'MSSQL' && (
                <p className="mt-1 text-xs text-red-500">
                  Note: MSSQL is not compatible with all TYPO3 versions
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Version
              </label>
              <input
                type="text"
                name="version"
                value={systemData.database.version}
                onChange={handleDatabaseChange}
                placeholder="e.g. 8.0.28"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>
        
        {/* Extensions Information */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-700 mb-3 pb-2 border-b">
            Extensions ({systemData.extensions.length})
          </h3>
          
          {/* Add new extension */}
          <div className="p-4 bg-gray-50 rounded-md mb-4">
            <h4 className="text-sm font-medium mb-3">Add Extension</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <input
                  type="text"
                  name="key"
                  value={newExtension.key}
                  onChange={handleExtensionChange}
                  placeholder="Extension Key (e.g. news)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
              <div className="md:col-span-1">
                <input
                  type="text"
                  name="version"
                  value={newExtension.version}
                  onChange={handleExtensionChange}
                  placeholder="Version (e.g. 9.2.0)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
              <div className="md:col-span-1">
                <input
                  type="text"
                  name="title"
                  value={newExtension.title}
                  onChange={handleExtensionChange}
                  placeholder="Title (optional)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
              <div className="md:col-span-1">
                <button
                  type="button"
                  onClick={addExtension}
                  className="w-full py-2 px-4 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
          
          {/* Extensions list */}
          {systemData.extensions.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemData.extensions.map((ext, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ext.key}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ext.title || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ext.version}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => removeExtension(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-md">
              No extensions added yet. Add important extensions for better analysis.
            </div>
          )}
          <div className="mt-2 text-xs text-gray-500">
            <p>For best results, add at least your most critical extensions.</p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
          >
            Save and Analyze
          </button>
        </div>
      </form>
    </div>
  );
} 