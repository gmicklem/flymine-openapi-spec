# OpenAPI Test Runner

A reusable Node.js test suite for validating and testing OpenAPI specifications. This tool can validate any OpenAPI 3.x specification and test its endpoints using examples from the spec.

## Features

- ✅ **OpenAPI Validation** - Validates specification against OpenAPI 3.x standard
- 🧪 **Endpoint Testing** - Tests API endpoints using examples from the spec
- 📊 **Multiple Report Formats** - Generate reports in JSON, HTML, or Markdown
- ⚡ **Parallel Testing** - Run tests in parallel for faster execution
- 🔧 **Configurable** - Extensive configuration options via CLI or config file
- 🎯 **Filtering** - Test specific endpoints using pattern matching
- 🔐 **Authentication Support** - Supports API Key, Bearer, Basic, and OAuth2
- 📈 **Performance Metrics** - Track response times and generate statistics

## Installation

```bash
cd test
npm install
```

## Usage

### Basic Usage

```bash
# Validate an OpenAPI specification
node openapi-test-runner.js ../flymine-openapi.yaml

# Test endpoints using examples from spec
node openapi-test-runner.js ../flymine-openapi-with-examples.yaml --test-examples

# Generate HTML report
node openapi-test-runner.js ../flymine-openapi.yaml --test-examples --output html

# Verbose output
node openapi-test-runner.js ../flymine-openapi.yaml --test-examples --verbose
```

### Using NPM Scripts

```bash
# Test FlyMine API with examples
npm run test:flymine

# Generate HTML report
npm run test:flymine:html

# Validate specification only
npm run test:validate
```

### Command Line Options

```
Options:
  -c, --config <file>      Configuration file (default: test.config.json)
  -o, --output <format>    Output format: json, html, markdown (default: markdown)
  -v, --verbose            Verbose output
  -e, --test-examples      Test endpoints using examples from spec
  -a, --test-all           Test all endpoints with default values
  -t, --timeout <ms>       Request timeout in milliseconds (default: 30000)
  -p, --parallel <n>       Number of parallel requests (default: 5)
  -f, --filter <pattern>   Only test paths matching pattern
  --skip-validation        Skip OpenAPI spec validation
  --skip-ssl               Skip SSL certificate verification
  --headers <json>         Additional headers as JSON
  -h, --help               Display help
```

### Configuration File

Create a `test.config.json` file for persistent configuration:

```json
{
  "baseURL": "https://www.flymine.org/flymine/service",
  "timeout": 30000,
  "parallel": 5,
  "testExamples": true,
  "testAll": false,
  "skipSSL": false,
  "verbose": false,
  "filter": "^/query",
  "skip": ["operationIdToSkip"],
  "headers": {
    "User-Agent": "MyTestRunner/1.0",
    "Accept": "application/json"
  },
  "auth": {
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key",
      "value": "your-api-key"
    }
  }
}
```

## Testing FlyMine API

This test suite was specifically designed to test the FlyMine API OpenAPI specification:

### Quick Test

```bash
# Test with examples (verbose mode)
node openapi-test-runner.js ../flymine-openapi-with-examples.yaml \
  --test-examples \
  --verbose \
  --timeout 60000

# Generate comprehensive HTML report
node openapi-test-runner.js ../flymine-openapi-with-examples.yaml \
  --test-examples \
  --output html \
  --parallel 3
```

### Filter Specific Endpoints

```bash
# Test only query endpoints
node openapi-test-runner.js ../flymine-openapi.yaml \
  --test-examples \
  --filter "^/query"

# Test only template endpoints
node openapi-test-runner.js ../flymine-openapi.yaml \
  --test-examples \
  --filter "/template"
```

## Report Formats

### Markdown Report (Default)
- Human-readable format
- Good for documentation and GitHub
- Includes tables and formatted sections

### HTML Report
- Interactive web page
- Visual charts and progress bars
- Best for presentations

### JSON Report
- Machine-readable format
- Complete test data
- Good for CI/CD integration

## Examples

### Test Any OpenAPI Spec

```bash
# Test Petstore API
node openapi-test-runner.js https://petstore3.swagger.io/api/v3/openapi.json \
  --test-examples

# Test local API spec
node openapi-test-runner.js ./my-api.yaml \
  --test-all \
  --config ./my-config.json
```

### CI/CD Integration

```bash
# Exit with error code if tests fail
node openapi-test-runner.js api-spec.yaml --test-examples || exit 1

# Save JSON report for artifact
node openapi-test-runner.js api-spec.yaml \
  --test-examples \
  --output json > test-results.json
```

## Authentication Examples

### API Key Authentication

```json
{
  "auth": {
    "apiKey": {
      "type": "apiKey",
      "in": "header",
      "name": "X-API-Key",
      "value": "sk-1234567890"
    }
  }
}
```

### Bearer Token

```json
{
  "auth": {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "token": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### Basic Authentication

```json
{
  "auth": {
    "basicAuth": {
      "type": "http",
      "scheme": "basic",
      "username": "user@example.com",
      "password": "secretpassword"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Module not found errors**
   ```bash
   npm install
   ```

2. **SSL Certificate errors**
   ```bash
   node openapi-test-runner.js spec.yaml --skip-ssl
   ```

3. **Timeout errors**
   ```bash
   node openapi-test-runner.js spec.yaml --timeout 60000
   ```

4. **Too many parallel requests**
   ```bash
   node openapi-test-runner.js spec.yaml --parallel 1
   ```

## Exit Codes

- `0` - All tests passed and spec is valid
- `1` - Test failures or invalid specification

## Contributing

This test suite is designed to be reusable for any OpenAPI specification. Contributions are welcome!

## License

MIT