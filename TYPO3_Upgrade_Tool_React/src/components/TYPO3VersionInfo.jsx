import { useState, useEffect } from 'react';
import { fetchTYPO3VersionsWithAxios } from '../lib/typo3-axios-scraper';

/**
 * Component to display TYPO3 version information
 */
export function TYPO3VersionInfo() {
  const [versions, setVersions] = useState([]);
  const [filteredVersions, setFilteredVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayCount, setDisplayCount] = useState(9); // Initially show 9 versions (3×3 grid)
  const VERSIONS_PER_PAGE = 9; // Show 9 versions per "Show more" click
  
  // Count versions by type
  const typeCounts = {
    all: versions.length,
    lts: versions.filter(v => v.type === 'lts').length,
    sts: versions.filter(v => v.type === 'sts').length, 
    regular: versions.filter(v => v.type === 'regular').length,
    dev: versions.filter(v => v.type === 'dev').length
  };

  useEffect(() => {
    async function loadVersions() {
      try {
        setLoading(true);
        const data = await fetchTYPO3VersionsWithAxios();
        console.log('Loaded versions:', data);
        setVersions(data);
        setFilteredVersions(data);
        setError(null);
      } catch (err) {
        console.error('Error loading TYPO3 versions:', err);
        setError('Failed to load TYPO3 version information');
      } finally {
        setLoading(false);
      }
    }

    loadVersions();
  }, []);

  // Function to determine if a version should be included in search results
  const matchesSearchQuery = (version, query) => {
    if (!version) return false;
    
    // Check if query is a number (full or partial version number)
    const isNumericSearch = /^\d+(\.\d+)?(\.\d+)?$/.test(query);
    
    if (isNumericSearch) {
      // For numeric searches, we want to match the start of the version number
      const versionNumber = version.version || '';
      
      // Match exact version (e.g. "11.5.0")
      if (versionNumber === query) return true;
      
      // Match start of version (e.g. query "11" matches "11.5.0")
      if (versionNumber.startsWith(query)) return true;
      
      // Match major version number (e.g. query "11" matches "11.5.0")
      if (versionNumber.split('.')[0] === query) return true;
      
      // Match major.minor version number (e.g. query "11.5" matches "11.5.0")
      const parts = versionNumber.split('.');
      if (parts.length >= 2 && `${parts[0]}.${parts[1]}` === query) return true;
      
      // For numeric searches, if no match by now, return false
      return false;
    } 
    else {
      // For non-numeric searches, check all fields
      return (
        // Check version number
        (version.version && version.version.toLowerCase().includes(query)) ||
        
        // Check type (lts, sts, etc.)
        (version.type && version.type.toLowerCase().includes(query)) ||
        
        // Check release date
        (version.release_date && 
         String(version.release_date).toLowerCase().includes(query)) ||
        
        // Check support dates
        (version.support?.active_until && 
         String(version.support.active_until).toLowerCase().includes(query)) ||
        (version.support?.security_until && 
         String(version.support.security_until).toLowerCase().includes(query)) ||
        
        // Check requirements
        (version.requirements?.php && 
         String(version.requirements.php).toLowerCase().includes(query)) ||
        (version.requirements?.mysql && 
         String(version.requirements.mysql).toLowerCase().includes(query)) ||
        (version.requirements?.composer && 
         String(version.requirements.composer).toLowerCase().includes(query))
      );
    }
  };

  useEffect(() => {
    // Start with all versions
    let result = [...versions];
    console.log('Filtering versions, total:', versions.length);
    
    // Apply type filter if not 'all'
    if (filter !== 'all') {
      result = result.filter(version => version.type === filter);
      console.log('After type filter:', result.length);
    }
    
    // Apply search query if present
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      console.log('Processing search query:', query);
      
      // For debugging - log the version structure
      if (versions.length > 0) {
        console.log('Version structure sample:', versions[0]);
      }
      
      // Apply search filter using the matcher function
      result = result.filter(version => matchesSearchQuery(version, query));
      
      console.log('After search filter:', result.length);
      if (result.length > 0) {
        console.log('First matched version:', result[0]);
      } else {
        console.log('No versions matched the search');
      }
    }
    
    // Update state with filtered results
    setFilteredVersions(result);
    setDisplayCount(9); // Reset display count to 9 when filters change
  }, [filter, versions, searchQuery]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };
  
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };
  
  const handleClearSearch = () => {
    setSearchQuery('');
  };
  
  const handleShowMore = () => {
    setDisplayCount(displayCount + VERSIONS_PER_PAGE);
  };
  
  const handleShowAll = () => {
    setDisplayCount(filteredVersions.length);
  };
  
  const handleShowLess = () => {
    setDisplayCount(9);
  };

  // Determine the versions to display based on current display count
  const displayedVersions = filteredVersions.slice(0, displayCount);
  
  // Determine if there are more versions to show
  const hasMoreVersions = displayCount < filteredVersions.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-orange-50 rounded-lg shadow-sm p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-t-orange-600 border-b-orange-600 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          <p className="text-orange-600 font-medium">Loading TYPO3 version information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-orange-500"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>
          TYPO3 Versions
        </h2>
        <div className="mt-4 sm:mt-0 text-sm text-gray-500">
          Showing <span className="font-semibold">{displayedVersions.length}</span> of <span className="font-semibold">{filteredVersions.length}</span> versions
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input
            type="search"
            className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            placeholder="Search versions, requirements, dates..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button 
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <svg className="w-4 h-4 text-gray-500 hover:text-gray-700" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>
        
        {/* Filter buttons */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button 
            onClick={() => handleFilterChange('all')} 
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            All <span className="ml-1 px-1.5 py-0.5 bg-gray-200 rounded-full text-gray-700">{typeCounts.all}</span>
          </button>
          <button 
            onClick={() => handleFilterChange('lts')} 
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'lts' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            LTS <span className="ml-1 px-1.5 py-0.5 bg-green-100 rounded-full text-green-700">{typeCounts.lts}</span>
          </button>
          <button 
            onClick={() => handleFilterChange('sts')} 
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'sts' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            STS <span className="ml-1 px-1.5 py-0.5 bg-amber-100 rounded-full text-amber-700">{typeCounts.sts}</span>
          </button>
          <button 
            onClick={() => handleFilterChange('regular')} 
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'regular' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Regular <span className="ml-1 px-1.5 py-0.5 bg-orange-100 rounded-full text-orange-700">{typeCounts.regular}</span>
          </button>
          <button 
            onClick={() => handleFilterChange('dev')} 
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'dev' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Dev <span className="ml-1 px-1.5 py-0.5 bg-purple-100 rounded-full text-purple-700">{typeCounts.dev}</span>
          </button>
        </div>
      </div>
      
      {filteredVersions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-gray-400 mx-auto mb-4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <p className="text-gray-600">No versions match your criteria</p>
          <div className="flex justify-center gap-3 mt-4">
            <button 
              onClick={() => handleFilterChange('all')} 
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors"
            >
              Reset Filter
            </button>
            {searchQuery && (
              <button 
                onClick={handleClearSearch} 
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedVersions.map((version) => {
              // Determine status color
              let statusClass = "bg-orange-100 text-orange-800"; // default for regular
              let statusBadge = "";
              
              if (version.type === "lts") {
                statusClass = "bg-green-100 text-green-800";
                statusBadge = "Long Term Support";
              } else if (version.type === "sts") {
                statusClass = "bg-amber-100 text-amber-800";
                statusBadge = "Standard Term Support";
              } else if (version.type === "dev") {
                statusClass = "bg-purple-100 text-purple-800";
                statusBadge = "Development";
              } else {
                statusBadge = "Regular Release";
              }
              
              return (
                <div key={version.version} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-md transition-all hover:shadow-lg">
                  <div className={`p-5 border-b ${version.type === "lts" ? "bg-green-50 border-green-100" : version.type === "sts" ? "bg-amber-50 border-amber-100" : version.type === "dev" ? "bg-purple-50 border-purple-100" : "bg-white border-gray-100"}`}>
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-gray-800">
                        TYPO3 {version.version}
                      </h3>
                      <span className={`${statusClass} text-xs font-semibold px-2.5 py-1 rounded`}>
                        {statusBadge}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Released: {formatDate(version.release_date)}
                    </p>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    <div className="flex gap-5">
                      <div className="flex-1">
                        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">Support Period</h4>
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-sm">Active until:</span>
                            <span className="text-sm font-medium ml-auto">{formatDate(version.support.active_until)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-sm">Security until:</span>
                            <span className="text-sm font-medium ml-auto">{formatDate(version.support.security_until)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">Requirements</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 p-2 rounded flex flex-col items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-600 mb-1"><path d="M3 6h18M7 12h10M5 18h14"></path></svg>
                          <span className="text-xs text-gray-500">PHP</span>
                          <span className="text-xs font-semibold">{version.requirements.php}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded flex flex-col items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-600 mb-1"><path d="M4 6h16M4 12h16M4 18h12"></path></svg>
                          <span className="text-xs text-gray-500">MySQL</span>
                          <span className="text-xs font-semibold truncate max-w-full">{version.requirements.mysql}</span>
                        </div>
                        <div className="bg-gray-50 p-2 rounded flex flex-col items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-orange-600 mb-1"><path d="M22 18.5c0 1.93-1.57 3.5-3.5 3.5s-3.5-1.57-3.5-3.5a3.5 3.5 0 0 1 7 0Z"></path><path d="M18.5 2c1.93 0 3.5 1.57 3.5 3.5 0 1.45-.88 2.69-2.12 3.23-1.97.85-3.38 2.69-3.38 4.86V16"></path><path d="M10.5 20.5c0 1.38-1.12 2.5-2.5 2.5S5.5 21.88 5.5 20.5 6.62 18 8 18s2.5 1.12 2.5 2.5Z"></path><path d="M12 13.75c0 6.5-2.5 4.25-4 8.25"></path><path d="M5.5 13c0-3.31 2.69-6 6-6h.5"></path></svg>
                          <span className="text-xs text-gray-500">Composer</span>
                          <span className="text-xs font-semibold">{version.requirements.composer}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex flex-col space-y-2 text-sm">
                        <div className={`flex items-center gap-2 ${version.db_changes ? 'text-amber-600' : 'text-green-600'}`}>
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${version.db_changes ? 'bg-amber-100' : 'bg-green-100'}`}>
                            {version.db_changes ? '!' : '✓'}
                          </span>
                          <span className="text-gray-700">
                            {version.db_changes ? 'Database changes required' : 'No major DB changes'}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 ${version.install_tool_migrations ? 'text-amber-600' : 'text-green-600'}`}>
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${version.install_tool_migrations ? 'bg-amber-100' : 'bg-green-100'}`}>
                            {version.install_tool_migrations ? '!' : '✓'}
                          </span>
                          <span className="text-gray-700">
                            {version.install_tool_migrations ? 'Install tool migrations needed' : 'No install tool migrations'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Show more/less buttons */}
          <div className="mt-8 flex justify-center">
            {hasMoreVersions && (
              <>
                <button 
                  onClick={handleShowMore}
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                  Show 9 More ({Math.min(displayCount + 9, filteredVersions.length) - displayCount} available)
                </button>
                
                <button 
                  onClick={handleShowAll}
                  className="px-4 py-2 ml-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  Show All ({filteredVersions.length})
                </button>
              </>
            )}
            
            {displayCount > 9 && (
              <button 
                onClick={handleShowLess}
                className="px-4 py-2 ml-3 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
                Show Less
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Format date strings consistently, handling "Unknown" values
 * @param {string} dateString - Date string to format
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
  if (!dateString || dateString === "Unknown") {
    return "Not specified";
  }
  
  try {
    // Try to create a date object and format it
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If it's not a valid date, return the original
      return dateString;
    }
    
    // Format as local date
    return date.toLocaleDateString();
  } catch (error) {
    // If any error, return the original
    return dateString;
  }
} 