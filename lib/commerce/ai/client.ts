/**
 * Anthropic client wrapper.
 *
 * One place that talks to the model. Everything else in the AI layer asks for
 * structured JSON through `generateJson` and gets back either a parsed object
 * or `null` — callers then use their deterministic fallback. The model is never
 * asked for facts about the business; grounding data is always supplied in the
 * prompt.
 */

import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config'

let client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!config.anthropicConfigured) return null
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

export interface GenerateOptions {
  system: string
  prompt: string
  schema: Record<string, unknown>
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

export interface GenerateResult<T> {
  data: T | null
  model: string | null
  error: string | null
}

/**
 * Extracts a JSON object from model output. Structured outputs make the whole
 * response valid JSON, but this stays defensive so a stray preamble on any
 * model version cannot break the pipeline.
 */
export function extractJson<T>(text: string): T | null {
  const trimmed = text.trim()
  const attempts = [trimmed]
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1))
  }
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object') return parsed as T
    } catch {
      // try the next candidate
    }
  }
  return null
}

export async function generateJson<T>(opts: GenerateOptions): Promise<GenerateResult<T>> {
  const anthropic = getClient()
  if (!anthropic) {
    return { data: null, model: null, error: 'ANTHROPIC_API_KEY is not set.' }
  }

  const model = config.aiModel
  try {
    // `output_config` and adaptive `thinking` are current Messages API
    // parameters; the installed SDK's types may lag them, hence the cast.
    const response = (await anthropic.messages.create({
      model,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: opts.effort ?? 'high',
        format: { type: 'json_schema', schema: opts.schema },
      },
      messages: [{ role: 'user', content: opts.prompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as unknown as {
      stop_reason?: string
      content: { type: string; text?: string }[]
    }

    if (response.stop_reason === 'refusal') {
      return { data: null, model, error: 'The model declined this request.' }
    }

    const text = response.content
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')

    const data = extractJson<T>(text)
    if (!data) {
      return { data: null, model, error: 'Model response could not be parsed as JSON.' }
    }
    return { data, model, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[commerce:ai] generation failed', message)
    return { data: null, model, error: message }
  }
}
