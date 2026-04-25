// parseInputTool.js -- Tool schema for Claude tool use in /api/parse-input.
//
// Defines the single tool Claude is forced to call. The tool input
// IS the structured response we want -- Claude fills it according to
// the JSON schema below. Schema mirrors handoff v5.3 contract:
//   { parsed: {...OptimizeRequest}, confidence, reasoning, missing_fields }
//
// Field ranges mirror api/src/validation.js so Claude is primed to
// produce values the existing optimize endpoint will accept. If Claude
// produces out-of-range values, downstream /api/optimize call will
// 400 -- which is correct behavior (low confidence -> user reviews).

var TOOL_NAME = 'extract_design_params';

// JSON Schema describing the tool input. Claude tool use guarantees
// the model will produce JSON conforming to this structure. The
// `description` strings double as inline documentation for the model.
var TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    parsed: {
      type: 'object',
      description: 'Extracted retaining wall design parameters. All fields required even if defaulted.',
      properties: {
        H: {
          type: 'number',
          description: 'Total wall height in meters. Range 2 to 6.'
        },
        H1: {
          type: 'number',
          description: 'Soil depth above heel in meters. Range 0 to H. Default 0.5 if user does not specify.'
        },
        gamma_soil: {
          type: 'number',
          description: 'Unit weight of soil in t/m^3 (ton per cubic meter). Typical 1.6 to 2.0. Default 1.8 for normal soil.'
        },
        gamma_concrete: {
          type: 'number',
          description: 'Unit weight of reinforced concrete in t/m^3. Default 2.4 (Thai standard).'
        },
        phi: {
          type: 'number',
          description: 'Internal friction angle of soil in degrees. Range 20 to 40. Default 30 for normal soil.'
        },
        mu: {
          type: 'number',
          description: 'Coefficient of friction between footing and soil. Range 0.3 to 0.7. Default 0.5.'
        },
        qa: {
          type: 'number',
          description: 'Allowable bearing capacity in t/m^2. Range 10 to 50. Default 20.'
        },
        cover: {
          type: 'number',
          description: 'Concrete cover in meters. Default 0.075 (7.5 cm) per Thai DOH standard.'
        },
        material: {
          type: 'object',
          description: 'Material properties and unit prices.',
          properties: {
            fy: {
              type: 'number',
              description: 'Steel yield strength in ksc (kgf/cm^2). Common: 4000 (SD40), 3000 (SD30). Default 4000.'
            },
            fc: {
              type: 'number',
              description: 'Concrete compressive strength in ksc. Common: 240, 280, 320. Default 240.'
            },
            concretePrice: {
              type: 'number',
              description: 'Concrete price in THB per cubic meter. Default 2500 (Maha Sarakham reference).'
            },
            steelPrice: {
              type: 'number',
              description: 'Steel price in THB per kilogram. Default 28 (Maha Sarakham reference).'
            }
          },
          required: ['fy', 'fc', 'concretePrice', 'steelPrice']
        }
      },
      required: ['H', 'H1', 'gamma_soil', 'gamma_concrete', 'phi', 'mu', 'qa', 'cover', 'material']
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'high: user explicitly specified most params. medium: a few defaults inferred. low: only height given or many guesses required.'
    },
    reasoning: {
      type: 'string',
      description: 'One or two sentences in Thai explaining what was extracted vs defaulted. Shown to user for review.'
    },
    missing_fields: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of OptimizeRequest field paths the user did NOT specify (defaults applied). Empty array means user gave everything. Use dot notation for nested fields, e.g., "material.fc".'
    }
  },
  required: ['parsed', 'confidence', 'reasoning', 'missing_fields']
};

// The full tool object as Anthropic SDK expects it.
var TOOL_DEFINITION = {
  name: TOOL_NAME,
  description: 'Extract retaining wall design parameters from natural Thai language input. Apply Thai DOH defaults for any field the user does not specify, and report which fields were defaulted via missing_fields. Always populate every required field of parsed -- never omit.',
  input_schema: TOOL_INPUT_SCHEMA
};

// tool_choice value to FORCE Claude to call this specific tool.
// disable_parallel_tool_use:true ensures exactly one tool_use block
// in the response, simplifying response parsing.
var TOOL_CHOICE = {
  type: 'tool',
  name: TOOL_NAME,
  disable_parallel_tool_use: true
};

module.exports = {
  TOOL_NAME: TOOL_NAME,
  TOOL_DEFINITION: TOOL_DEFINITION,
  TOOL_CHOICE: TOOL_CHOICE,
  TOOL_INPUT_SCHEMA: TOOL_INPUT_SCHEMA
};
