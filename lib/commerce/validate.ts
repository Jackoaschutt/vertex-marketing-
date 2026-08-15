/**
 * Minimal hand-rolled validation.
 *
 * A schema library would be a reasonable choice, but the surface here is small
 * and rule 19 of the brief says not to add dependencies without real value.
 * Every route handler runs its body through these before touching storage.
 */

export class ValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join('; '))
    this.name = 'ValidationError'
  }
}

export class Validator {
  private issues: string[] = []

  constructor(private readonly body: unknown) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      this.issues.push('Request body must be a JSON object.')
    }
  }

  private raw(field: string): unknown {
    if (typeof this.body !== 'object' || this.body === null) return undefined
    return (this.body as Record<string, unknown>)[field]
  }

  string(field: string, opts: { min?: number; max?: number; required?: boolean } = {}): string {
    const v = this.raw(field)
    if (v === undefined || v === null || v === '') {
      if (opts.required) this.issues.push(`${field} is required.`)
      return ''
    }
    if (typeof v !== 'string') {
      this.issues.push(`${field} must be a string.`)
      return ''
    }
    const trimmed = v.trim()
    if (opts.min !== undefined && trimmed.length < opts.min) {
      this.issues.push(`${field} must be at least ${opts.min} characters.`)
    }
    if (opts.max !== undefined && trimmed.length > opts.max) {
      this.issues.push(`${field} must be at most ${opts.max} characters.`)
    }
    return trimmed
  }

  email(field: string, required = true): string {
    const v = this.string(field, { required, max: 320 })
    if (!v) return ''
    // Deliberately permissive: reject obviously malformed input, do not try to
    // out-clever RFC 5322.
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(v)) {
      this.issues.push(`${field} must be a valid email address.`)
      return ''
    }
    return v.toLowerCase()
  }

  int(field: string, opts: { min?: number; max?: number; required?: boolean; default?: number } = {}): number {
    const v = this.raw(field)
    if (v === undefined || v === null || v === '') {
      if (opts.required) this.issues.push(`${field} is required.`)
      return opts.default ?? 0
    }
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) {
      this.issues.push(`${field} must be a number.`)
      return opts.default ?? 0
    }
    const rounded = Math.round(n)
    if (opts.min !== undefined && rounded < opts.min) {
      this.issues.push(`${field} must be at least ${opts.min}.`)
    }
    if (opts.max !== undefined && rounded > opts.max) {
      this.issues.push(`${field} must be at most ${opts.max}.`)
    }
    return rounded
  }

  bool(field: string, fallback = false): boolean {
    const v = this.raw(field)
    if (v === undefined || v === null) return fallback
    if (typeof v === 'boolean') return v
    if (v === 'true') return true
    if (v === 'false') return false
    this.issues.push(`${field} must be a boolean.`)
    return fallback
  }

  oneOf<T extends string>(field: string, allowed: readonly T[], opts: { required?: boolean; default?: T } = {}): T {
    const v = this.raw(field)
    if (v === undefined || v === null || v === '') {
      if (opts.required) this.issues.push(`${field} is required.`)
      return (opts.default ?? allowed[0]) as T
    }
    if (typeof v !== 'string' || !allowed.includes(v as T)) {
      this.issues.push(`${field} must be one of: ${allowed.join(', ')}.`)
      return (opts.default ?? allowed[0]) as T
    }
    return v as T
  }

  /** Cart lines: [{variantId, qty}]. Rejects anything else outright. */
  cartLines(field: string, maxLines = 20, maxQty = 20): { variantId: string; qty: number }[] {
    const v = this.raw(field)
    if (!Array.isArray(v)) {
      this.issues.push(`${field} must be an array.`)
      return []
    }
    if (v.length > maxLines) {
      this.issues.push(`${field} may contain at most ${maxLines} lines.`)
      return []
    }
    const out: { variantId: string; qty: number }[] = []
    for (const [i, line] of v.entries()) {
      if (typeof line !== 'object' || line === null) {
        this.issues.push(`${field}[${i}] must be an object.`)
        continue
      }
      const l = line as Record<string, unknown>
      const variantId = typeof l.variantId === 'string' ? l.variantId.trim() : ''
      const qty = Math.round(Number(l.qty))
      if (!variantId) {
        this.issues.push(`${field}[${i}].variantId is required.`)
        continue
      }
      if (!Number.isFinite(qty) || qty < 1 || qty > maxQty) {
        this.issues.push(`${field}[${i}].qty must be between 1 and ${maxQty}.`)
        continue
      }
      out.push({ variantId, qty })
    }
    return out
  }

  object(field: string): Record<string, unknown> {
    const v = this.raw(field)
    if (v === undefined || v === null) return {}
    if (typeof v !== 'object' || Array.isArray(v)) {
      this.issues.push(`${field} must be an object.`)
      return {}
    }
    return v as Record<string, unknown>
  }

  stringArray(field: string, maxItems = 50): string[] {
    const v = this.raw(field)
    if (v === undefined || v === null) return []
    if (!Array.isArray(v)) {
      this.issues.push(`${field} must be an array.`)
      return []
    }
    return v.slice(0, maxItems).map((x) => String(x))
  }

  fail(message: string): void {
    this.issues.push(message)
  }

  done(): void {
    if (this.issues.length > 0) throw new ValidationError(this.issues)
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Escapes text before it is placed into generated HTML (emails, JSON-LD). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
