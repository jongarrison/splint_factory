import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import type { DesignDefinition } from './types';

const ajv = new Ajv({ allErrors: true, strict: false });
const nestedValidators = new Map<string, ValidateFunction>();

function formatSchemaError(error: ErrorObject): string {
  const path = error.instancePath || 'inputParameters';
  if (error.keyword === 'additionalProperties') {
    return `${path} contains unexpected parameter ${String(error.params.additionalProperty)}`;
  }
  return `${path} ${error.message ?? 'is invalid'}`;
}

function validateFlatInput(design: DesignDefinition, inputData: Record<string, unknown>): void {
  const expectedNames = new Set(design.inputParameters.map((param) => param.InputName));
  const unexpectedNames = Object.keys(inputData).filter((name) => !expectedNames.has(name));
  if (unexpectedNames.length > 0) {
    throw new Error(`Unexpected parameter: ${unexpectedNames[0]}`);
  }

  for (const param of design.inputParameters) {
    if (!Object.hasOwn(inputData, param.InputName)) {
      throw new Error(`Missing required parameter: ${param.InputName}`);
    }

    const value = inputData[param.InputName];
    if (param.InputType === 'Boolean') {
      if (typeof value !== 'boolean') {
        throw new Error(`Parameter ${param.InputName} must be true or false`);
      }
    } else if (param.InputType === 'Float') {
      if (typeof value !== 'number') {
        throw new Error(`Parameter ${param.InputName} must be a number`);
      }
      if (param.NumberMin !== undefined && value < param.NumberMin) {
        throw new Error(`Parameter ${param.InputName} must be >= ${param.NumberMin}`);
      }
      if (param.NumberMax !== undefined && value > param.NumberMax) {
        throw new Error(`Parameter ${param.InputName} must be <= ${param.NumberMax}`);
      }
    } else if (param.InputType === 'Integer') {
      if (!Number.isInteger(value)) {
        throw new Error(`Parameter ${param.InputName} must be an integer`);
      }
      if (param.NumberMin !== undefined && (value as number) < param.NumberMin) {
        throw new Error(`Parameter ${param.InputName} must be >= ${param.NumberMin}`);
      }
      if (param.NumberMax !== undefined && (value as number) > param.NumberMax) {
        throw new Error(`Parameter ${param.InputName} must be <= ${param.NumberMax}`);
      }
    } else if (param.InputType === 'Text') {
      if (typeof value !== 'string') {
        throw new Error(`Parameter ${param.InputName} must be a string`);
      }
      if (value.length < param.TextMinLen) {
        throw new Error(`Parameter ${param.InputName} must be at least ${param.TextMinLen} characters`);
      }
      if (value.length > param.TextMaxLen) {
        throw new Error(`Parameter ${param.InputName} must be no more than ${param.TextMaxLen} characters`);
      }
    }
  }
}

export function validateDesignInput(design: DesignDefinition, inputData: unknown): void {
  if (inputData === null || typeof inputData !== 'object' || Array.isArray(inputData)) {
    throw new Error('inputParameters must be a JSON object');
  }

  if (!design.inputSchema) {
    validateFlatInput(design, inputData as Record<string, unknown>);
    return;
  }

  let validate = nestedValidators.get(design.id);
  if (!validate) {
    validate = ajv.compile(design.inputSchema);
    nestedValidators.set(design.id, validate);
  }

  if (!validate(inputData)) {
    throw new Error((validate.errors ?? []).map(formatSchemaError).join('; '));
  }
}