// explainResultTool.js -- Tool schema for Claude tool use in /api/explain-result.
//
// Defines the single tool Claude is forced to call. The tool input
// IS the structured response we return to the frontend. Schema mirrors
// handoff v5.5 D3.1 contract:
//   { summary, key_points, warnings, recommendations }
//
// All four fields are required so frontend can render each section
// unconditionally. Empty arrays signal "no items" -- never omit.

var TOOL_NAME = 'format_design_explanation';

// JSON Schema describing the tool input. Claude tool use guarantees
// the model produces JSON conforming to this structure. The
// `description` strings double as inline guidance for the model.
var TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'High-level Thai summary in 2-3 sentences for a project manager or contractor (boss-level reader). State what was designed, the optimized cost, and whether the design is viable. Plain Thai prose, no bullet characters, no markdown.'
    },
    key_points: {
      type: 'array',
      items: { type: 'string' },
      description: 'Engineer-level detail in Thai. Each item one full sentence. Recommended 3-6 items. Cover: dimensions (B, B1, B2, t1, t2, D), reinforcement layout (stem/toe/heel sizes and spacing), governing safety factor, material quantities. No bullet characters, no markdown.'
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concerns, limits, or assumptions the engineer should review before construction. Each item one Thai sentence. Use empty array [] if there are no warnings -- never omit this field.'
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Suggested next steps in Thai (e.g., site verification, alternative materials, sensitivity check on phi or qa). Each item one sentence. Use empty array [] if there are no recommendations -- never omit this field.'
    }
  },
  required: ['summary', 'key_points', 'warnings', 'recommendations']
};

// Full tool object as Anthropic SDK expects it.
var TOOL_DEFINITION = {
  name: TOOL_NAME,
  description: 'Format the optimization result of a reinforced-concrete cantilever retaining wall into a structured Thai explanation with summary, key_points, warnings, and recommendations. Always populate all four fields. Use Thai DOH conventions and address an audience of Thai civil engineers and contractors.',
  input_schema: TOOL_INPUT_SCHEMA
};

// Forces Claude to call this specific tool exactly once.
// disable_parallel_tool_use:true ensures one tool_use block in the
// response so extractToolInput can rely on a single match.
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
