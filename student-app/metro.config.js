// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('db', 'mdx');

// Native build outputs and local export checks are not JavaScript sources. Keeping
// Metro out of them makes a cold development-server start practical on this project.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  new RegExp(`${escapeRegExp(path.resolve(__dirname, 'android'))}.*`),
  new RegExp(`${escapeRegExp(path.resolve(__dirname, '.tmp'))}.*`),
];

module.exports = config;
