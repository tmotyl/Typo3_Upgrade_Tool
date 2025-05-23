import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, HelpCircle, Info, Copy, CheckCircle, Calendar, Database, Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";

export default function TYPO3UpgradePath({ upgradeData, onBack, initialFromVersion, initialToVersion }) {
  const [sourceVersion, setSourceVersion] = useState("");
  const [targetVersion, setTargetVersion] = useState("");
  const [upgradePath, setUpgradePath] = useState([]);
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});
  
  // New state variables for sub-steps navigation
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepsPerVersion, setStepsPerVersion] = useState({});
  const [completedSteps, setCompletedSteps] = useState({});

  useEffect(() => {
    if (initialFromVersion) {
      setSourceVersion(initialFromVersion);
    }
    if (initialToVersion) {
      setTargetVersion(initialToVersion);
    }
    
    if (initialFromVersion && initialToVersion) {
      setShowGuide(true);
    }
  }, [initialFromVersion, initialToVersion]);

  const toggleSteps = (versionIndex) => {
    setExpandedSteps(prev => ({
      ...prev,
      [versionIndex]: !prev[versionIndex]
    }));
  };

  // New function to handle moving to the next step
  const goToNextStep = () => {
    // Get the current version's steps
    const currentVersionSteps = stepsPerVersion[currentVersionIndex] || 0;
    
    // If there are more steps for this version
    if (currentStepIndex < currentVersionSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // If we've reached the end of steps for this version, go to the next version
      if (currentVersionIndex < upgradePath.length - 1) {
        setCurrentVersionIndex(prev => prev + 1);
        setCurrentStepIndex(0);
      }
    }
    
    // Mark the step as completed
    setCompletedSteps(prev => ({
      ...prev,
      [`${currentVersionIndex}-${currentStepIndex}`]: true
    }));
  };
  
  // Function to go to previous step
  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    } else if (currentVersionIndex > 0) {
      setCurrentVersionIndex(prev => prev - 1);
      setCurrentStepIndex(stepsPerVersion[currentVersionIndex - 1] - 1);
    }
  };
  
  // Function to directly go to a specific step
  const goToStep = (versionIndex, stepIndex) => {
    setCurrentVersionIndex(versionIndex);
    setCurrentStepIndex(stepIndex);
  };

  // Function to get the total number of steps
  const getTotalSteps = () => {
    return Object.values(stepsPerVersion).reduce((total, steps) => total + steps, 0);
  };
  
  // Function to get the current step number (across all versions)
  const getCurrentStepNumber = () => {
    let stepNumber = 0;
    for (let i = 0; i < currentVersionIndex; i++) {
      stepNumber += stepsPerVersion[i] || 0;
    }
    return stepNumber + currentStepIndex + 1;
  };

  // Function to check if the current step is completed
  const isStepCompleted = (versionIndex, stepIndex) => {
    return completedSteps[`${versionIndex}-${stepIndex}`] === true;
  };
  
  // Function to initialize steps per version after path is calculated
  const initializeStepsPerVersion = (path) => {
    const stepsCount = {};
    
    path.forEach((version, index) => {
      // For each version, determine how many steps 
      // In this case, we always have 5 or fewer steps for each version
      // We're counting the standard upgrade steps:
      // 1. Backup, 2. Update composer, 3. DB Compare, 4. Upgrade Wizards, 5. Clear Cache
      
      // Count how many steps we have based on the version's requirements
      let count = 2; // Always have backup and update composer steps
      
      // Add DB Compare if needed
      if (version.db_changes) count++;
      
      // Add Upgrade Wizards if needed
      if (version.install_tool_migrations) count++;
      
      // Always have clear cache step
      count++;
      
      stepsCount[index] = count;
    });
    
    setStepsPerVersion(stepsCount);
  };

  const availableVersions = useMemo(() => {
    return [...upgradeData]
      .map(v => v.version)
      .sort((a, b) => {
        const versPartsA = a.split('.').map(Number);
        const versPartsB = b.split('.').map(Number);
        
        if (versPartsA[0] !== versPartsB[0]) {
          return versPartsA[0] - versPartsB[0];
        }
        return versPartsA[1] - versPartsB[1];
      });
  }, [upgradeData]);

  const compareVersions = (versionA, versionB) => {
    const partsA = versionA.split('.').map(Number);
    const partsB = versionB.split('.').map(Number);
    
    if (partsA[0] !== partsB[0]) {
      return partsA[0] - partsB[0];
    }
    
    return partsA[1] - partsB[1];
  };

  const findVersionInfo = (version) => {
    return upgradeData.find(v => v.version === version) || { version };
  };

  useEffect(() => {
    if (!sourceVersion || !targetVersion) {
      setUpgradePath([]);
      return;
    }

    if (sourceVersion === targetVersion) {
      setError("Source and target versions cannot be the same");
      setUpgradePath([]);
      return;
    }

    const sourceIdx = availableVersions.indexOf(sourceVersion);
    const targetIdx = availableVersions.indexOf(targetVersion);

    if (sourceIdx === -1 || targetIdx === -1) {
      setError("Invalid version selection");
      setUpgradePath([]);
      return;
    }

    if (compareVersions(sourceVersion, targetVersion) > 0) {
      setError("Downgrading is not supported. Target version must be higher than source version.");
      setUpgradePath([]);
      return;
    }

    setError("");

    const path = [];
    
    const sourceMajor = parseInt(sourceVersion.split('.')[0]);
    const targetMajor = parseInt(targetVersion.split('.')[0]);
    
    path.push(findVersionInfo(sourceVersion));

    if (sourceMajor < targetMajor) {
      for (let major = sourceMajor; major <= targetMajor; major++) {
        if (major === sourceMajor) continue;
        
        const majorVersions = availableVersions.filter(v => parseInt(v.split('.')[0]) === major);
        
        if (majorVersions.length > 0) {
          if (major === targetMajor) {
            if (path[path.length - 1].version !== targetVersion) {
              path.push(findVersionInfo(targetVersion));
            }
          } else {
            const ltsVersions = upgradeData
              .filter(v => parseInt(v.version.split('.')[0]) === major && v.type.toLowerCase() === 'lts')
              .map(v => v.version);
              
            if (ltsVersions.length > 0) {
              const sorted = [...ltsVersions].sort(compareVersions);
              const highestLTS = sorted[sorted.length - 1];
              path.push(findVersionInfo(highestLTS));
            } else {
              const sorted = [...majorVersions].sort(compareVersions);
              const highestVersion = sorted[sorted.length - 1];
              path.push(findVersionInfo(highestVersion));
            }
          }
        }
      }
    } else {
      if (path[path.length - 1].version !== targetVersion) {
        path.push(findVersionInfo(targetVersion));
      }
    }

    setUpgradePath(path);
    
    if (path.length > 0) {
      const initialExpandedState = {};
      path.forEach((_, index) => {
        initialExpandedState[index] = false;
      });
      setExpandedSteps(initialExpandedState);
      
      // Initialize steps per version
      initializeStepsPerVersion(path);
      
      // Reset navigation state
      setCurrentVersionIndex(0);
      setCurrentStepIndex(0);
      setCompletedSteps({});
    }
    
  }, [sourceVersion, targetVersion, availableVersions, upgradeData]);

  const showSelectedUpgrade = () => {
    if (!sourceVersion || !targetVersion) {
      setError("Please select both source and target versions first");
      return;
    }
    
    if (sourceVersion === targetVersion) {
      setError("Source and target versions cannot be the same");
      return;
    }
    
    if (compareVersions(sourceVersion, targetVersion) > 0) {
      setError("Downgrading is not supported. Target version must be higher than source version.");
      return;
    }
    
    setError("");
    
    setShowGuide(true);
    
    setExpandedSteps(prev => ({
      ...prev,
      0: true
    }));
  };

  const copyCommand = (command, index) => {
    navigator.clipboard.writeText(command).then(() => {
      setCopiedCommand(index);
      setTimeout(() => setCopiedCommand(null), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="typo3-header mb-6">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center">
            <button 
              onClick={onBack}
              className="mr-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="typo3-logo">TYPO3 Upgrade Path Calculator</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4">
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-6">Calculate Upgrade Path</h2>
            
            <div className="grid md:grid-cols-3 gap-6 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Version
                </label>
                <Select value={sourceVersion} onValueChange={setSourceVersion}>
                  <SelectTrigger className="w-full">
                    {sourceVersion || "Select source version"}
                  </SelectTrigger>
                  <SelectContent>
                    {availableVersions.map((version) => (
                      <SelectItem key={`source-${version}`} value={version}>
                        TYPO3 {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-center">
                <ArrowRight size={24} className="text-gray-400" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Version
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
            </div>
            
            <div className="mt-6 flex justify-center">
              <button 
                onClick={showSelectedUpgrade}
                className="px-6 py-2 border border-[rgb(249,115,22)] rounded-md text-[rgb(249,115,22)] hover:text-white hover:bg-[rgb(249,115,22)] transition-colors"
              >
                Show Upgrade Steps From Selected Versions
              </button>
            </div>
            
            {error && (
              <div className="mt-5 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded">
                <p>{error}</p>
              </div>
            )}
            
            <div className="mt-6 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <Info size={16} className="text-[rgb(249,115,22)]" />
                Select your current TYPO3 version and the version you want to upgrade to.
                We'll calculate the recommended upgrade path for you.
              </p>
            </div>
          </CardContent>
        </Card>
        
        {upgradePath.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main content area - takes 3/4 of the space */}
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold mb-6">Recommended Upgrade Path</h2>
              
              {showGuide && (
                <div>
                  <div className="bg-white rounded-lg shadow-md relative mb-6">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">TYPO3 {upgradePath[currentVersionIndex]?.version}</h3>
                        {upgradePath[currentVersionIndex]?.type && (
                          <Badge className={`typo3-badge-${upgradePath[currentVersionIndex]?.type}`}>
                            {upgradePath[currentVersionIndex]?.type.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
                        <div className="flex items-start space-x-2">
                          <Calendar className="h-5 w-5 text-[rgb(249,115,22)] flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Dates</h4>
                            {upgradePath[currentVersionIndex]?.release_date && (
                              <p className="text-xs text-gray-600">
                                Released: {new Date(upgradePath[currentVersionIndex]?.release_date).toLocaleDateString()}
                              </p>
                            )}
                            {upgradePath[currentVersionIndex]?.support && (
                              <>
                                <p className="text-xs text-gray-600">
                                  Support until: {upgradePath[currentVersionIndex]?.support.active_until}
                                </p>
                                <p className="text-xs text-gray-600">
                                  Security until: {upgradePath[currentVersionIndex]?.support.security_until}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <Server className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">System Requirements</h4>
                            {upgradePath[currentVersionIndex]?.requirements && (
                              <>
                                <p className="text-xs text-gray-600">
                                  PHP: {upgradePath[currentVersionIndex]?.requirements.php}
                                </p>
                                <p className="text-xs text-gray-600">
                                  MySQL/MariaDB: {upgradePath[currentVersionIndex]?.requirements.mysql}
                                </p>
                                <p className="text-xs text-gray-600">
                                  Composer: {upgradePath[currentVersionIndex]?.requirements.composer}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <Database className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Migration Requirements</h4>
                            <p className="text-xs text-gray-600">
                              Database changes: 
                              {upgradePath[currentVersionIndex]?.db_changes ? 
                                <span className="text-amber-600 font-medium"> Yes</span> : 
                                <span className="text-green-600 font-medium"> No</span>
                              }
                            </p>
                            <p className="text-xs text-gray-600">
                              Install Tool migrations: 
                              {upgradePath[currentVersionIndex]?.install_tool_migrations ? 
                                <span className="text-amber-600 font-medium"> Yes</span> : 
                                <span className="text-green-600 font-medium"> No</span>
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Current step */}
                      <div className="mt-4 pt-2 border-t">
                        {/* Step 1: Backup */}
                        {currentStepIndex === 0 && (
                          <div className="bg-gray-50 p-4 rounded-md mb-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">1. Backup your system</h5>
                              <button
                                onClick={() => copyCommand(`mkdir -p backups && tar -czf backups/typo3_backup_before_${upgradePath[currentVersionIndex]?.version}.tar.gz public typo3conf config composer.json composer.lock`, `backup-${currentVersionIndex}`)}
                                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              >
                                {copiedCommand === `backup-${currentVersionIndex}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                <span className="text-xs">Copy</span>
                              </button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                              {`mkdir -p backups && tar -czf backups/typo3_backup_before_${upgradePath[currentVersionIndex]?.version}.tar.gz public typo3conf config composer.json composer.lock`}
                            </pre>
                            <p className="text-sm mt-2 text-gray-600">Always backup your system before performing an upgrade.</p>
                          </div>
                        )}
                        
                        {/* Step 2: Update composer */}
                        {currentStepIndex === 1 && (
                          <div className="bg-gray-50 p-4 rounded-md mb-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">2. Update composer.json</h5>
                              <button
                                onClick={() => copyCommand(`composer require typo3/cms-core:^${upgradePath[currentVersionIndex]?.version} -W`, `composer-${currentVersionIndex}`)}
                                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              >
                                {copiedCommand === `composer-${currentVersionIndex}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                <span className="text-xs">Copy</span>
                              </button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                              {`composer require typo3/cms-core:^${upgradePath[currentVersionIndex]?.version} -W`}
                            </pre>
                            <p className="text-sm mt-2 text-gray-600">Update your composer dependencies to the new TYPO3 version using the -W flag (equivalent to --with-all-dependencies).</p>
                            <div className="mt-3 bg-amber-50 border-l-2 border-amber-500 p-2 text-sm text-amber-800">
                              <strong>Warning:</strong> Do not use --update-with-dependencies as it is deprecated and will cause dependency conflicts. Always use -W instead.
                            </div>
                          </div>
                        )}
                        
                        {/* Step 3: DB changes (if applicable) */}
                        {upgradePath[currentVersionIndex]?.db_changes && stepsPerVersion[currentVersionIndex] >= 3 && 
                         currentStepIndex === 2 && (
                          <div className="bg-gray-50 p-4 rounded-md mb-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">3. Run Database Compare</h5>
                              <button
                                onClick={() => copyCommand(`vendor/bin/typo3 database:updateschema`, `db-${currentVersionIndex}`)}
                                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              >
                                {copiedCommand === `db-${currentVersionIndex}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                <span className="text-xs">Copy</span>
                              </button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                              {`vendor/bin/typo3 database:updateschema`}
                            </pre>
                            <p className="text-sm mt-2 text-gray-600">Run database compare to update the database schema to match the new version.</p>
                            <div className="mt-3 bg-blue-50 border-l-2 border-blue-500 p-2 text-sm text-blue-800">
                              <strong>Note:</strong> If you encounter a 503 error after upgrading with "Incorrect integer value: 'info' for column 'level' at row 1" error, you need to manually fix the sys_log table schema. Run the following SQL query:
                              <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs mt-1 overflow-x-auto">
                                {`ALTER TABLE sys_log MODIFY level int(1) unsigned DEFAULT '0' NOT NULL;`}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {/* Step 4: Upgrade Wizards (if applicable) */}
                        {upgradePath[currentVersionIndex]?.install_tool_migrations && 
                         ((upgradePath[currentVersionIndex]?.db_changes && currentStepIndex === 3) || 
                          (!upgradePath[currentVersionIndex]?.db_changes && currentStepIndex === 2)) && (
                          <div className="bg-gray-50 p-4 rounded-md mb-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">{upgradePath[currentVersionIndex]?.db_changes ? "4" : "3"}. Run Upgrade Wizards</h5>
                              <button
                                onClick={() => copyCommand(`vendor/bin/typo3 upgrade:run`, `upgrade-${currentVersionIndex}`)}
                                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              >
                                {copiedCommand === `upgrade-${currentVersionIndex}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                <span className="text-xs">Copy</span>
                              </button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                              {`vendor/bin/typo3 upgrade:run`}
                            </pre>
                            <p className="text-sm mt-2 text-gray-600">Run the upgrade wizards to migrate data and configuration.</p>
                          </div>
                        )}
                        
                        {/* Troubleshooting Section - Show after DB Updates */}
                        {(upgradePath[currentVersionIndex]?.db_changes && currentStepIndex === 2) && (
                          <div className="bg-amber-50 p-4 rounded-md mb-3 border border-amber-200">
                            <h5 className="font-medium text-amber-800 mb-2">Common Upgrade Issues & Fixes</h5>
                            <div className="space-y-3">
                              <div>
                                <h6 className="text-sm font-semibold text-amber-800">503 Error - sys_log level issue</h6>
                                <p className="text-sm text-amber-700 mb-1">
                                  Error: "Incorrect integer value: 'info' for column 'level' at row 1"
                                </p>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-amber-700">Solution: Update the sys_log table schema</span>
                                  <button
                                    onClick={() => copyCommand(`ALTER TABLE sys_log MODIFY level int(1) unsigned DEFAULT '0' NOT NULL;`, `fix-sys-log`)}
                                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    {copiedCommand === `fix-sys-log` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="text-xs">Copy</span>
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                                  {`ALTER TABLE sys_log MODIFY level int(1) unsigned DEFAULT '0' NOT NULL;`}
                                </pre>
                              </div>
                              
                              <div className="mt-3">
                                <h6 className="text-sm font-semibold text-amber-800">Upgrade Wizard Error - be_users lang column</h6>
                                <p className="text-sm text-amber-700 mb-1">
                                  Error: "Data too long for column 'lang' at row 1" during upgrade wizard
                                </p>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-amber-700">Solution: Increase the size of the lang column</span>
                                  <button
                                    onClick={() => copyCommand(`ALTER TABLE be_users MODIFY lang varchar(20) DEFAULT '' NOT NULL;`, `fix-lang-column`)}
                                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    {copiedCommand === `fix-lang-column` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="text-xs">Copy</span>
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                                  {`ALTER TABLE be_users MODIFY lang varchar(20) DEFAULT '' NOT NULL;`}
                                </pre>
                              </div>
                              
                              <div>
                                <h6 className="text-sm font-semibold text-amber-800">Unable to connect to database</h6>
                                <p className="text-sm text-amber-700 mb-1">
                                  Check if your database credentials are correct in LocalConfiguration.php
                                </p>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                                  {`# Check and update database credentials if needed:
# Usually located at: config/system/settings.php or typo3conf/LocalConfiguration.php`}
                                </pre>
                              </div>
                              
                              <div>
                                <h6 className="text-sm font-semibold text-amber-800">Cache clearing issues</h6>
                                <p className="text-sm text-amber-700 mb-1">
                                  If the interface is broken after upgrade, manually clear all caches
                                </p>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs text-amber-700">Solution: Delete cache files</span>
                                  <button
                                    onClick={() => copyCommand(`rm -rf typo3temp/var/cache/*`, `clear-cache`)}
                                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    {copiedCommand === `clear-cache` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="text-xs">Copy</span>
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                                  {`rm -rf typo3temp/var/cache/*`}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Final Step: Clear Cache */}
                        {currentStepIndex === stepsPerVersion[currentVersionIndex] - 1 && (
                          <div className="bg-gray-50 p-4 rounded-md mb-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-medium">{stepsPerVersion[currentVersionIndex]}. Clear All Caches</h5>
                              <button
                                onClick={() => copyCommand(`vendor/bin/typo3 cache:flush`, `cache-${currentVersionIndex}`)}
                                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              >
                                {copiedCommand === `cache-${currentVersionIndex}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                <span className="text-xs">Copy</span>
                              </button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                              {`vendor/bin/typo3 cache:flush`}
                            </pre>
                            <p className="text-sm mt-2 text-gray-600">Flush all caches to ensure the system uses the new version's code.</p>
                          </div>
                        )}
                        
                        <div className="mt-3 text-sm text-gray-600">
                          <p className="flex items-start gap-2">
                            <Info size={16} className="text-[rgb(249,115,22)] flex-shrink-0 mt-1" />
                            <span>After completing this step, {currentStepIndex === stepsPerVersion[currentVersionIndex] - 1 && currentVersionIndex < upgradePath.length - 1 ? 
                              "you can proceed to the next version upgrade." : 
                              "continue with the next step."}</span>
                          </p>
                        </div>
                        
                        {/* Extension dependency handling guide */}
                        {currentStepIndex === 1 && (
                          <div className="mt-6 bg-blue-50 p-4 rounded-md border-l-4 border-blue-500">
                            <h5 className="font-medium text-blue-800 mb-2">Handling Extension Dependencies</h5>
                            <p className="text-sm text-blue-700 mb-2">
                              If you encounter compatibility issues with extensions, try these approaches:
                            </p>
                            <ol className="list-decimal pl-5 text-sm text-blue-700 space-y-2">
                              <li>
                                For specific extensions with compatibility issues, try checking why they're incompatible:
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm mt-1 overflow-x-auto">
                                  {`composer prohibits vendor/extension-name ^2.0`}
                                </pre>
                              </li>
                              <li>
                                To resolve conflicts with specific extensions, try using the -W flag for just that extension:
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm mt-1 overflow-x-auto">
                                  {`composer require vendor/extension-name:^2.0 -W`}
                                </pre>
                              </li>
                              <li>
                                To update all TYPO3 extensions at once for maximum compatibility:
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm mt-1 overflow-x-auto">
                                  {`composer update "typo3/*" -W`}
                                </pre>
                              </li>
                            </ol>
                            <p className="mt-3 text-sm text-blue-700">
                              <strong>Remember:</strong> Always back up your composer.json and composer.lock files before making changes.
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Navigation buttons */}
                      <div className="mt-6 flex justify-between">
                        <button 
                          onClick={goToPreviousStep}
                          disabled={currentVersionIndex === 0 && currentStepIndex === 0}
                          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
                            currentVersionIndex === 0 && currentStepIndex === 0 ? 
                            'bg-gray-200 text-gray-400 cursor-not-allowed' : 
                            'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <ArrowLeft size={16} className="mr-2" />
                          Previous
                        </button>
                        
                        <button 
                          onClick={goToNextStep}
                          disabled={currentVersionIndex === upgradePath.length - 1 && currentStepIndex === stepsPerVersion[currentVersionIndex] - 1}
                          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center ${
                            currentVersionIndex === upgradePath.length - 1 && currentStepIndex === stepsPerVersion[currentVersionIndex] - 1 ? 
                            'bg-gray-200 text-gray-400 cursor-not-allowed' : 
                            'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          Next
                          <ArrowRight size={16} className="ml-2" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 bg-orange-50 border-l-4 border-[rgb(249,115,22)] p-5 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <Info className="h-5 w-5 text-[rgb(249,115,22)]" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-orange-800">Upgrade Path Information</h3>
                        <div className="mt-2 text-sm text-orange-700">
                          <p>
                            This upgrade path recommends upgrading through {upgradePath.length} versions.
                            Always upgrade one TYPO3 version at a time, following the recommended path.
                          </p>
                          <p className="mt-1">
                            For LTS (Long Term Support) to LTS upgrades, it's generally recommended to upgrade
                            to each intermediate LTS version rather than skipping versions.
                          </p>
                          <p className="mt-1">
                            <strong>Current progress:</strong> Step {getCurrentStepNumber()} of {getTotalSteps()} total steps
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {!showGuide && (
                <div className="relative">
                  <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-gray-200"></div>
                  
                  <div className="space-y-6">
                    {upgradePath.map((version, index) => (
                      <div key={version.version} className="bg-white rounded-lg shadow-md relative">
                        <div className="absolute -left-3 top-6 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white font-bold z-10">
                          {index + 1}
                        </div>
                        
                        <div className="p-6 pl-10">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">TYPO3 {version.version}</h3>
                            {version.type && (
                              <Badge className={`typo3-badge-${version.type}`}>{version.type.toUpperCase()}</Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
                            {/* Version information here */}
                          </div>
                          
                          <button 
                            onClick={() => toggleSteps(index)}
                            className="w-full flex items-center justify-between p-4 mt-3 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                          >
                            <span className="font-medium">Upgrade Steps</span>
                            <ChevronDown 
                              size={20} 
                              className={`text-gray-500 transition-transform ${expandedSteps[index] ? 'rotate-180' : ''}`} 
                            />
                          </button>
                          
                          {expandedSteps[index] && (
                            <div className="mt-4 pt-2 border-t">
                              {/* Step 1: Backup */}
                              <div className="bg-gray-50 p-4 rounded-md mb-3">
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="font-medium">1. Backup your system</h5>
                                  <button
                                    onClick={() => copyCommand(`mkdir -p backups && tar -czf backups/typo3_backup_before_${version.version}.tar.gz public typo3conf config composer.json composer.lock`, `backup-${index}`)}
                                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    {copiedCommand === `backup-${index}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="text-xs">Copy</span>
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                                  {`mkdir -p backups && tar -czf backups/typo3_backup_before_${version.version}.tar.gz public typo3conf config composer.json composer.lock`}
                                </pre>
                                <p className="text-sm mt-2 text-gray-600">Always backup your system before performing an upgrade.</p>
                              </div>

                              {/* Step 2: Update composer */}
                              <div className="bg-gray-50 p-4 rounded-md mb-3">
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="font-medium">2. Update composer.json</h5>
                                  <button
                                    onClick={() => copyCommand(`composer require typo3/cms-core:^${version.version} -W`, `composer-${index}`)}
                                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    {copiedCommand === `composer-${index}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="text-xs">Copy</span>
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                                  {`composer require typo3/cms-core:^${version.version} -W`}
                                </pre>
                                <p className="text-sm mt-2 text-gray-600">Update your composer dependencies to the new TYPO3 version using the -W flag (equivalent to --with-all-dependencies).</p>
                                <div className="mt-3 bg-amber-50 border-l-2 border-amber-500 p-2 text-sm text-amber-800">
                                  <strong>Warning:</strong> Do not use --update-with-dependencies as it is deprecated and will cause dependency conflicts. Always use -W instead.
                                </div>
                              </div>

                              {/* Step 3: DB changes (if applicable) */}
                              {version.db_changes && (
                                <div className="bg-gray-50 p-4 rounded-md mb-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-medium">3. Run Database Compare</h5>
                                    <button
                                      onClick={() => copyCommand(`vendor/bin/typo3 database:updateschema`, `db-${index}`)}
                                      className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                    >
                                      {copiedCommand === `db-${index}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                      <span className="text-xs">Copy</span>
                                    </button>
                                  </div>
                                  <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                                    {`vendor/bin/typo3 database:updateschema`}
                                  </pre>
                                  <p className="text-sm mt-2 text-gray-600">Run database compare to update the database schema to match the new version.</p>
                                  <div className="mt-3 bg-blue-50 border-l-2 border-blue-500 p-2 text-sm text-blue-800">
                                    <strong>Note:</strong> If you encounter a 503 error after upgrading with "Incorrect integer value: 'info' for column 'level' at row 1" error, you need to manually fix the sys_log table schema. Run the following SQL query:
                                    <pre className="bg-gray-900 text-gray-100 p-2 rounded text-xs mt-1 overflow-x-auto">
                                      {`ALTER TABLE sys_log MODIFY level int(1) unsigned DEFAULT '0' NOT NULL;`}
                                    </pre>
                                  </div>
                                </div>
                              )}

                              {/* Step 4: Upgrade Wizards (if applicable) */}
                              {version.install_tool_migrations && (
                                <div className="bg-gray-50 p-4 rounded-md mb-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-medium">{version.db_changes ? "4" : "3"}. Run Upgrade Wizards</h5>
                                    <button
                                      onClick={() => copyCommand(`vendor/bin/typo3 upgrade:run`, `upgrade-${index}`)}
                                      className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                    >
                                      {copiedCommand === `upgrade-${index}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                      <span className="text-xs">Copy</span>
                                    </button>
                                  </div>
                                  <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                                    {`vendor/bin/typo3 upgrade:run`}
                                  </pre>
                                  <p className="text-sm mt-2 text-gray-600">Run the upgrade wizards to migrate data and configuration.</p>
                                </div>
                              )}

                              {/* Final Step: Clear Cache */}
                              <div className="bg-gray-50 p-4 rounded-md mb-3">
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="font-medium">{stepsPerVersion[index] || (version.db_changes && version.install_tool_migrations ? 5 : (version.db_changes || version.install_tool_migrations ? 4 : 3))}. Clear All Caches</h5>
                                  <button
                                    onClick={() => copyCommand(`vendor/bin/typo3 cache:flush`, `cache-${index}`)}
                                    className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                  >
                                    {copiedCommand === `cache-${index}` ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                                    <span className="text-xs">Copy</span>
                                  </button>
                                </div>
                                <pre className="bg-gray-900 text-gray-100 p-2 rounded text-sm overflow-x-auto">
                                  {`vendor/bin/typo3 cache:flush`}
                                </pre>
                                <p className="text-sm mt-2 text-gray-600">Flush all caches to ensure the system uses the new version's code.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Right sidebar for navigation - takes 1/4 of the space */}
            {showGuide && (
              <div className="lg:col-span-1 sticky top-4 self-start">
                <div className="bg-white rounded-lg shadow-md p-4">
                  <h3 className="text-lg font-semibold mb-4">Upgrade Navigation</h3>
                  
                  <div className="space-y-2">
                    {upgradePath.map((version, versionIndex) => (
                      <div key={versionIndex} className="mb-4">
                        <div 
                          className={`flex items-center p-2 rounded-md ${
                            currentVersionIndex === versionIndex ? 'bg-orange-50 border-l-2 border-orange-500' : ''
                          }`}
                        >
                          <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium mr-2">
                            {versionIndex + 1}
                          </span>
                          <span className="font-medium">TYPO3 {version.version}</span>
                        </div>
                        
                        {/* Sub-steps for this version */}
                        <div className="ml-8 mt-2 space-y-1">
                          {/* Step 1 - Always Backup */}
                          <button
                            onClick={() => goToStep(versionIndex, 0)}
                            className={`w-full text-left text-sm py-1 px-2 rounded ${
                              currentVersionIndex === versionIndex && currentStepIndex === 0 ? 
                              'bg-orange-100 text-orange-800' : 
                              isStepCompleted(versionIndex, 0) ? 'text-gray-400' : 'text-gray-600'
                            } hover:bg-gray-100`}
                          >
                            {isStepCompleted(versionIndex, 0) && <Check size={14} className="inline mr-1 text-green-500" />}
                            1. Backup
                          </button>
                          
                          {/* Step 2 - Always Composer Update */}
                          <button
                            onClick={() => goToStep(versionIndex, 1)}
                            className={`w-full text-left text-sm py-1 px-2 rounded ${
                              currentVersionIndex === versionIndex && currentStepIndex === 1 ? 
                              'bg-orange-100 text-orange-800' : 
                              isStepCompleted(versionIndex, 1) ? 'text-gray-400' : 'text-gray-600'
                            } hover:bg-gray-100`}
                          >
                            {isStepCompleted(versionIndex, 1) && <Check size={14} className="inline mr-1 text-green-500" />}
                            2. Update
                          </button>
                          
                          {/* Optional Step 3 - DB Changes */}
                          {version.db_changes && (
                            <button
                              onClick={() => goToStep(versionIndex, 2)}
                              className={`w-full text-left text-sm py-1 px-2 rounded ${
                                currentVersionIndex === versionIndex && currentStepIndex === 2 ? 
                                'bg-orange-100 text-orange-800' : 
                                isStepCompleted(versionIndex, 2) ? 'text-gray-400' : 'text-gray-600'
                              } hover:bg-gray-100`}
                            >
                              {isStepCompleted(versionIndex, 2) && <Check size={14} className="inline mr-1 text-green-500" />}
                              3. Database
                            </button>
                          )}
                          
                          {/* Optional Step 4 - Install Tool Migrations */}
                          {version.install_tool_migrations && (
                            <button
                              onClick={() => goToStep(versionIndex, version.db_changes ? 3 : 2)}
                              className={`w-full text-left text-sm py-1 px-2 rounded ${
                                currentVersionIndex === versionIndex && 
                                (version.db_changes ? currentStepIndex === 3 : currentStepIndex === 2) ? 
                                'bg-orange-100 text-orange-800' : 
                                isStepCompleted(versionIndex, version.db_changes ? 3 : 2) ? 'text-gray-400' : 'text-gray-600'
                              } hover:bg-gray-100`}
                            >
                              {isStepCompleted(versionIndex, version.db_changes ? 3 : 2) && 
                                <Check size={14} className="inline mr-1 text-green-500" />}
                              {version.db_changes ? "4" : "3"}. Wizards
                            </button>
                          )}
                          
                          {/* Final Step - Clear Cache */}
                          <button
                            onClick={() => goToStep(versionIndex, stepsPerVersion[versionIndex] - 1)}
                            className={`w-full text-left text-sm py-1 px-2 rounded ${
                              currentVersionIndex === versionIndex && currentStepIndex === stepsPerVersion[versionIndex] - 1 ? 
                              'bg-orange-100 text-orange-800' : 
                              isStepCompleted(versionIndex, stepsPerVersion[versionIndex] - 1) ? 'text-gray-400' : 'text-gray-600'
                            } hover:bg-gray-100`}
                          >
                            {isStepCompleted(versionIndex, stepsPerVersion[versionIndex] - 1) && 
                              <Check size={14} className="inline mr-1 text-green-500" />}
                            {stepsPerVersion[versionIndex]}. Cache
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 text-center">
                    <div className="text-sm text-gray-600 mb-2">
                      Progress: {Math.round((getCurrentStepNumber() / getTotalSteps()) * 100)}%
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-primary h-2.5 rounded-full" 
                        style={{ width: `${Math.round((getCurrentStepNumber() / getTotalSteps()) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-10 text-center">
          <button 
            onClick={onBack}
            className="inline-flex items-center px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Version List
          </button>
        </div>
      </div>
    </div>
  );
} 