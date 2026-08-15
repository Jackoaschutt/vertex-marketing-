/**
 * Post-generation truthfulness scan.
 *
 * The prompt already forbids fabricated claims. This is the second gate: if a
 * generated block still contains a pattern that asserts something we cannot
 * substantiate, the offending field is rejected rather than published.
 *
 * It is deliberately conservative — false positives cost an operator one edit;
 * a false negative puts an unsubstantiated claim on a live product page.
 */

export interface GuardrailIssue {
  field: string
  snippet: string
  rule: string
}

interface Rule {
  id: string
  pattern: RegExp
  reason: string
}

const RULES: Rule[] = [
  {
    id: 'fabricated-statistic',
    pattern: /\b\d{1,3}(\.\d+)?\s?%\s+(of|more|less|faster|better|fewer|improvement|increase|reduction)/i,
    reason: 'States a statistic we cannot substantiate.',
  },
  {
    id: 'study-reference',
    pattern: /\b(clinically|scientifically|lab)\s+(proven|tested|validated)\b|\bstudies? (show|prove|found)\b|\bresearch shows\b/i,
    reason: 'References a study or clinical validation.',
  },
  {
    id: 'medical-claim',
    pattern: /\b(cures?|treats?|heals?|prevents?|diagnoses?)\b|\b(fda|ce)[- ]?(approved|certified)\b|\bmedical(ly)? (grade|approved)\b/i,
    reason: 'Makes a medical or regulatory claim.',
  },
  {
    id: 'invented-social-proof',
    pattern: /\b\d[\d,.]*\s*(\+\s*)?(happy |satisfied |verified )?(customers?|reviews?|five[- ]star|5[- ]star)\b|\b\d(\.\d)?\s*(\/\s*5|stars?)\b/i,
    reason: 'Claims review counts or ratings that do not exist.',
  },
  {
    id: 'false-scarcity',
    pattern: /\b(only \d+ left|selling fast|almost gone|limited stock|hurry|act now|while stocks last|ends (today|tonight|soon))\b/i,
    reason: 'Manufactures urgency or scarcity.',
  },
  {
    id: 'unbacked-guarantee',
    pattern: /\b(lifetime|money[- ]back|satisfaction|100%)\s+guarantee(d)?\b|\brisk[- ]free\b/i,
    reason: 'Promises a guarantee that is not in the published policy.',
  },
  {
    id: 'award-claim',
    // `#` is not a word character, so `\b#1` never matches — anchor on the
    // preceding position instead.
    pattern: /\b(award[- ]winning|best[- ]selling|number one|voted best|as seen on)\b|(^|[^\w])#\s?1\b/i,
    reason: 'Claims an award, ranking or media placement.',
  },
]

function scanText(field: string, text: string): GuardrailIssue[] {
  const issues: GuardrailIssue[] = []
  for (const rule of RULES) {
    const match = rule.pattern.exec(text)
    if (match) {
      issues.push({
        field,
        snippet: text.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim(),
        rule: rule.reason,
      })
    }
  }
  return issues
}

/** Walks any nested structure and scans every string it finds. */
export function scanContent(value: unknown, path = 'content'): GuardrailIssue[] {
  if (typeof value === 'string') return scanText(path, value)
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => scanContent(v, `${path}[${i}]`))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => scanContent(v, `${path}.${k}`))
  }
  return []
}

export interface GuardrailResult<T> {
  clean: boolean
  issues: GuardrailIssue[]
  value: T
}

/**
 * Strips any string that trips a rule, replacing it with an empty string so the
 * operator sees the gap rather than an unsubstantiated claim.
 */
export function sanitize<T>(value: T): GuardrailResult<T> {
  const issues = scanContent(value)
  if (issues.length === 0) return { clean: true, issues, value }

  const strip = (v: unknown): unknown => {
    if (typeof v === 'string') return scanText('x', v).length > 0 ? '' : v
    if (Array.isArray(v)) return v.map(strip).filter((x) => x !== '')
    if (typeof v === 'object' && v !== null) {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, strip(val)]))
    }
    return v
  }

  return { clean: false, issues, value: strip(value) as T }
}
