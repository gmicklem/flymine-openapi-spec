/**
 * Configuration Loader Module
 * Loads and validates test configuration
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Load configuration from file
 * @param {String} configPath - Path to configuration file
 * @returns {Object} Configuration object
 */
async function loadConfig(configPath) {
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    return validateConfig(config);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Config file doesn't exist, return defaults
      return getDefaultConfig();
    }
    throw error;
  }
}

/**
 * Validate configuration object
 */
function validateConfig(config) {
  const validated = {
    ...getDefaultConfig(),
    ...config
  };

  // Validate timeout
  if (validated.timeout && typeof validated.timeout !== 'number') {
    validated.timeout = parseInt(validated.timeout);
  }

  // Validate parallel
  if (validated.parallel && typeof validated.parallel !== 'number') {
    validated.parallel = parseInt(validated.parallel);
  }

  // Validate headers
  if (validated.headers && typeof validated.headers !== 'object') {
    validated.headers = {};
  }

  // Validate auth
  if (validated.auth && typeof validated.auth !== 'object') {
    validated.auth = {};
  }

  return validated;
}

/**
 * Get default configuration
 */
function getDefaultConfig() {
  return {
    baseURL: null,
    timeout: 30000,
    parallel: 5,
    testExamples: true,
    testAll: false,
    skipSSL: false,
    verbose: false,
    filter: null,
    skip: [],
    headers: {},
    auth: {},
    serverVariables: {}
  };
}

/**
 * Create example configuration file
 */
async function createExampleConfig(filePath) {
  const exampleConfig = {
    "$schema": "./test-config.schema.json",
    "baseURL": "https://www.flymine.org/flymine/service",
    "timeout": 30000,
    "parallel": 5,
    "testExamples": true,
    "testAll": false,
    "skipSSL": false,
    "verbose": false,
    "filter": null,
    "skip": [
      "operationIdToSkip1",
      "operationIdToSkip2"
    ],
    "headers": {
      "User-Agent": "OpenAPI-Test-Runner/1.0",
      "Accept": "application/json"
    },
    "auth": {
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "value": "your-api-key-here"
      },
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "token": "your-bearer-token-here"
      },
      "basicAuth": {
        "type": "http",
        "scheme": "basic",
        "username": "username",
        "password": "password"
      }
    },
    "serverVariables": {
      "environment": "production",
      "version": "v1"
    },
    "customTests": [
      {
        "name": "Custom Test 1",
        "path": "/api/test",
        "method": "GET",
        "params": {
          "param1": "value1"
        },
        "expectedStatus": 200,
        "expectedResponse": {
          "success": true
        }
      }
    ]
  };

  await fs.writeFile(filePath, JSON.stringify(exampleConfig, null, 2));
  return exampleConfig;
}

module.exports = {
  loadConfig,
  validateConfig,
  getDefaultConfig,
  createExampleConfig
};