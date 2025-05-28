<?php

$EMCONF[$_EXTKEY] = [
    'title' => 'Project Upgrade Support',
    'description' => 'Exports project data to help upgrade the system as JSON',
    'category' => 'module',
    'author' => 'macopedia',
    'author_email' => 'office@macopedia.com',
    'state' => 'beta',
    'clearCacheOnLoad' => 1,
    'version' => '1.0.0',
    'constraints' => [
        'depends' => [
            'typo3' => '11.5.0-11.5.99'
        ],
    ],
];
