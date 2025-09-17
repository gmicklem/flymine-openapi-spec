#!/usr/bin/env node

/**
 * OpenAPI Test Runner
 * A reusable test suite for validating and testing OpenAPI specifications
 *
 * Usage: node openapi-test-runner.js <openapi-spec-file> [options]
 *
 * Options:
 *   --config <file>     Configuration file (default: test.config.json)
 *   --output <format>   Output format: json, html, markdown (default: markdown)
 *   --verbose           Verbose output
 *   --test-examples     Test endpoints using examples from spec
 *   --test-all          Test all endpoints with default values
 *   --timeout <ms>      Request timeout in milliseconds (default: 30000)
 *   --parallel <n>      Number of parallel requests (default: 5)
 *   --filter <pattern>  Only test paths matching pattern
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');
const chalk = require('chalk');
const { Command } = require('commander');
const SwaggerParser = require('@apidevtools/swagger-parser');
const { validateSpec } = require('./lib/validator');
const { testEndpoints } = require('./lib/endpoint-tester');
const { generateReport } = require('./lib/report-generator');
const { loadConfig } = require('./lib/config-loader');

// Parse command line arguments
const program = new Command();
program
  .name('openapi-test-runner')
  .description('Test OpenAPI specifications and their endpoints')
  .argument('<spec-file>', 'OpenAPI specification file (YAML or JSON)')
  .option('-c, --config <file>', 'Configuration file', 'test.config.json')
  .option('-o, --output <format>', 'Output format: json, html, markdown', 'markdown')
  .option('-v, --verbose', 'Verbose output', false)
  .option('-e, --test-examples', 'Test endpoints using examples from spec', false)
  .option('-a, --test-all', 'Test all endpoints with default values', false)
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
  .option('-p, --parallel <n>', 'Number of parallel requests', '5')
  .option('-f, --filter <pattern>', 'Only test paths matching pattern')
  .option('--skip-validation', 'Skip OpenAPI spec validation', false)
  .option('--skip-ssl', 'Skip SSL certificate verification', false)
  .option('--headers <json>', 'Additional headers as JSON')
  .parse();

const options = program.opts();
const specFile = program.args[0];

// Main test runner
async function runTests() {
  const startTime = Date.now();
  const results = {
    specFile: specFile,
    timestamp: new Date().toISOString(),
    validation: { valid: false, errors: [], warnings: [] },
    endpoints: [],
    summary: {
      totalEndpoints: 0,
      testedEndpoints: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      validationErrors: 0,
      validationWarnings: 0
    },
    duration: 0
  };

  try {
    console.log(chalk.blue.bold('\n🧪 OpenAPI Test Runner\n'));
    console.log(chalk.gray(`Testing: ${specFile}`));
    console.log(chalk.gray(`Started: ${results.timestamp}\n`));

    // Step 1: Load specification
    console.log(chalk.yellow('📖 Loading specification...'));
    const specContent = await fs.readFile(specFile, 'utf8');
    let spec;

    if (specFile.endsWith('.yaml') || specFile.endsWith('.yml')) {
      spec = yaml.load(specContent);
    } else {
      spec = JSON.parse(specContent);
    }

    if (options.verbose) {
      console.log(chalk.gray(`  Title: ${spec.info?.title || 'Unknown'}`));
      console.log(chalk.gray(`  Version: ${spec.info?.version || 'Unknown'}`));
      console.log(chalk.gray(`  Servers: ${spec.servers?.length || 0}`));
    }

    // Step 2: Load configuration
    let config = {};
    try {
      config = await loadConfig(options.config);
      if (options.verbose && Object.keys(config).length > 0) {
        console.log(chalk.gray(`  Config loaded: ${options.config}`));
      }
    } catch (err) {
      if (options.verbose) {
        console.log(chalk.gray(`  No config file found, using defaults`));
      }
    }

    // Merge CLI options with config
    const testConfig = {
      ...config,
      timeout: parseInt(options.timeout),
      parallel: parseInt(options.parallel),
      filter: options.filter,
      testExamples: options.testExamples,
      testAll: options.testAll,
      skipSSL: options.skipSsl,
      verbose: options.verbose,
      headers: options.headers ? JSON.parse(options.headers) : config.headers
    };

    // Step 3: Validate specification
    if (!options.skipValidation) {
      console.log(chalk.yellow('\n✅ Validating OpenAPI specification...'));

      try {
        // Use swagger-parser for validation
        const api = await SwaggerParser.validate(specFile);
        results.validation.valid = true;
        console.log(chalk.green('  ✓ Specification is valid'));

        if (options.verbose) {
          console.log(chalk.gray(`    API: ${api.info.title} v${api.info.version}`));
        }
      } catch (err) {
        results.validation.valid = false;
        results.validation.errors.push(err.message);
        console.log(chalk.red(`  ✗ Validation failed: ${err.message}`));
      }

      // Additional custom validation
      const customValidation = await validateSpec(spec);
      results.validation.errors.push(...customValidation.errors);
      results.validation.warnings.push(...customValidation.warnings);

      if (customValidation.warnings.length > 0 && options.verbose) {
        console.log(chalk.yellow('\n  ⚠ Warnings:'));
        customValidation.warnings.forEach(w => {
          console.log(chalk.yellow(`    - ${w}`));
        });
      }
    } else {
      console.log(chalk.yellow('\n⏩ Skipping validation'));
      results.validation.valid = true;
    }

    // Step 4: Test endpoints
    if (options.testExamples || options.testAll) {
      console.log(chalk.yellow('\n🔄 Testing endpoints...'));

      const endpointResults = await testEndpoints(spec, testConfig);
      results.endpoints = endpointResults.tests;

      // Update summary
      results.summary.totalEndpoints = endpointResults.summary.total;
      results.summary.testedEndpoints = endpointResults.summary.tested;
      results.summary.passedTests = endpointResults.summary.passed;
      results.summary.failedTests = endpointResults.summary.failed;
      results.summary.skippedTests = endpointResults.summary.skipped;

      // Display progress
      if (!options.verbose) {
        console.log(chalk.green(`  ✓ Tested: ${results.summary.testedEndpoints}/${results.summary.totalEndpoints}`));
        console.log(chalk.green(`  ✓ Passed: ${results.summary.passedTests}`));
        if (results.summary.failedTests > 0) {
          console.log(chalk.red(`  ✗ Failed: ${results.summary.failedTests}`));
        }
        if (results.summary.skippedTests > 0) {
          console.log(chalk.gray(`  - Skipped: ${results.summary.skippedTests}`));
        }
      }
    } else {
      console.log(chalk.yellow('\n⏩ Skipping endpoint tests (use --test-examples or --test-all)'));
    }

    // Step 5: Calculate summary
    results.summary.validationErrors = results.validation.errors.length;
    results.summary.validationWarnings = results.validation.warnings.length;
    results.duration = Date.now() - startTime;

    // Step 6: Generate report
    console.log(chalk.yellow('\n📊 Generating report...'));
    const report = await generateReport(results, options.output);

    // Save report to file
    const reportExt = options.output === 'json' ? 'json' :
                      options.output === 'html' ? 'html' : 'md';
    const reportFile = path.join(
      path.dirname(specFile),
      `test-report-${Date.now()}.${reportExt}`
    );

    await fs.writeFile(reportFile, report);
    console.log(chalk.green(`  ✓ Report saved: ${reportFile}`));

    // Step 7: Display summary
    console.log(chalk.blue.bold('\n📋 Test Summary\n'));
    console.log(chalk.white(`  Specification: ${results.validation.valid ?
      chalk.green('✓ Valid') : chalk.red('✗ Invalid')}`));
    console.log(chalk.white(`  Endpoints: ${results.summary.totalEndpoints} total`));

    if (results.summary.testedEndpoints > 0) {
      const passRate = ((results.summary.passedTests / results.summary.testedEndpoints) * 100).toFixed(1);
      console.log(chalk.white(`  Tests: ${results.summary.passedTests}/${results.summary.testedEndpoints} passed (${passRate}%)`));
    }

    console.log(chalk.white(`  Duration: ${(results.duration / 1000).toFixed(2)}s`));

    // Exit code based on results
    const exitCode = results.validation.valid &&
                     (results.summary.failedTests === 0 || !options.testExamples) ? 0 : 1;

    console.log(chalk.blue.bold('\n✨ Test run complete\n'));
    process.exit(exitCode);

  } catch (error) {
    console.error(chalk.red.bold('\n❌ Test runner failed:'));
    console.error(chalk.red(error.message));
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);