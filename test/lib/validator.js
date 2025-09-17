/**
 * OpenAPI Specification Validator
 * Performs custom validation checks beyond standard OpenAPI validation
 */

const SwaggerParser = require('@apidevtools/swagger-parser');

/**
 * Validate OpenAPI specification
 * @param {Object} spec - OpenAPI specification object
 * @returns {Object} Validation results with errors and warnings
 */
async function validateSpec(spec) {
  const results = {
    errors: [],
    warnings: [],
    info: []
  };

  try {
    // Check for required fields
    if (!spec.openapi) {
      results.errors.push('Missing required field: openapi');
    } else if (!spec.openapi.startsWith('3.')) {
      results.warnings.push(`OpenAPI version ${spec.openapi} may have limited support`);
    }

    if (!spec.info) {
      results.errors.push('Missing required field: info');
    } else {
      if (!spec.info.title) results.errors.push('Missing required field: info.title');
      if (!spec.info.version) results.errors.push('Missing required field: info.version');
      if (!spec.info.description) results.warnings.push('Missing recommended field: info.description');
      if (!spec.info.contact) results.warnings.push('Missing recommended field: info.contact');
      if (!spec.info.license) results.warnings.push('Missing recommended field: info.license');
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      results.errors.push('No paths defined in specification');
    }

    if (!spec.servers || spec.servers.length === 0) {
      results.warnings.push('No servers defined - will use relative URLs');
    }

    // Validate paths
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        // Check path format
        if (!path.startsWith('/')) {
          results.errors.push(`Path "${path}" must start with /`);
        }

        // Check for operations
        const operations = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
        const hasOperation = operations.some(op => pathItem[op]);

        if (!hasOperation && !pathItem.$ref) {
          results.warnings.push(`Path "${path}" has no operations defined`);
        }

        // Validate each operation
        for (const operation of operations) {
          if (pathItem[operation]) {
            validateOperation(path, operation, pathItem[operation], results);
          }
        }
      }
    }

    // Validate components
    if (spec.components) {
      validateComponents(spec.components, results);
    }

    // Check for security definitions
    if (!spec.components?.securitySchemes && !spec.security) {
      results.info.push('No security schemes defined');
    }

    // Check for examples
    let exampleCount = 0;
    if (spec.paths) {
      for (const pathItem of Object.values(spec.paths)) {
        for (const operation of Object.values(pathItem)) {
          if (operation.requestBody?.content) {
            for (const content of Object.values(operation.requestBody.content)) {
              if (content.example || content.examples) exampleCount++;
            }
          }
          if (operation.responses) {
            for (const response of Object.values(operation.responses)) {
              if (response.content) {
                for (const content of Object.values(response.content)) {
                  if (content.example || content.examples) exampleCount++;
                }
              }
            }
          }
        }
      }
    }

    if (exampleCount === 0) {
      results.warnings.push('No examples found in specification');
    } else {
      results.info.push(`Found ${exampleCount} examples in specification`);
    }

  } catch (error) {
    results.errors.push(`Validation error: ${error.message}`);
  }

  return results;
}

/**
 * Validate an operation
 */
function validateOperation(path, method, operation, results) {
  const opId = `${method.toUpperCase()} ${path}`;

  // Check for required fields
  if (!operation.responses) {
    results.errors.push(`${opId}: Missing required field "responses"`);
  } else {
    // Check for at least one response
    if (Object.keys(operation.responses).length === 0) {
      results.errors.push(`${opId}: Must define at least one response`);
    }

    // Check for success response
    const hasSuccess = Object.keys(operation.responses).some(code =>
      code >= 200 && code < 300 || code === 'default'
    );
    if (!hasSuccess) {
      results.warnings.push(`${opId}: No success response (2xx) defined`);
    }
  }

  // Check for summary or description
  if (!operation.summary && !operation.description) {
    results.warnings.push(`${opId}: Missing summary and description`);
  }

  // Check for operationId
  if (!operation.operationId) {
    results.warnings.push(`${opId}: Missing operationId`);
  }

  // Validate parameters
  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (!param.$ref) {
        if (!param.name) {
          results.errors.push(`${opId}: Parameter missing required field "name"`);
        }
        if (!param.in) {
          results.errors.push(`${opId}: Parameter "${param.name}" missing required field "in"`);
        } else if (!['path', 'query', 'header', 'cookie'].includes(param.in)) {
          results.errors.push(`${opId}: Parameter "${param.name}" has invalid "in" value: ${param.in}`);
        }
        if (!param.schema && !param.content) {
          results.errors.push(`${opId}: Parameter "${param.name}" must have schema or content`);
        }

        // Check path parameters
        if (param.in === 'path') {
          if (!param.required) {
            results.errors.push(`${opId}: Path parameter "${param.name}" must be required`);
          }
          if (!path.includes(`{${param.name}}`)) {
            results.errors.push(`${opId}: Path parameter "${param.name}" not found in path`);
          }
        }
      }
    }
  }

  // Check for path parameters in URL
  const pathParams = (path.match(/{([^}]+)}/g) || []).map(p => p.slice(1, -1));
  for (const paramName of pathParams) {
    const hasParam = operation.parameters?.some(p =>
      p.name === paramName && p.in === 'path'
    );
    if (!hasParam) {
      results.errors.push(`${opId}: Missing path parameter definition for "{${paramName}}"`);
    }
  }

  // Validate request body
  if (operation.requestBody && !operation.requestBody.$ref) {
    if (!operation.requestBody.content) {
      results.errors.push(`${opId}: Request body missing required field "content"`);
    } else {
      for (const [mediaType, content] of Object.entries(operation.requestBody.content)) {
        if (!content.schema) {
          results.warnings.push(`${opId}: Request body for ${mediaType} missing schema`);
        }
      }
    }
  }

  // Check for deprecation
  if (operation.deprecated && !operation.description?.includes('deprecated')) {
    results.warnings.push(`${opId}: Marked as deprecated but no deprecation notice in description`);
  }
}

/**
 * Validate components section
 */
function validateComponents(components, results) {
  // Check schemas
  if (components.schemas) {
    for (const [name, schema] of Object.entries(components.schemas)) {
      if (!schema.$ref) {
        validateSchema(name, schema, results, 'components.schemas');
      }
    }
  }

  // Check for unused components
  const definedSchemas = new Set(Object.keys(components.schemas || {}));
  const definedResponses = new Set(Object.keys(components.responses || {}));
  const definedParameters = new Set(Object.keys(components.parameters || {}));
  const definedRequestBodies = new Set(Object.keys(components.requestBodies || {}));

  // This would require full spec traversal to find references
  // Simplified check for now
  if (definedSchemas.size > 0) {
    results.info.push(`Defined ${definedSchemas.size} component schemas`);
  }
}

/**
 * Validate a schema object
 */
function validateSchema(name, schema, results, path) {
  const schemaPath = `${path}.${name}`;

  // Check for type or $ref
  if (!schema.type && !schema.$ref && !schema.oneOf && !schema.anyOf && !schema.allOf) {
    results.warnings.push(`${schemaPath}: Schema should specify type, $ref, or composition`);
  }

  // Check array items
  if (schema.type === 'array' && !schema.items) {
    results.errors.push(`${schemaPath}: Array schema must have "items" property`);
  }

  // Check required properties exist
  if (schema.required && schema.properties) {
    for (const reqProp of schema.required) {
      if (!schema.properties[reqProp]) {
        results.errors.push(`${schemaPath}: Required property "${reqProp}" not defined in properties`);
      }
    }
  }

  // Check for empty enums
  if (schema.enum && schema.enum.length === 0) {
    results.errors.push(`${schemaPath}: Enum cannot be empty`);
  }

  // Recursively validate nested schemas
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (!propSchema.$ref) {
        validateSchema(propName, propSchema, results, `${schemaPath}.properties`);
      }
    }
  }

  if (schema.items && !schema.items.$ref) {
    validateSchema('items', schema.items, results, schemaPath);
  }
}

module.exports = {
  validateSpec,
  validateOperation,
  validateComponents,
  validateSchema
};