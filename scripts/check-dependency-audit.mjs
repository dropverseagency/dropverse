import { spawnSync } from 'node:child_process'

const audit = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
})

if (audit.error) {
  console.error('Dependency audit command failed:', audit.error.message)
  process.exit(1)
}

let report
try {
  report = JSON.parse(audit.stdout || '{}')
} catch {
  console.error('Dependency audit could not be parsed.')
  if (audit.stderr) console.error(audit.stderr)
  process.exit(1)
}

if (!report.metadata?.vulnerabilities) {
  console.error('Dependency audit returned no vulnerability metadata.')
  process.exit(1)
}

const counts = report.metadata.vulnerabilities
console.log(`Build dependency audit: ${JSON.stringify(counts)}`)

for (const [name, item] of Object.entries(report.vulnerabilities || {})) {
  const advisories = (item.via || []).map((entry) =>
    typeof entry === 'string' ? entry : `${entry.title || entry.name || 'advisory'} (${entry.url || 'no URL'})`
  )
  console.log(`DEPENDENCY_ADVISORY ${name}: severity=${item.severity}; range=${item.range}; fix=${JSON.stringify(item.fixAvailable)}; via=${advisories.join(' | ')}`)
}

if (Number(counts.critical || 0) > 0 || Number(counts.high || 0) > 0) {
  console.error('Build blocked: high/critical dependency advisories must be resolved.')
  process.exit(1)
}
