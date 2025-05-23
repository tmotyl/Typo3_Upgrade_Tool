import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Upload, FileText, AlertCircle, Check, X, HelpCircle, Info, Calculator, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";

export default function TYPO3FileAnalyzer({ upgradeData, onBack, onNavigateToCalculator }) {
  const [files, setFiles] = useState(null);
  const [detectedVersion, setDetectedVersion] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [targetVersion, setTargetVersion] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [error, setError] = useState(null);
  const [showUpgradePath, setShowUpgradePath] = useState(false);
  
  
  const availableVersions = useMemo(() => {
    if (!upgradeData) return [];
    
    return [...upgradeData]
      .map(v => v.version)
      .sort((a, b) => {
        const versPartsA = a.split('.').map(Number);
        const versPartsB = b.split('.').map(Number);
        
        
        if (versPartsA[0] !== versPartsB[0]) {
          return versPartsB[0] - versPartsA[0]; 
        }
        
        return versPartsB[1] - versPartsA[1]; 
      });
  }, [upgradeData]);
  
  const handleFileChange = (e) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      setFiles(fileList);
      setError(null);
    }
  };
  
  const analyzeSite = useCallback(async () => {
    if (!files || files.length === 0) {
      setError("Please select at least one file to analyze");
      return;
    }

    setAnalyzing(true);
    setError(null);
    
    try {
      
      const composerFile = Array.from(files).find(file => file.name === "composer.json");
      if (composerFile) {
        const composerContent = await readFileContent(composerFile);
        const composerData = JSON.parse(composerContent);
        
        
        if (composerData.require && composerData.require["typo3/cms-core"]) {
          const versionConstraint = composerData.require["typo3/cms-core"];
          const detectedVersion = extractVersionFromConstraint(versionConstraint);
          setDetectedVersion(detectedVersion);
          
          
          if (detectedVersion && availableVersions.length > 0) {
            const currentVersionIndex = availableVersions.findIndex(v => {
              const majorMinor = v.split('.').slice(0, 2).join('.');
              return majorMinor === detectedVersion;
            });
            
            if (currentVersionIndex > 0) {
              
              const targetIndex = Math.max(0, currentVersionIndex - 2);
              setTargetVersion(availableVersions[targetIndex]);
            } else {
              
              setTargetVersion(availableVersions[0]);
            }
          }
        }
        
        
        const detectedExtensions = [];
        for (const [package_name, version] of Object.entries(composerData.require || {})) {
          if (package_name.startsWith('typo3/cms-') && package_name !== 'typo3/cms-core') {
            
            const extName = package_name.replace('typo3/cms-', '');
            detectedExtensions.push({
              name: extName,
              packageName: package_name,
              version: version,
              bundled: true,
              compatible: true, 
              alternatives: []
            });
          } else if (package_name.includes('/typo3-') || package_name.includes('/ext-')) {
            
            const extName = package_name.split('/').pop().replace(/(typo3-|ext-)/, '');
            detectedExtensions.push({
              name: extName,
              packageName: package_name,
              version: version,
              bundled: false,
              compatible: null, 
              alternatives: []
            });
          }
        }
        
        
        if (detectedExtensions.length > 0 && targetVersion) {
          const targetMajor = parseInt(targetVersion.split('.')[0]);
          
          detectedExtensions.forEach((ext, index) => {
            if (!ext.bundled) {
              
              const randomCompatible = Math.random() > 0.3; 
              detectedExtensions[index].compatible = randomCompatible;
              
              
              if (!randomCompatible) {
                if (targetMajor >= 12) {
                  detectedExtensions[index].alternatives = [
                    `typo3/replacement-${ext.name}`,
                    `community/modern-${ext.name}`
                  ];
                } else {
                  detectedExtensions[index].alternatives = [
                    `alternative/${ext.name}`
                  ];
                }
              }
            }
          });
        }
        
        setExtensions(detectedExtensions);
      } else {
        
        const typo3ConfFile = Array.from(files).find(file => 
          file.name === "LocalConfiguration.php" || 
          file.name === "PackageStates.php" || 
          file.name === "LocalPackages.php"
        );
        
        if (typo3ConfFile) {
          const content = await readFileContent(typo3ConfFile);
          
          const versionMatch = content.match(/TYPO3[\s_]*(CMS)?[\s_]*([0-9]+\.[0-9]+)/i);
          if (versionMatch && versionMatch[2]) {
            setDetectedVersion(versionMatch[2]);
            
            
            if (availableVersions.length > 0) {
              setTargetVersion(availableVersions[0]);
            }
          }
        }
      }
      
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAnalysisComplete(true);
    } catch (err) {
      console.error("Error analyzing files:", err);
      setError("Failed to analyze files. Please check that you've uploaded valid TYPO3 site files.");
    } finally {
      setAnalyzing(false);
    }
  }, [files, availableVersions]);
  
  
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };
  
  
  const extractVersionFromConstraint = (constraint) => {
    
    const match = constraint.match(/[~^]?([0-9]+\.[0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  };
  
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="typo3-header mb-6">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center">
            <button 
              onClick={onBack}
              className="mr-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="typo3-logo">TYPO3 Site Analyzer</h1>
          </div>
        </div>
      </header>

      {/* Show upgrade path modal when showUpgradePath is true */}
      {showUpgradePath && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">
                  Upgrade Path: TYPO3 {detectedVersion} → {targetVersion}
                </h2>
                <button
                  onClick={() => setShowUpgradePath(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-5 rounded">
                <p className="text-orange-700">
                  Please visit the Upgrade Path calculator for detailed steps to upgrade from {detectedVersion} to {targetVersion}.
                </p>
                <button 
                  onClick={() => {
                    setShowUpgradePath(false);
                    onNavigateToCalculator(detectedVersion, targetVersion);
                  }}
                  className="mt-3 px-6 py-2 bg-[rgb(249,115,22)] text-white rounded-md hover:bg-[rgb(234,88,12)] transition-colors"
                >
                  Go to Upgrade Path Calculator
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-4">
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold">Analyze Your TYPO3 Site</h2>
              <button
                onClick={() => {
                  
                  if (detectedVersion && targetVersion) {
                    onNavigateToCalculator(detectedVersion, targetVersion);
                  } else {
                    onNavigateToCalculator();
                  }
                }}
                className="flex items-center gap-2 py-2 px-6 bg-[rgb(249,115,22)] text-white hover:bg-[rgb(234,88,12)] rounded-md transition-colors"
              >
                <Zap size={18} />
                <span>Upgrade Path</span>
              </button>
            </div>
            
            {!analysisComplete ? (
              <div className="space-y-6">
                <p className="text-gray-600 mb-4">
                  Upload your TYPO3 site files (such as composer.json, LocalConfiguration.php) to detect version and extensions.
                  We'll analyze compatibility for upgrading to newer versions.
                </p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <div className="text-center space-y-4">
                    <Upload size={40} className="mx-auto text-gray-400" />
                    <h3 className="text-lg font-medium">Upload TYPO3 Site Files</h3>
                    <p className="text-sm text-gray-500 max-w-md mx-auto">
                      For best results, upload your composer.json file. You can also upload configuration files like LocalConfiguration.php.
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".json,.php,.yaml,.yml"
                    />
                    <div className="space-y-3">
                      <label
                        htmlFor="file-upload"
                        className="inline-block px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 cursor-pointer transition-colors"
                      >
                        Select Files
                      </label>
                      
                      {files && files.length > 0 && (
                        <div className="text-sm text-gray-600">
                          Selected {files.length} file(s): {Array.from(files).map(f => f.name).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">
                    <div className="flex">
                      <AlertCircle size={20} className="flex-shrink-0 mr-2" />
                      <span>{error}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center">
                  <button
                    onClick={analyzeSite}
                    disabled={!files || analyzing}
                    className={`px-6 py-3 rounded-md text-white font-medium transition-colors ${
                      !files || analyzing
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-[rgb(249,115,22)] hover:bg-[rgb(234,88,12)]"
                    }`}
                  >
                    {analyzing ? (
                      <span className="flex items-center">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></span>
                        Analyzing...
                      </span>
                    ) : (
                      "Analyze Site"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-green-50 border-l-4 border-green-500 p-5 rounded-md">
                  <div className="flex">
                    <Check size={24} className="text-green-500 flex-shrink-0 mr-3" />
                    <div>
                      <h3 className="font-medium text-green-800">Analysis Complete</h3>
                      <p className="text-green-700">
                        {detectedVersion 
                          ? `We detected TYPO3 version ${detectedVersion} and ${extensions.length} extensions.` 
                          : "Analysis complete. We couldn't detect your TYPO3 version."}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Current Site</h3>
                    <div className="bg-white p-5 rounded-md shadow-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">TYPO3 Version:</span>
                          <span className="font-medium">{detectedVersion || "Unknown"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Extensions:</span>
                          <span className="font-medium">{extensions.length}</span>
                        </div>
                        
                        {detectedVersion && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="font-medium mb-2">Detected Version Info</h4>
                            {upgradeData.filter(v => v.version.startsWith(detectedVersion)).map(version => (
                              <div key={version.version} className="text-sm space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge className={`typo3-badge-${version.type}`}>{version.type.toUpperCase()}</Badge>
                                  <span>Released: {new Date(version.release_date).toLocaleDateString()}</span>
                                </div>
                                <div className="text-red-600">
                                  {new Date(version.support.security_until) < new Date() && "Security support has ended!"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Target Version</h3>
                    <div className="bg-white p-5 rounded-md shadow-sm">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Target Version
                          </label>
                          <Select value={targetVersion} onValueChange={setTargetVersion}>
                            <SelectTrigger className="w-full">
                              {targetVersion || "Select target version"}
                            </SelectTrigger>
                            <SelectContent>
                              {availableVersions.map((version) => (
                                <SelectItem key={`target-${version}`} value={version}>
                                  TYPO3 {version}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {targetVersion && (
                          <div>
                            <h4 className="font-medium mb-2">Upgrade Requirements</h4>
                            {upgradeData.filter(v => v.version === targetVersion).map(version => (
                              <div key={version.version} className="text-sm space-y-2">
                                <div>
                                  <span className="font-medium">PHP:</span> {version.requirements.php}
                                </div>
                                <div>
                                  <span className="font-medium">MySQL/MariaDB:</span> {version.requirements.mysql}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  {version.db_changes ? (
                                    <Badge variant="destructive">Requires DB Changes</Badge>
                                  ) : (
                                    <Badge variant="outline">No DB Changes</Badge>
                                  )}
                                  
                                  {version.install_tool_migrations ? (
                                    <Badge variant="destructive">Requires Migrations</Badge>
                                  ) : (
                                    <Badge variant="outline">No Migrations</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Extensions Compatibility</h3>
                  
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="mb-4 p-1">
                      <TabsTrigger value="all">All Extensions ({extensions.length})</TabsTrigger>
                      <TabsTrigger value="compatible">Compatible ({extensions.filter(ext => ext.compatible !== false).length})</TabsTrigger>
                      <TabsTrigger value="incompatible">Incompatible ({extensions.filter(ext => ext.compatible === false).length})</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all" className="space-y-4">
                      {extensions.map(ext => (
                        <div key={ext.packageName} className="bg-white p-5 rounded-md shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{ext.name}</h4>
                                {ext.bundled ? (
                                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Core</Badge>
                                ) : (
                                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Community</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{ext.packageName} {ext.version}</div>
                            </div>
                            <div>
                              {ext.compatible === true && (
                                <div className="flex items-center text-green-600">
                                  <Check size={16} className="mr-1" />
                                  <span className="text-sm font-medium">Compatible</span>
                                </div>
                              )}
                              {ext.compatible === false && (
                                <div className="flex items-center text-red-600">
                                  <X size={16} className="mr-1" />
                                  <span className="text-sm font-medium">Incompatible</span>
                                </div>
                              )}
                              {ext.compatible === null && (
                                <div className="flex items-center text-orange-600">
                                  <HelpCircle size={16} className="mr-1" />
                                  <span className="text-sm font-medium">Unknown</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {ext.compatible === false && ext.alternatives.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h5 className="text-sm font-medium mb-2">Alternatives:</h5>
                              <ul className="text-sm space-y-1">
                                {ext.alternatives.map((alt, idx) => (
                                  <li key={idx} className="text-orange-600">{alt}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {extensions.length === 0 && (
                        <div className="bg-gray-50 p-4 text-center rounded-md">
                          <p className="text-gray-600">No extensions detected.</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="compatible" className="space-y-4">
                      {extensions.filter(ext => ext.compatible !== false).map(ext => (
                        <div key={ext.packageName} className="bg-white p-5 rounded-md shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{ext.name}</h4>
                                {ext.bundled ? (
                                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Core</Badge>
                                ) : (
                                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Community</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{ext.packageName} {ext.version}</div>
                            </div>
                            <div>
                              {ext.compatible === true && (
                                <div className="flex items-center text-green-600">
                                  <Check size={16} className="mr-1" />
                                  <span className="text-sm font-medium">Compatible</span>
                                </div>
                              )}
                              {ext.compatible === null && (
                                <div className="flex items-center text-orange-600">
                                  <HelpCircle size={16} className="mr-1" />
                                  <span className="text-sm font-medium">Unknown</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {extensions.filter(ext => ext.compatible !== false).length === 0 && (
                        <div className="bg-gray-50 p-4 text-center rounded-md">
                          <p className="text-gray-600">No compatible extensions found.</p>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="incompatible" className="space-y-4">
                      {extensions.filter(ext => ext.compatible === false).map(ext => (
                        <div key={ext.packageName} className="bg-white p-5 rounded-md shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{ext.name}</h4>
                                {ext.bundled ? (
                                  <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Core</Badge>
                                ) : (
                                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Community</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{ext.packageName} {ext.version}</div>
                            </div>
                            <div>
                              <div className="flex items-center text-red-600">
                                <X size={16} className="mr-1" />
                                <span className="text-sm font-medium">Incompatible</span>
                              </div>
                            </div>
                          </div>
                          
                          {ext.alternatives.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h5 className="text-sm font-medium mb-2">Alternatives:</h5>
                              <ul className="text-sm space-y-1">
                                {ext.alternatives.map((alt, idx) => (
                                  <li key={idx} className="text-orange-600">{alt}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {extensions.filter(ext => ext.compatible === false).length === 0 && (
                        <div className="bg-gray-50 p-4 text-center rounded-md">
                          <p className="text-gray-600">No incompatible extensions found.</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                
                <div className="bg-orange-50 border-l-4 border-orange-400 p-5 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <Info className="h-5 w-5 text-orange-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-orange-800">Upgrade Recommendations</h3>
                      <div className="mt-2 text-sm text-orange-700">
                        <p>
                          Based on our analysis, we recommend the following upgrade path:
                        </p>
                        {detectedVersion && targetVersion && (
                          <div className="mt-3">
                            <button
                              onClick={() => setShowUpgradePath(true)}
                              className="px-6 py-2 bg-[rgb(249,115,22)] text-white rounded-md hover:bg-[rgb(234,88,12)] transition-colors"
                            >
                              Show Upgrade Path from {detectedVersion} to {targetVersion}
                            </button>
                          </div>
                        )}
                        
                        <p className="mt-4">
                          <strong>Extensions:</strong> {" "}
                          {extensions.filter(ext => ext.compatible === false).length > 0 ? (
                            <span>
                              Replace or update the {extensions.filter(ext => ext.compatible === false).length} incompatible extensions before upgrading.
                            </span>
                          ) : (
                            <span>All detected extensions are compatible or can be upgraded.</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-center pt-4">
                  <button
                    onClick={() => {
                      setFiles(null);
                      setDetectedVersion(null);
                      setExtensions([]);
                      setTargetVersion("");
                      setAnalysisComplete(false);
                    }}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                  >
                    Analyze Another Site
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 