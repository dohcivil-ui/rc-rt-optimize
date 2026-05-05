<?php
// php-api/lib/ExplainResultTool.php -- Tool schema for Claude tool use in explain.php.
//
// Day 13.2: ports api/src/lib/explainResultTool.js. Defines the single
// tool Claude is forced to call via tool_choice. The tool's input IS
// the structured response we return to the frontend (4-field shape):
//   { summary, key_points, warnings, recommendations }
//
// All four fields are required by the schema so the frontend can
// render each section unconditionally. Empty arrays signal "no items"
// -- never omit. (See also explainMockExplanation() and the schema-
// defaults block in explain.php's handler for the runtime guarantee
// of all four fields, even if Claude omits warnings/recommendations.)

class ExplainResultTool
{
    const TOOL_NAME = 'format_design_explanation';

    /**
     * JSON Schema describing the tool input. Description strings double
     * as inline guidance for the model.
     */
    public static function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'summary' => [
                    'type' => 'string',
                    'description' => 'High-level Thai summary in 2-3 sentences for a project manager or contractor (boss-level reader). State what was designed, the optimized cost, and whether the design is viable. Plain Thai prose, no bullet characters, no markdown.',
                ],
                'key_points' => [
                    'type' => 'array',
                    'items' => ['type' => 'string'],
                    'description' => 'Engineer-level detail in Thai. Each item one full sentence. Recommended 3-6 items. Cover: dimensions (B, B1, B2, t1, t2, D), reinforcement layout (stem/toe/heel sizes and spacing), governing safety factor, material quantities. No bullet characters, no markdown.',
                ],
                'warnings' => [
                    'type' => 'array',
                    'items' => ['type' => 'string'],
                    'description' => 'Concerns, limits, or assumptions the engineer should review before construction. Each item one Thai sentence. Use empty array [] if there are no warnings -- never omit this field.',
                ],
                'recommendations' => [
                    'type' => 'array',
                    'items' => ['type' => 'string'],
                    'description' => 'Suggested next steps in Thai (e.g., site verification, alternative materials, sensitivity check on phi or qa). Each item one sentence. Use empty array [] if there are no recommendations -- never omit this field.',
                ],
            ],
            'required' => ['summary', 'key_points', 'warnings', 'recommendations'],
        ];
    }

    /**
     * Full tool object as Anthropic Messages API expects.
     */
    public static function toolDefinition(): array
    {
        return [
            'name'        => self::TOOL_NAME,
            'description' => 'Format the optimization result of a reinforced-concrete cantilever retaining wall into a structured Thai explanation with summary, key_points, warnings, and recommendations. Always populate all four fields. Use Thai DOH conventions and address an audience of Thai civil engineers and contractors.',
            'input_schema' => self::inputSchema(),
        ];
    }

    /**
     * Forces Claude to call this specific tool exactly once.
     * disable_parallel_tool_use:true ensures one tool_use block in the
     * response so ClaudeClient::extractToolUse can rely on a single match.
     */
    public static function toolChoice(): array
    {
        return [
            'type'                      => 'tool',
            'name'                      => self::TOOL_NAME,
            'disable_parallel_tool_use' => true,
        ];
    }
}
