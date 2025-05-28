<?php

defined('TYPO3') or die();

\TYPO3\CMS\Extbase\Utility\ExtensionUtility::registerModule(
    'Vendor.ProjectExport', // Ensure the vendor name is included
    'system', // Main module key (e.g., "system" for System section)
    'export', // Submodule key
    '', // Position
    [
        \Vendor\ProjectExport\Controller\ExportController::class => 'index,export', // Controller and actions
    ],
    [
        'access' => 'admin', // Restrict access to admin users
        'icon' => 'EXT:project_export/Resources/Public/Icons/ext_icon.svg', // Path to the module icon
        'labels' => 'LLL:EXT:project_export/Resources/Private/Language/locallang_mod.xlf', // Path to the language file
    ]
);

\TYPO3\CMS\Core\Utility\ExtensionManagementUtility::addStaticFile(
    'project_export',
    'Configuration/TypoScript',
    'My Custom Template'
);

