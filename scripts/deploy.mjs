/**
 * Publishes the built site. GitVerse Pages serves the branch of a public repository named like its
 * owner at https://<owner>.gitverse.site; the address and the repository live in src/app/site.json.
 *
 *   npm run deploy               build, then commit the build to that repository and push it
 *   npm run deploy -- --dry-run  build and prepare the files only: nothing leaves this computer
 *
 * DEPLOY_REPOSITORY=<address> publishes to another repository for one run.
 *
 * Only the build goes out, the source stays where it is. The push uses the git access of whoever
 * runs it, an SSH key or a token kept by the credential helper: nothing secret lives here.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
/** A clone of the site repository, kept between runs so a publication pushes only what changed. */
const WORKTREE = join(ROOT, '.deploy');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const dryRun = process.argv.includes('--dry-run');
const site = JSON.parse(await readFile(join(ROOT, 'src/app/site.json'), 'utf8'));
// Another address for this run only: an SSH one instead of the HTTPS one, or a test repository.
if (process.env.DEPLOY_REPOSITORY) site.repository = process.env.DEPLOY_REPOSITORY;
const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function run(command, args, cwd = ROOT) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) fail(`Команда не выполнилась: ${command} ${args.join(' ')}`);
}

function git(args, cwd = ROOT) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) fail(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

/**
 * What the host needs besides the build. The app reads its address itself, so any address of it
 * must answer with the page: the host answers an unknown one with 404.html, and every known one
 * gets a copy too, in case the host serves a folder where a file is missing.
 */
async function prepareSite() {
  const page = join(DIST, 'index.html');
  if (!existsSync(page) || !existsSync(join(DIST, 'sw.js'))) fail('В сборке нет index.html или sw.js.');

  await copyFile(page, join(DIST, '404.html'));
  for (const route of site.routes) {
    const folder = join(DIST, route);
    await mkdir(folder, { recursive: true });
    await copyFile(page, join(folder, 'index.html'));
  }
  // Without it the host runs the files through Jekyll first, which may skip or change some of them.
  await writeFile(join(DIST, '.nojekyll'), '');
}

async function publish(commit) {
  if (!existsSync(join(WORKTREE, '.git'))) {
    await rm(WORKTREE, { recursive: true, force: true });
    run('git', ['clone', '--quiet', site.repository, WORKTREE]);
  }

  git(['remote', 'set-url', 'origin', site.repository], WORKTREE);
  run('git', ['fetch', '--quiet', 'origin'], WORKTREE);
  if (git(['ls-remote', '--heads', 'origin', site.branch], WORKTREE) !== '') {
    git(['checkout', '--quiet', '--force', '-B', site.branch, `origin/${site.branch}`], WORKTREE);
  } else {
    // A new, empty repository: the branch is born with the first publication.
    git(['symbolic-ref', 'HEAD', `refs/heads/${site.branch}`], WORKTREE);
  }

  // The files of earlier versions stay in assets/: their names carry a hash, so nothing is
  // overwritten, and a page the host or a browser still keeps from before finds its scripts.
  for (const entry of await readdir(WORKTREE)) {
    if (entry === '.git' || entry === 'assets') continue;
    await rm(join(WORKTREE, entry), { recursive: true, force: true });
  }
  await cp(DIST, WORKTREE, { recursive: true });

  git(['add', '--all'], WORKTREE);
  if (git(['status', '--porcelain'], WORKTREE) === '') {
    console.warn(`\n✓ На сайте уже эта сборка, публиковать нечего: ${site.origin}`);
    return;
  }
  // The site repository is public: its commits carry the name of the site, not the personal name
  // and mail of whoever publishes, which the clone would not know anyway.
  const author = ['-c', 'user.name=Конверкот', '-c', `user.email=site@${new URL(site.origin).hostname}`];
  git([...author, 'commit', '--quiet', '-m', `Конверкот ${version} (${commit})`], WORKTREE);

  const push = spawnSync('git', ['push', '--quiet', 'origin', `HEAD:${site.branch}`], {
    cwd: WORKTREE,
    stdio: 'inherit',
  });
  if (push.status !== 0) {
    fail(
      `Не удалось отправить сборку в ${site.repository}. Проверьте доступ: SSH-ключ или токен в настройках GitVerse (docs/PILOT.md, раздел 3).`,
    );
  }
  console.warn(
    `\n✓ Опубликована версия ${version} (${commit}). Сайт обновится через несколько минут: ${site.origin}`,
  );
}

// The site is built from a commit, so the code of any published version can always be found.
if (!dryRun && git(['status', '--porcelain']) !== '') {
  fail('Есть незакоммиченные изменения. Сайт собирается только из коммита: сначала закоммитьте их.');
}
const commit = git(['rev-parse', '--short', 'HEAD']);

run(NPM, ['run', 'build']);
await prepareSite();

if (dryRun) {
  console.warn(`\n✓ Сборка ${version} (${commit}) готова в dist/. Публикация пропущена: --dry-run.`);
} else {
  await publish(commit);
}
