<?php

namespace Ephp\NodeBundle\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

/**
 * This is the class that validates and merges configuration from your app/config files
 *
 * To learn more see {@link http://symfony.com/doc/current/cookbook/bundles/extension.html#cookbook-bundles-extension-config-class}
 */
class Configuration implements ConfigurationInterface
{
    /**
     * {@inheritDoc}
     */
    public function getConfigTreeBuilder()
    {
        $treeBuilder = new TreeBuilder();
        $rootNode = $treeBuilder->root('ephp_node');

        $rootNode
                ->children()
                    ->arrayNode('tables')
                        ->addDefaultsIfNotSet()
                        ->children()
                            ->scalarNode('tb_users')->defaultValue('ephp_users')->cannotBeEmpty()->end()
                            ->scalarNode('tb_chat_room')->defaultValue('chat_room')->cannotBeEmpty()->end()
                            ->scalarNode('tb_chat_messages')->defaultValue('chat_messages')->cannotBeEmpty()->end()
                            ->scalarNode('tb_chat_notify')->defaultValue('chat_notify')->cannotBeEmpty()->end()
                        ->end()
                    ->end()
                    ->arrayNode('chat')
                        ->addDefaultsIfNotSet()
                        ->children()
                            ->scalarNode('chat_notify')->defaultValue(true)->end()
                            ->scalarNode('chat_open_room')->defaultValue(true)->end()
                            ->scalarNode('chat_one_to_one')->defaultValue(true)->end()
                            ->scalarNode('chat_group_room')->defaultValue(false)->end()
                        ->end()
                    ->end()
                ->end()
        ;

        return $treeBuilder;
    }
}
