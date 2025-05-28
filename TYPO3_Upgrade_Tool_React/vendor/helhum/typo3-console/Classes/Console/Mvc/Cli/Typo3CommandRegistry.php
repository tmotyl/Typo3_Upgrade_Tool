<?php
declare(strict_types=1);
namespace Helhum\Typo3Console\Mvc\Cli;

/*
 * This file is part of the TYPO3 Console project.
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version.
 *
 * For the full copyright and license information, please read
 * LICENSE file that was distributed with this source code.
 *
 */

use Psr\Container\ContainerInterface;
use TYPO3\CMS\Core\Console\CommandRegistry;

/**
 * Overrides the TYPO3 command registry to only contain the commands defined as services
 */
class Typo3CommandRegistry extends CommandRegistry
{
    public function __construct(CommandRegistry $commandRegistry)
    {
        parent::__construct($commandRegistry->container);
        $this->commandConfigurations = $commandRegistry->commandConfigurations;
    }

    /**
     * After TYPO3 is fully booted, a new container instance is built with all caches enabled
     * Make sure to instantiate all commands with this container instance
     *
     * @param ContainerInterface $container
     */
    public function updateContainer(ContainerInterface $container): void
    {
        $this->container = $container;
    }

    public function getServiceConfiguration(): array
    {
        return $this->commandConfigurations;
    }
}
