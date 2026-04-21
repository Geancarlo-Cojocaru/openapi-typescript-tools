/**
 * OpenAPI document construction utilities.
 * Converts collected endpoint metadata and component schemas into a full OpenAPI 3.0 document.
 */

/**
 * Expand a JSON Schema object type into OpenAPI query parameters.
 * Each property becomes a query parameter with required-ness derived from the schema's required array.
 * @param {Record<string, any>} schema
 * @returns {Array<{name:string, in:'query', required:boolean, schema:Record<string, any>}>}
 */
const schemaToQueryParameters = (schema) => {
  if (!schema || schema.type !== 'object' || !schema.properties) return [];
  const required = new Set(schema.required || []);
  return Object.entries(schema.properties).map(([name, prop]) => {
    // Basic mapping from JSON Schema to OAS param schema
    return {
      name,
      in: 'query',
      required: required.has(name),
      schema: prop,
    };
  });
};

/**
 * Construct the full OpenAPI document from collected endpoints and generated component schemas.
 * @param {Array<{route:string, method:string, ok?:{schemaAlias:string, status:number, mediaType:string}|null, errors:Array<{schemaAlias:string, status:number, mediaType:string}>, querySchemaAlias:string|null, body?:{schemaAlias:string, mediaType:string}|null, pathParams:string[]}>} endpoints
 * @param {Record<string, any>} components - components.schemas mapping
 * @returns {Record<string, any>} OpenAPI 3.0 document
 */
export const buildOpenApi = (endpoints, components) => {
  const paths = {};
  for (const ep of endpoints) {
    const methodObj = {};

    const parameters = [];
    // Path params inferred
    for (const p of ep.pathParams) {
      parameters.push({ name: p, in: 'path', required: true, schema: { type: 'string' } });
    }
    // Query params expanded from schema
    if (ep.querySchemaAlias && components[ep.querySchemaAlias]) {
      parameters.push(...schemaToQueryParameters(components[ep.querySchemaAlias]));
    }

    if (parameters.length) methodObj.parameters = parameters;

    const responses = {};

    // OK response
    if (ep.ok) {
      const statusKey = String(ep.ok.status);
      responses[statusKey] = responses[statusKey] || { description: 'OK', content: {} };
      responses[statusKey].content[ep.ok.mediaType] = { schema: { $ref: `#/components/schemas/${ep.ok.schemaAlias}` } };
    }

    // Error responses (possibly multiple)
    if (Array.isArray(ep.errors)) {
      for (const er of ep.errors) {
        const statusKey = String(er.status);
        responses[statusKey] = responses[statusKey] || { description: 'Error', content: {} };
        responses[statusKey].content[er.mediaType] = { schema: { $ref: `#/components/schemas/${er.schemaAlias}` } };
      }
    }

    // Request body (optional)
    if (ep.body) {
      methodObj.requestBody = {
        content: {
          [ep.body.mediaType]: {
            schema: { $ref: `#/components/schemas/${ep.body.schemaAlias}` },
          },
        },
      };
    }

    methodObj.responses = Object.keys(responses).length ? responses : { '204': { description: 'No Content' } };

    if (!paths[ep.route]) paths[ep.route] = {};
    paths[ep.route][ep.method] = methodObj;
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Custom API from TS Definitions', version: '1.0.0' },
    paths,
    components: { schemas: components },
  };
};
