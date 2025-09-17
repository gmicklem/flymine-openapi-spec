/**
 * Endpoint Tester Module
 * Tests API endpoints using examples from OpenAPI specification
 */

const axios = require('axios');
const pLimit = require('p-limit');
const chalk = require('chalk');
const FormData = require('form-data');
const { URL } = require('url');

/**
 * Test all endpoints in the specification
 * @param {Object} spec - OpenAPI specification
 * @param {Object} config - Test configuration
 * @returns {Object} Test results
 */
async function testEndpoints(spec, config) {
  const results = {
    tests: [],
    summary: {
      total: 0,
      tested: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  // Get base URL from servers
  const baseURL = getBaseURL(spec, config);

  // Create axios instance with defaults
  const client = axios.create({
    baseURL,
    timeout: config.timeout || 30000,
    headers: {
      'User-Agent': 'OpenAPI-Test-Runner/1.0',
      ...config.headers
    },
    validateStatus: () => true, // Don't throw on any status
    httpsAgent: config.skipSSL ? new (require('https').Agent)({ rejectUnauthorized: false }) : undefined
  });

  // Collect all test cases
  const testCases = collectTestCases(spec, config);
  results.summary.total = testCases.length;

  if (testCases.length === 0) {
    console.log(chalk.yellow('  No test cases found'));
    return results;
  }

  // Create rate limiter
  const limit = pLimit(config.parallel || 5);

  // Progress tracking
  let completed = 0;
  const progressInterval = setInterval(() => {
    if (!config.verbose && completed > 0) {
      process.stdout.write(`\r  Testing: ${completed}/${testCases.length}`);
    }
  }, 100);

  // Run tests with rate limiting
  const testPromises = testCases.map(testCase =>
    limit(async () => {
      const result = await runTest(client, testCase, config);
      completed++;

      if (config.verbose) {
        displayTestResult(result);
      }

      results.tests.push(result);
      results.summary.tested++;

      if (result.status === 'passed') {
        results.summary.passed++;
      } else if (result.status === 'failed') {
        results.summary.failed++;
      } else {
        results.summary.skipped++;
      }

      return result;
    })
  );

  await Promise.all(testPromises);

  clearInterval(progressInterval);
  if (!config.verbose) {
    process.stdout.write('\r'); // Clear progress line
  }

  return results;
}

/**
 * Get base URL from specification
 */
function getBaseURL(spec, config) {
  if (config.baseURL) {
    return config.baseURL;
  }

  if (spec.servers && spec.servers.length > 0) {
    let url = spec.servers[0].url;

    // Handle variables in server URL
    if (spec.servers[0].variables) {
      for (const [varName, varDef] of Object.entries(spec.servers[0].variables)) {
        const value = config.serverVariables?.[varName] || varDef.default || varDef.enum?.[0];
        url = url.replace(`{${varName}}`, value);
      }
    }

    return url;
  }

  return 'http://localhost:3000'; // Default fallback
}

/**
 * Collect test cases from specification
 */
function collectTestCases(spec, config) {
  const testCases = [];

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    // Check filter
    if (config.filter && !path.match(new RegExp(config.filter))) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
        continue;
      }

      // Skip if operation is marked as skip in config
      if (config.skip?.includes(operation.operationId)) {
        continue;
      }

      // Create base test case
      const baseTestCase = {
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        operation
      };

      // Collect test cases from examples
      if (config.testExamples) {
        const exampleCases = collectExamplesFromOperation(operation, baseTestCase);
        testCases.push(...exampleCases);
      }

      // Add default test case if requested
      if (config.testAll && testCases.length === 0) {
        testCases.push({
          ...baseTestCase,
          name: `${method.toUpperCase()} ${path}`,
          example: null
        });
      }
    }
  }

  return testCases;
}

/**
 * Collect test cases from operation examples
 */
function collectExamplesFromOperation(operation, baseTestCase) {
  const testCases = [];

  // Check for examples in parameters
  const paramExamples = {};
  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (!param.$ref) {
        if (param.example !== undefined) {
          paramExamples[param.name] = param.example;
        } else if (param.examples) {
          for (const [name, example] of Object.entries(param.examples)) {
            testCases.push({
              ...baseTestCase,
              name: `${baseTestCase.method} ${baseTestCase.path} - ${name}`,
              example: {
                parameters: { [param.name]: example.value || example }
              }
            });
          }
        }
      }
    }
  }

  // Check for examples in request body
  if (operation.requestBody?.content) {
    for (const [mediaType, content] of Object.entries(operation.requestBody.content)) {
      if (content.example) {
        testCases.push({
          ...baseTestCase,
          name: `${baseTestCase.method} ${baseTestCase.path} - Request Example`,
          example: {
            requestBody: {
              mediaType,
              content: content.example
            }
          }
        });
      } else if (content.examples) {
        for (const [name, example] of Object.entries(content.examples)) {
          testCases.push({
            ...baseTestCase,
            name: `${baseTestCase.method} ${baseTestCase.path} - ${name}`,
            example: {
              requestBody: {
                mediaType,
                content: example.value || example
              }
            }
          });
        }
      }
    }
  }

  // Check x-examples extension
  if (operation['x-examples']) {
    for (const [name, example] of Object.entries(operation['x-examples'])) {
      testCases.push({
        ...baseTestCase,
        name: `${baseTestCase.method} ${baseTestCase.path} - ${name}`,
        example
      });
    }
  }

  // If we found parameter examples but no complete examples, create one
  if (Object.keys(paramExamples).length > 0 && testCases.length === 0) {
    testCases.push({
      ...baseTestCase,
      name: `${baseTestCase.method} ${baseTestCase.path} - Default`,
      example: { parameters: paramExamples }
    });
  }

  return testCases;
}

/**
 * Run a single test
 */
async function runTest(client, testCase, config) {
  const result = {
    name: testCase.name,
    path: testCase.path,
    method: testCase.method,
    operationId: testCase.operationId,
    status: 'skipped',
    duration: 0,
    request: {},
    response: {},
    error: null
  };

  const startTime = Date.now();

  try {
    // Build request
    const request = buildRequest(testCase, config);
    result.request = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      data: request.data
    };

    // Make request
    const response = await client.request(request);
    result.duration = Date.now() - startTime;

    // Store response
    result.response = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    };

    // Validate response
    const validation = validateResponse(response, testCase.operation);

    if (validation.valid) {
      result.status = 'passed';
    } else {
      result.status = 'failed';
      result.error = validation.errors.join('; ');
    }

    // Check for expected status codes
    if (testCase.operation.responses) {
      const expectedCodes = Object.keys(testCase.operation.responses);
      const statusMatch = expectedCodes.some(code =>
        code === 'default' ||
        code === String(response.status) ||
        (code === '2XX' && response.status >= 200 && response.status < 300) ||
        (code === '3XX' && response.status >= 300 && response.status < 400) ||
        (code === '4XX' && response.status >= 400 && response.status < 500) ||
        (code === '5XX' && response.status >= 500 && response.status < 600)
      );

      if (!statusMatch && result.status === 'passed') {
        result.status = 'failed';
        result.error = `Unexpected status code: ${response.status}`;
      }
    }

  } catch (error) {
    result.duration = Date.now() - startTime;
    result.status = 'failed';
    result.error = error.message;

    if (error.response) {
      result.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data
      };
    }
  }

  return result;
}

/**
 * Build request from test case
 */
function buildRequest(testCase, config) {
  const request = {
    method: testCase.method.toLowerCase(),
    url: testCase.path,
    headers: {},
    params: {},
    data: undefined
  };

  // Apply parameters
  if (testCase.example?.parameters) {
    for (const [name, value] of Object.entries(testCase.example.parameters)) {
      const param = testCase.operation.parameters?.find(p => p.name === name);

      if (param) {
        switch (param.in) {
          case 'path':
            request.url = request.url.replace(`{${name}}`, encodeURIComponent(value));
            break;
          case 'query':
            request.params[name] = value;
            break;
          case 'header':
            request.headers[name] = value;
            break;
        }
      }
    }
  } else if (testCase.operation.parameters) {
    // Use default/example values from parameter definitions
    for (const param of testCase.operation.parameters) {
      if (!param.$ref) {
        let value = param.example || param.schema?.example || param.schema?.default;

        // Generate default value based on type if needed
        if (value === undefined && param.required) {
          value = generateDefaultValue(param.schema);
        }

        if (value !== undefined) {
          switch (param.in) {
            case 'path':
              request.url = request.url.replace(`{${param.name}}`, encodeURIComponent(value));
              break;
            case 'query':
              request.params[param.name] = value;
              break;
            case 'header':
              request.headers[param.name] = value;
              break;
          }
        }
      }
    }
  }

  // Apply request body
  if (testCase.example?.requestBody) {
    const { mediaType, content } = testCase.example.requestBody;
    request.headers['Content-Type'] = mediaType;

    if (mediaType.includes('json')) {
      request.data = content;
    } else if (mediaType.includes('form-urlencoded')) {
      request.data = new URLSearchParams(content).toString();
    } else if (mediaType.includes('multipart')) {
      const form = new FormData();
      for (const [key, value] of Object.entries(content)) {
        form.append(key, value);
      }
      request.data = form;
      Object.assign(request.headers, form.getHeaders());
    } else {
      request.data = content;
    }
  } else if (testCase.operation.requestBody?.content) {
    // Try to use example from request body definition
    const [mediaType, content] = Object.entries(testCase.operation.requestBody.content)[0];
    if (content.example) {
      request.headers['Content-Type'] = mediaType;
      request.data = content.example;
    }
  }

  // Apply authentication
  if (config.auth) {
    applyAuthentication(request, config.auth, testCase.operation);
  }

  return request;
}

/**
 * Apply authentication to request
 */
function applyAuthentication(request, auth, operation) {
  // Check operation-specific security
  const security = operation.security || [];

  for (const scheme of security) {
    const schemeName = Object.keys(scheme)[0];
    const authConfig = auth[schemeName];

    if (authConfig) {
      switch (authConfig.type) {
        case 'apiKey':
          if (authConfig.in === 'header') {
            request.headers[authConfig.name] = authConfig.value;
          } else if (authConfig.in === 'query') {
            request.params[authConfig.name] = authConfig.value;
          }
          break;
        case 'http':
          if (authConfig.scheme === 'bearer') {
            request.headers['Authorization'] = `Bearer ${authConfig.token}`;
          } else if (authConfig.scheme === 'basic') {
            const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
            request.headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'oauth2':
          request.headers['Authorization'] = `Bearer ${authConfig.accessToken}`;
          break;
      }
    }
  }
}

/**
 * Validate response against operation definition
 */
function validateResponse(response, operation) {
  const validation = { valid: true, errors: [] };

  if (!operation.responses) {
    return validation;
  }

  // Find matching response definition
  let responseSpec = operation.responses[String(response.status)];

  if (!responseSpec) {
    // Check for range responses
    if (response.status >= 200 && response.status < 300) {
      responseSpec = operation.responses['2XX'];
    } else if (response.status >= 300 && response.status < 400) {
      responseSpec = operation.responses['3XX'];
    } else if (response.status >= 400 && response.status < 500) {
      responseSpec = operation.responses['4XX'];
    } else if (response.status >= 500 && response.status < 600) {
      responseSpec = operation.responses['5XX'];
    }
  }

  if (!responseSpec) {
    responseSpec = operation.responses.default;
  }

  if (responseSpec?.content) {
    // Validate content type
    const contentType = response.headers['content-type']?.split(';')[0];
    const expectedTypes = Object.keys(responseSpec.content);

    if (contentType && expectedTypes.length > 0) {
      const hasMatchingType = expectedTypes.some(type =>
        type === '*/*' ||
        type === contentType ||
        (type.includes('*') && contentType.startsWith(type.replace('*', '')))
      );

      if (!hasMatchingType) {
        validation.valid = false;
        validation.errors.push(`Unexpected content type: ${contentType}`);
      }
    }

    // TODO: Validate response schema if needed
  }

  return validation;
}

/**
 * Generate default value for a schema
 */
function generateDefaultValue(schema) {
  if (!schema) return 'test';

  switch (schema.type) {
    case 'string':
      return schema.enum ? schema.enum[0] : 'test';
    case 'number':
    case 'integer':
      return schema.minimum || 1;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return 'test';
  }
}

/**
 * Display test result in console
 */
function displayTestResult(result) {
  const icon = result.status === 'passed' ? '✓' :
               result.status === 'failed' ? '✗' : '-';
  const color = result.status === 'passed' ? chalk.green :
                result.status === 'failed' ? chalk.red : chalk.gray;

  console.log(color(`    ${icon} ${result.name} (${result.duration}ms)`));

  if (result.status === 'failed' && result.error) {
    console.log(chalk.red(`      Error: ${result.error}`));
  }
}

module.exports = {
  testEndpoints,
  collectTestCases,
  runTest,
  buildRequest,
  validateResponse
};