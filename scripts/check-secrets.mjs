import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const textExtensions = new Set([
  '', '.env', '.example', '.gitignore', '.js', '.json', '.jsx', '.md', '.mjs',
  '.sql', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);
const patterns = [
  ['Supabase personal access token', /\bsbp_[A-Za-z0-9_-]{20,}\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['JWT-like credential', /\beyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ['Postgres URL containing a password', /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i],
  [
    'privileged Supabase environment value',
    /\b(?:SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(?!\s*(?:$|<|your[-_]))\S+/i,
  ],
];

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
).split('\0').filter(Boolean);

const findings = [];
for (const file of files) {
  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  if (statSync(file).size > 2_000_000) continue;

  const content = readFileSync(file, 'utf8');
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  console.error('Potential committed credentials detected:');
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} repository files inspected).`);
