/**
 * Report Generator Module
 * Generates test reports in various formats
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Generate test report in specified format
 * @param {Object} results - Test results
 * @param {String} format - Output format (json, html, markdown)
 * @returns {String} Formatted report
 */
async function generateReport(results, format = 'markdown') {
  switch (format.toLowerCase()) {
    case 'json':
      return generateJSONReport(results);
    case 'html':
      return generateHTMLReport(results);
    case 'markdown':
    case 'md':
    default:
      return generateMarkdownReport(results);
  }
}

/**
 * Generate JSON report
 */
function generateJSONReport(results) {
  return JSON.stringify(results, null, 2);
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(results) {
  const lines = [];

  // Header
  lines.push('# OpenAPI Test Report');
  lines.push('');
  lines.push(`**Specification:** ${results.specFile}`);
  lines.push(`**Timestamp:** ${results.timestamp}`);
  lines.push(`**Duration:** ${(results.duration / 1000).toFixed(2)}s`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| **Specification Valid** | ${results.validation.valid ? '✅ Yes' : '❌ No'} |`);
  lines.push(`| **Total Endpoints** | ${results.summary.totalEndpoints} |`);
  lines.push(`| **Tested Endpoints** | ${results.summary.testedEndpoints} |`);
  lines.push(`| **Passed Tests** | ${results.summary.passedTests} |`);
  lines.push(`| **Failed Tests** | ${results.summary.failedTests} |`);
  lines.push(`| **Skipped Tests** | ${results.summary.skippedTests} |`);

  if (results.summary.testedEndpoints > 0) {
    const passRate = ((results.summary.passedTests / results.summary.testedEndpoints) * 100).toFixed(1);
    lines.push(`| **Pass Rate** | ${passRate}% |`);
  }

  lines.push('');

  // Validation Results
  if (results.validation.errors.length > 0 || results.validation.warnings.length > 0) {
    lines.push('## Validation Results');
    lines.push('');

    if (results.validation.errors.length > 0) {
      lines.push('### ❌ Errors');
      lines.push('');
      for (const error of results.validation.errors) {
        lines.push(`- ${error}`);
      }
      lines.push('');
    }

    if (results.validation.warnings.length > 0) {
      lines.push('### ⚠️ Warnings');
      lines.push('');
      for (const warning of results.validation.warnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }
  }

  // Endpoint Test Results
  if (results.endpoints.length > 0) {
    lines.push('## Endpoint Test Results');
    lines.push('');

    // Group by status
    const passed = results.endpoints.filter(e => e.status === 'passed');
    const failed = results.endpoints.filter(e => e.status === 'failed');
    const skipped = results.endpoints.filter(e => e.status === 'skipped');

    if (passed.length > 0) {
      lines.push('### ✅ Passed Tests');
      lines.push('');
      lines.push('| Endpoint | Method | Duration | Response |');
      lines.push('|----------|--------|----------|----------|');

      for (const test of passed) {
        const response = test.response.status ? `${test.response.status} ${test.response.statusText || ''}` : 'N/A';
        lines.push(`| ${test.path} | ${test.method} | ${test.duration}ms | ${response} |`);
      }
      lines.push('');
    }

    if (failed.length > 0) {
      lines.push('### ❌ Failed Tests');
      lines.push('');
      lines.push('| Endpoint | Method | Duration | Error |');
      lines.push('|----------|--------|----------|-------|');

      for (const test of failed) {
        const error = test.error || 'Unknown error';
        lines.push(`| ${test.path} | ${test.method} | ${test.duration}ms | ${error} |`);
      }
      lines.push('');

      // Detailed failure information
      lines.push('#### Failure Details');
      lines.push('');

      for (const test of failed) {
        lines.push(`**${test.method} ${test.path}**`);
        if (test.operationId) {
          lines.push(`- Operation ID: ${test.operationId}`);
        }
        if (test.error) {
          lines.push(`- Error: ${test.error}`);
        }
        if (test.response.status) {
          lines.push(`- Response Status: ${test.response.status}`);
        }
        if (test.response.data) {
          lines.push('- Response Data:');
          lines.push('```json');
          lines.push(JSON.stringify(test.response.data, null, 2).substring(0, 500));
          lines.push('```');
        }
        lines.push('');
      }
    }

    if (skipped.length > 0 && skipped.length <= 20) {
      lines.push('### ⏭️ Skipped Tests');
      lines.push('');
      lines.push('| Endpoint | Method | Reason |');
      lines.push('|----------|--------|--------|');

      for (const test of skipped) {
        lines.push(`| ${test.path} | ${test.method} | No examples |`);
      }
      lines.push('');
    }
  }

  // Coverage Analysis
  lines.push('## Coverage Analysis');
  lines.push('');

  const methodCoverage = calculateMethodCoverage(results);
  lines.push('### By HTTP Method');
  lines.push('');
  lines.push('| Method | Total | Tested | Coverage |');
  lines.push('|--------|-------|--------|----------|');

  for (const [method, stats] of Object.entries(methodCoverage)) {
    const coverage = stats.total > 0 ? ((stats.tested / stats.total) * 100).toFixed(1) : 0;
    lines.push(`| ${method} | ${stats.total} | ${stats.tested} | ${coverage}% |`);
  }

  lines.push('');

  // Performance Statistics
  if (results.endpoints.length > 0) {
    const durations = results.endpoints.map(e => e.duration).filter(d => d > 0);
    if (durations.length > 0) {
      lines.push('## Performance Statistics');
      lines.push('');
      lines.push('| Metric | Value |');
      lines.push('|--------|-------|');
      lines.push(`| **Min Response Time** | ${Math.min(...durations)}ms |`);
      lines.push(`| **Max Response Time** | ${Math.max(...durations)}ms |`);
      lines.push(`| **Avg Response Time** | ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0)}ms |`);
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push('*Generated by OpenAPI Test Runner*');

  return lines.join('\n');
}

/**
 * Generate HTML report
 */
function generateHTMLReport(results) {
  const passRate = results.summary.testedEndpoints > 0 ?
    ((results.summary.passedTests / results.summary.testedEndpoints) * 100).toFixed(1) : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenAPI Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .card h3 {
            margin-top: 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
        }
        .card .value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .card.success .value { color: #27ae60; }
        .card.error .value { color: #e74c3c; }
        .card.warning .value { color: #f39c12; }
        table {
            width: 100%;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        th {
            background: #34495e;
            color: white;
            padding: 12px;
            text-align: left;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .status-passed { color: #27ae60; font-weight: bold; }
        .status-failed { color: #e74c3c; font-weight: bold; }
        .status-skipped { color: #95a5a6; }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: #ecf0f1;
            border-radius: 15px;
            overflow: hidden;
            margin: 20px 0;
        }
        .progress-bar .fill {
            height: 100%;
            background: linear-gradient(90deg, #27ae60 0%, #2ecc71 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
        }
        .error-box {
            background: #fee;
            border-left: 4px solid #e74c3c;
            padding: 12px;
            margin: 10px 0;
        }
        .warning-box {
            background: #fffbf0;
            border-left: 4px solid #f39c12;
            padding: 12px;
            margin: 10px 0;
        }
        pre {
            background: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 OpenAPI Test Report</h1>
        <p><strong>Specification:</strong> ${results.specFile}</p>
        <p><strong>Timestamp:</strong> ${results.timestamp}</p>
        <p><strong>Duration:</strong> ${(results.duration / 1000).toFixed(2)}s</p>
    </div>

    <div class="summary">
        <div class="card ${results.validation.valid ? 'success' : 'error'}">
            <h3>Validation</h3>
            <div class="value">${results.validation.valid ? '✅ Valid' : '❌ Invalid'}</div>
        </div>
        <div class="card">
            <h3>Total Endpoints</h3>
            <div class="value">${results.summary.totalEndpoints}</div>
        </div>
        <div class="card success">
            <h3>Passed Tests</h3>
            <div class="value">${results.summary.passedTests}</div>
        </div>
        <div class="card error">
            <h3>Failed Tests</h3>
            <div class="value">${results.summary.failedTests}</div>
        </div>
        <div class="card warning">
            <h3>Skipped Tests</h3>
            <div class="value">${results.summary.skippedTests}</div>
        </div>
        <div class="card">
            <h3>Pass Rate</h3>
            <div class="value">${passRate}%</div>
        </div>
    </div>

    <div class="progress-bar">
        <div class="fill" style="width: ${passRate}%">${passRate}% Pass Rate</div>
    </div>

    ${results.validation.errors.length > 0 ? `
    <h2>❌ Validation Errors</h2>
    ${results.validation.errors.map(err => `<div class="error-box">${err}</div>`).join('')}
    ` : ''}

    ${results.validation.warnings.length > 0 ? `
    <h2>⚠️ Validation Warnings</h2>
    ${results.validation.warnings.map(warn => `<div class="warning-box">${warn}</div>`).join('')}
    ` : ''}

    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th>Endpoint</th>
                <th>Method</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Details</th>
            </tr>
        </thead>
        <tbody>
            ${results.endpoints.map(test => `
            <tr>
                <td>${test.path}</td>
                <td>${test.method}</td>
                <td class="status-${test.status}">${test.status.toUpperCase()}</td>
                <td>${test.duration}ms</td>
                <td>${test.error || test.response.status || '-'}</td>
            </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>Generated by OpenAPI Test Runner</p>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Calculate method coverage statistics
 */
function calculateMethodCoverage(results) {
  const coverage = {};

  for (const test of results.endpoints) {
    const method = test.method;
    if (!coverage[method]) {
      coverage[method] = { total: 0, tested: 0, passed: 0, failed: 0 };
    }
    coverage[method].total++;
    if (test.status !== 'skipped') {
      coverage[method].tested++;
    }
    if (test.status === 'passed') {
      coverage[method].passed++;
    } else if (test.status === 'failed') {
      coverage[method].failed++;
    }
  }

  return coverage;
}

module.exports = {
  generateReport,
  generateJSONReport,
  generateMarkdownReport,
  generateHTMLReport
};