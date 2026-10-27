export type BriefInput = {
  goal: string
  deadline: string
  format: string
  references: string
  notes: string
}

const CONTROL_CHARACTERS = /[#*_`\[\]<>]/g

function clean(value: string, maxLength: number) {
  return String(value || '').replace(CONTROL_CHARACTERS, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function serialiseBrief(input: BriefInput): string {
  const goal = clean(input.goal, 300)
  const deadline = clean(input.deadline, 10) || 'Not set'
  const format = clean(input.format, 300)
  const references = clean(input.references, 500) || 'None'
  const notes = clean(input.notes, 500) || 'None'

  return [
    '## Project brief',
    `**Goal:** ${goal}`,
    `**Deadline:** ${deadline}`,
    `**Format and deliverables:** ${format}`,
    `**References:** ${references}`,
    `**Notes for freelancer:** ${notes}`,
  ].join('\n')
}

export function parseBrief(markdown: string): BriefInput | null {
  const match = String(markdown || '').match(
    /^## Project brief\n\*\*Goal:\*\* (.*)\n\*\*Deadline:\*\* (.*)\n\*\*Format and deliverables:\*\* (.*)\n\*\*References:\*\* (.*)\n\*\*Notes for freelancer:\*\* (.*)(?:\n|$)/,
  )
  if (!match) return null

  return {
    goal: match[1],
    deadline: match[2] === 'Not set' ? '' : match[2],
    format: match[3],
    references: match[4] === 'None' ? '' : match[4],
    notes: match[5] === 'None' ? '' : match[5],
  }
}
