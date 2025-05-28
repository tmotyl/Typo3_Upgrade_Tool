<?php

defined('TYPO3') or die();

\TYPO3\CMS\Core\Utility\ExtensionManagementUtility::addStaticFile(
    'project_export',
    'Configuration/TypoScript',
    'Project Export Configuration'
);
