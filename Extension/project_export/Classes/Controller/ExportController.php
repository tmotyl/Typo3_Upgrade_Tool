<?php

namespace Vendor\ProjectExport\Controller;

use TYPO3\CMS\Extbase\Mvc\Controller\ActionController;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Core\Core\Environment;
use TYPO3\CMS\Core\Http\Response;
use TYPO3\CMS\Backend\Template\BackendTemplateView;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;
use TYPO3\CMS\Core\Authentication\BackendUserAuthentication;
use TYPO3\CMS\Core\Utility\PathUtility;
use TYPO3\CMS\Core\Database\ConnectionPool;
use Psr\Http\Message\ResponseInterface;

class ExportController extends ActionController
{
    /**
     * @var BackendTemplateView
     */
    protected $view;

    public function initializeView(\TYPO3\CMS\Extbase\Mvc\View\ViewInterface $view)
    {
        $this->view = $view;
        $this->view->setTemplateRootPaths(['EXT:project_export/Resources/Private/Templates/']);
        $this->view->setPartialRootPaths(['EXT:project_export/Resources/Private/Partials/']);
        $this->view->setLayoutRootPaths(['EXT:project_export/Resources/Private/Layouts/']);
    }

    public function initializeAction()
    {
        $backendUser = $this->getBackendUser();
        if (!$backendUser || !isset($backendUser->user['uid']) || (int)$backendUser->user['uid'] === 0) {
            $this->addFlashMessage('Access denied. Please log in to the TYPO3 backend.', 'Authentication Error', \TYPO3\CMS\Core\Messaging\AbstractMessage::ERROR);
            $this->redirect('index');
        }
    }

    public function indexAction()
    {
        $this->view->assign('message', 'Welcome to the Export Module!');
    }

    public function exportAction(): ResponseInterface
    {
        $backendUser = $this->getBackendUser();
        if (!$backendUser || !isset($backendUser->user['uid']) || (int)$backendUser->user['uid'] === 0) {
            return new JsonResponse(['error' => 'Access denied. Please log in to the TYPO3 backend.'], 403);
        }

        error_log('ExportAction executed successfully for user: ' . ($backendUser->user['username'] ?? 'Unknown'));

        try {
            $typo3Version = \TYPO3\CMS\Core\Utility\VersionNumberUtility::getNumericTypo3Version();
            $phpVersion = phpversion();
            $databaseInfo = $this->getDatabaseInfo();
            $webServerInfo = $this->getWebServerInfo();

            $extensions = $this->getInstalledExtensionsWithDetails();

            $projectData = [
                'TYPO3Version' => $typo3Version,
                'PHPVersion' => $phpVersion,
                'DatabaseInfo' => $databaseInfo,
                'WebServerInfo' => $webServerInfo,
                'InstalledExtensions' => $extensions,
                'ExportTimestamp' => date('Y-m-d H:i:s'),
                'ExportedBy' => $backendUser->user['username'] ?? 'Unknown'
            ];

            $jsonContent = json_encode($projectData, JSON_PRETTY_PRINT);

            $response = new Response();
            $response->getBody()->write($jsonContent);

            return $response
                ->withHeader('Content-Type', 'application/json')
                ->withHeader('Content-Disposition', 'attachment; filename="project_data_' . date('Y-m-d_H-i-s') . '.json"')
                ->withHeader('Content-Length', (string)strlen($jsonContent));

        } catch (\Exception $e) {
            error_log('Export failed: ' . $e->getMessage());
            return new JsonResponse(['error' => 'Export failed: ' . $e->getMessage()], 500);
        }
    }

    public function exportFileAction(): ResponseInterface
    {
        $backendUser = $this->getBackendUser();
        if (!$backendUser || !$backendUser->isLoggedIn()) {
            return new JsonResponse(['error' => 'Access denied. Please log in to the TYPO3 backend.'], 403);
        }

        try {
            $tempDir = Environment::getPublicPath() . '/typo3temp/';
            if (!is_dir($tempDir)) {
                GeneralUtility::mkdir_deep($tempDir);
            }

            $filename = 'project_data_' . date('Y-m-d_H-i-s') . '.json';
            $jsonFilePath = $tempDir . $filename;

            $typo3Version = \TYPO3\CMS\Core\Utility\VersionNumberUtility::getNumericTypo3Version();
            $phpVersion = phpversion();
            $databaseInfo = $this->getDatabaseInfo();
            $webServerInfo = $this->getWebServerInfo();

            $extensions = $this->getInstalledExtensionsWithDetails();

            $projectData = [
                'TYPO3Version' => $typo3Version,
                'PHPVersion' => $phpVersion,
                'DatabaseInfo' => $databaseInfo,
                'WebServerInfo' => $webServerInfo,
                'InstalledExtensions' => $extensions,
                'ExportTimestamp' => date('Y-m-d H:i:s'),
                'ExportedBy' => $backendUser->user['username'] ?? 'Unknown'
            ];

            $jsonContent = json_encode($projectData, JSON_PRETTY_PRINT);

            if (file_put_contents($jsonFilePath, $jsonContent) === false) {
                throw new \RuntimeException("Failed to create JSON file: $jsonFilePath");
            }

            $response = new Response();
            $response->getBody()->write($jsonContent);

            return $response
                ->withHeader('Content-Type', 'application/json')
                ->withHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
                ->withHeader('Content-Length', (string)strlen($jsonContent));

        } catch (\Exception $e) {
            error_log('Export failed: ' . $e->getMessage());
            return new JsonResponse(['error' => 'Export failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get database information
     *
     * @return array
     */
    protected function getDatabaseInfo(): array
    {
        try {
            $connectionPool = GeneralUtility::makeInstance(ConnectionPool::class);
            $connection = $connectionPool->getConnectionByName('Default');
            
            $databaseInfo = [
                'Driver' => $connection->getDriver()->getName(),
                'Platform' => $connection->getDatabasePlatform()->getName(),
                'Version' => 'Unknown',
                'DatabaseName' => $connection->getDatabase(),
                'Host' => $connection->getHost(),
                'Port' => $connection->getPort()
            ];

            // Próba pobrania wersji bazy danych
            try {
                if (strpos($databaseInfo['Platform'], 'mysql') !== false) {
                    $result = $connection->executeQuery('SELECT VERSION() as version');
                    $row = $result->fetchAssociative();
                    $databaseInfo['Version'] = $row['version'] ?? 'Unknown';
                    $databaseInfo['Type'] = 'MySQL';
                } elseif (strpos($databaseInfo['Platform'], 'postgresql') !== false) {
                    $result = $connection->executeQuery('SELECT version() as version');
                    $row = $result->fetchAssociative();
                    $databaseInfo['Version'] = $row['version'] ?? 'Unknown';
                    $databaseInfo['Type'] = 'PostgreSQL';
                } elseif (strpos($databaseInfo['Platform'], 'sqlite') !== false) {
                    $result = $connection->executeQuery('SELECT sqlite_version() as version');
                    $row = $result->fetchAssociative();
                    $databaseInfo['Version'] = $row['version'] ?? 'Unknown';
                    $databaseInfo['Type'] = 'SQLite';
                } else {
                    $databaseInfo['Type'] = 'Other';
                }
            } catch (\Exception $e) {
                error_log('Failed to get database version: ' . $e->getMessage());
                $databaseInfo['Type'] = 'Unknown';
            }

            return $databaseInfo;

        } catch (\Exception $e) {
            error_log('Failed to get database info: ' . $e->getMessage());
            return [
                'Error' => 'Failed to retrieve database information',
                'Message' => $e->getMessage()
            ];
        }
    }

    /**
     * Get web server information
     *
     * @return array
     */
    protected function getWebServerInfo(): array
    {
        $serverInfo = [
            'ServerSoftware' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'ServerName' => $_SERVER['SERVER_NAME'] ?? 'Unknown',
            'ServerPort' => $_SERVER['SERVER_PORT'] ?? 'Unknown',
            'HTTPS' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'Yes' : 'No',
            'DocumentRoot' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
            'RequestMethod' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
            'HTTPHost' => $_SERVER['HTTP_HOST'] ?? 'Unknown'
        ];

        // Określenie typu serwera web
        $serverSoftware = strtolower($serverInfo['ServerSoftware']);
        if (strpos($serverSoftware, 'nginx') !== false) {
            $serverInfo['ServerType'] = 'Nginx';
        } elseif (strpos($serverSoftware, 'apache') !== false) {
            $serverInfo['ServerType'] = 'Apache';
        } elseif (strpos($serverSoftware, 'iis') !== false) {
            $serverInfo['ServerType'] = 'IIS';
        } elseif (strpos($serverSoftware, 'lighttpd') !== false) {
            $serverInfo['ServerType'] = 'Lighttpd';
        } else {
            $serverInfo['ServerType'] = 'Other/Unknown';
        }

        // Dodatkowe informacje o PHP SAPI
        $serverInfo['PHPSAPI'] = php_sapi_name();
        
        // Informacje o systemie operacyjnym
        $serverInfo['OperatingSystem'] = PHP_OS;
        $serverInfo['SystemLoad'] = function_exists('sys_getloadavg') ? sys_getloadavg() : 'Not available';

        return $serverInfo;
    }

    /**
     * Get installed extensions with version and vendor
     *
     * @return array
     */
    protected function getInstalledExtensionsWithDetails(): array
    {
        $extensions = [];
        $extensionKeys = ExtensionManagementUtility::getLoadedExtensionListArray();

        foreach ($extensionKeys as $extensionKey) {
            $version = ExtensionManagementUtility::getExtensionVersion($extensionKey) ?? 'Unknown';
            $vendor = 'Unknown';

            $composerJsonPath = ExtensionManagementUtility::extPath($extensionKey) . 'composer.json';
            if (file_exists($composerJsonPath)) {
                $composerData = json_decode(file_get_contents($composerJsonPath), true);
                if (isset($composerData['name'])) {
                    $nameParts = explode('/', $composerData['name']);
                    $vendor = $nameParts[0] ?? 'Unknown';
                }
            }

            $extensions[] = [
                'ExtensionKey' => $extensionKey,
                'Version' => $version,
                'Vendor' => $vendor
            ];
        }

        return $extensions;
    }

    /**
     * Get current backend user
     *
     * @return BackendUserAuthentication|null
     */
    protected function getBackendUser(): ?BackendUserAuthentication
    {
        return $GLOBALS['BE_USER'] ?? null;
    }
}