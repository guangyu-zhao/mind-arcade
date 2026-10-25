import { spawnSync } from 'node:child_process';

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('A command is required.');
const result = spawnSync(command, args, {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
  env: process.env,
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) console.error(result.error.message);
if (result.status !== 0 && process.env.GITHUB_ACTIONS === 'true') {
  const details = [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .join('\n')
    .slice(-16000);
  for (let offset = 0; offset < details.length; offset += 3000) {
    const part = details
      .slice(offset, offset + 3000)
      .replaceAll('%', '%25')
      .replaceAll('\r', '%0D')
      .replaceAll('\n', '%0A');
    console.log(`::error title=${command} ${args.join(' ')} (${1 + offset / 3000})::${part}`);
  }
}
process.exit(result.status ?? 1);
