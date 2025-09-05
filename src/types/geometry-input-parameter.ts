/**
 * TypeScript types for Geometry Input Parameter Schema
 * Based on the specification in agent-instructions/250903_print_queue_agent_instructions.md
 */

export type InputType = 'Float' | 'Integer' | 'Text';

export interface BaseGeometryInputParameter {
  /**
   * Name of the geometry parameter. Only lowercase letters and numbers allowed.
   * Pattern: ^[a-z0-9]+$
   * Max length: 50 characters
   */
  InputName: string;
  
  /**
   * Description of what this input parameter represents
   * Max length: 250 characters
   */
  InputDescription: string;
  
  /**
   * Data type for this parameter
   */
  InputType: InputType;
}

export interface TextGeometryInputParameter extends BaseGeometryInputParameter {
  InputType: 'Text';
  
  /**
   * Minimum length for Text type parameters
   * Range: 0-250
   */
  TextMinLen: number;
  
  /**
   * Maximum length for Text type parameters
   * Range: 1-250, must be >= TextMinLen
   */
  TextMaxLen: number;
}

export interface NumericGeometryInputParameter extends BaseGeometryInputParameter {
  InputType: 'Float' | 'Integer';
  
  /**
   * Minimum value for Integer or Float type parameters
   * Optional but at least one of NumberMin or NumberMax should be provided
   */
  NumberMin?: number;
  
  /**
   * Maximum value for Integer or Float type parameters
   * Optional but at least one of NumberMin or NumberMax should be provided
   * If both are provided, must be >= NumberMin
   */
  NumberMax?: number;
}

export type GeometryInputParameter = TextGeometryInputParameter | NumericGeometryInputParameter;

/**
 * Array of geometry input parameters for a named geometry design
 * Can have 0-50 parameters
 */
export type GeometryInputParameterSchema = GeometryInputParameter[];

/**
 * Validation helper functions
 */
export const GeometryInputParameterValidation = {
  /**
   * Validates that InputName follows the required pattern
   */
  isValidInputName: (name: string): boolean => {
    return /^[a-z0-9]+$/.test(name) && name.length >= 1 && name.length <= 50;
  },
  
  /**
   * Validates that description meets length requirements
   */
  isValidDescription: (description: string): boolean => {
    return description.length >= 1 && description.length <= 250;
  },
  
  /**
   * Validates a text parameter configuration
   */
  isValidTextParameter: (param: TextGeometryInputParameter): boolean => {
    return param.TextMinLen >= 0 && 
           param.TextMaxLen >= 1 && 
           param.TextMaxLen <= 250 && 
           param.TextMaxLen >= param.TextMinLen;
  },
  
  /**
   * Validates a numeric parameter configuration
   */
  isValidNumericParameter: (param: NumericGeometryInputParameter): boolean => {
    // At least one of min or max should be defined
    const hasMinOrMax = param.NumberMin !== undefined || param.NumberMax !== undefined;
    
    // If both are defined, max should be >= min
    const validRange = param.NumberMin === undefined || 
                      param.NumberMax === undefined || 
                      param.NumberMax >= param.NumberMin;
    
    return hasMinOrMax && validRange;
  }
};
