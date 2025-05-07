#!/usr/bin/env node

import 'dotenv/config';
import { GitHubService } from './services/GitHubService';
import { EODProcessor } from './services/EODProcessor';
import { Reporter } from './services/Reporter';
import type { GitHubEvent, AppConfig } from './types';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

function validateConfig(): AppConfig {
  const argv = yargs(hideBin(process.argv))
    .option('date', { type: 'string' })
    .option('outputFormat', { type: 'string', choices: ['simple', 'detailed'] })
    .option('noFiles', { type: 'boolean' })
    .option('output', {
      type: 'string',
      choices: ['txt', 'json', 'md'],
      default: 'txt',
    })
    .parseSync();

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const rawTargetUsers = process.env.TARGET_USERS || '';
  const rawTargetRepos = process.env.TARGET_REPOS || '';

  const targetUsers = rawTargetUsers
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  const rawRepos = rawTargetRepos
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const organization = process.env.GITHUB_ORG || undefined;
  const debug = process.env.DEBUG === 'true';
  const checkPreviousDay = process.env.CHECK_PREVIOUS_DAY === 'true';
  const outputFormat = (argv.outputFormat ||
    process.env.OUTPUT_FORMAT ||
    'simple') as 'simple' | 'detailed';
  const noFiles = argv.noFiles ?? process.env.NO_FILES === 'true';
  const outputDir = process.env.OUTPUT_DIR || 'reports';
  const maxBranches = process.env.MAX_BRANCHES
    ? parseInt(process.env.MAX_BRANCHES, 10)
    : 10;

  const allowedOutputs = ['txt', 'json', 'md'] as const;
  type OutputFormat = (typeof allowedOutputs)[number];

  const outputArg = argv.output ?? 'txt';
  const output: OutputFormat = allowedOutputs.includes(outputArg as any)
    ? (outputArg as OutputFormat)
    : 'txt';

  let date = new Date();
  if (argv.date) {
    const d = new Date(argv.date);
    if (!isNaN(d.getTime())) date = d;
    else console.warn('Invalid CLI --date. Using today.');
  } else if (process.env.TARGET_DATE) {
    const d = new Date(process.env.TARGET_DATE);
    if (!isNaN(d.getTime())) date = d;
  }

  return {
    token,
    targetUsers,
    targetRepos: rawRepos, // temporarily raw
    organization,
    date,
    debug,
    checkPreviousDay,
    outputFormat,
    noFiles,
    outputDir,
    output,
    maxBranches,
  };
}

async function fetchEvents(
  github: GitHubService,
  targetUsers: string[],
  targetRepos: string[],
  org?: string,
  date?: Date,
  maxBranches: number = 10
): Promise<GitHubEvent[]> {
  const events: GitHubEvent[] = [];
  const since = new Date(date ?? new Date());
  since.setHours(0, 0, 0, 0);
  const until = new Date(since);
  until.setDate(since.getDate() + 1);

  const sinceISO = since.toISOString();
  const untilISO = until.toISOString();

  const repos: Set<string> = new Set();

  const isValidFullRepo = (r: string) =>
    r.includes('/') && r.split('/').length === 2;

  if (org) {
    const orgRepos = await github.getOrgRepos(org);
    orgRepos.forEach((r) => repos.add(r));
  }

  const userRepos = await github.getUserRepos();
  userRepos.forEach((r) => repos.add(r));

  targetRepos.filter(Boolean).forEach((r) => {
    if (!isValidFullRepo(r)) {
      console.warn(`⚠️ Skipping invalid repo format: ${r}`);
    } else {
      repos.add(r);
    }
  });

  if (process.env.DEBUG === 'true') {
    console.debug('🔍 Repositories to fetch commits from:');
    console.debug([...repos].join('\n'));
  }

  for (const repo of repos) {
    try {
      const commits = await github.getCommitsForRepo(
        repo,
        sinceISO,
        untilISO,
        maxBranches
      );
      if (commits.length > 0) {
        if (process.env.DEBUG === 'true') {
          console.debug(
            `🔍 Found ${commits.length} commits across all branches for ${repo}`
          );
        }

        const event: GitHubEvent = {
          created_at: sinceISO,
          type: 'PushEvent',
          repo: { name: repo },
          payload: {
            commits: commits.map((c) => ({
              sha: c.sha,
              message: c.commit.message,
              author: {
                name: c.commit.author.name,
                email: c.commit.author.email,
              },
            })),
          },
          actor: commits[0].author
            ? { login: commits[0].author.login }
            : undefined,
        };
        events.push(event);
      }
    } catch (err) {
      if ((err as any).response?.status !== 404)
        console.warn(`⚠️ Failed to fetch commits for ${repo}`);
    }
  }

  for (const user of targetUsers) {
    try {
      const userEvents = await github.getUserPublicEvents(user);
      events.push(...userEvents);
    } catch (err) {
      console.warn(`⚠️ Failed to fetch events for user ${user}`);
    }
  }

  return events;
}

async function main(): Promise<void> {
  const config = validateConfig();

  // Auto-resolve short repo names to owner/repo
  if (config.targetRepos.some((r) => !r.includes('/'))) {
    const prefix = config.organization;
    if (!prefix) {
      throw new Error(
        'You used short repo names, but GITHUB_ORG is not set. Please set it in .env or use full repo names.'
      );
    }

    config.targetRepos = config.targetRepos.map((r) =>
      r.includes('/') ? r : `${prefix}/${r}`
    );
  }

  const github = new GitHubService({
    token: config.token,
    debug: config.debug,
  });
  const dateStr = config.date.toISOString().split('T')[0];

  const events = await fetchEvents(
    github,
    config.targetUsers,
    config.targetRepos,
    config.organization,
    config.date,
    config.maxBranches
  );

  const processor = new EODProcessor({
    targetRepos: config.targetRepos,
    targetUsers: config.targetUsers,
    date: config.date,
    debug: config.debug,
  });

  const contributions = processor.process(events);

  if (contributions.length === 0 && config.checkPreviousDay) {
    const prevDate = new Date(config.date);
    prevDate.setDate(prevDate.getDate() - 1);
    console.log(`\nNo contributions found. Checking previous day...`);
    const prevEvents = await fetchEvents(
      github,
      config.targetUsers,
      config.targetRepos,
      config.organization,
      prevDate,
      config.maxBranches
    );
    const altProcessor = new EODProcessor({
      targetRepos: config.targetRepos,
      targetUsers: config.targetUsers,
      date: prevDate,
      debug: config.debug,
    });
    const altContribs = altProcessor.process(prevEvents);
    if (altContribs.length > 0) {
      const altDateStr = prevDate.toISOString().split('T')[0];
      const reporter = new Reporter({
        outputFormat: config.outputFormat,
        outputDir: config.outputDir,
        noFiles: config.noFiles,
        debug: config.debug,
      });
      reporter.print(altContribs, altDateStr);
      reporter.writeToFile(altContribs, altDateStr);
      return;
    }
  }

  if (contributions.length === 0) {
    console.log(`\n❌ No contributions found for ${dateStr}`);
    return;
  }

  const reporter = new Reporter({
    outputFormat: config.outputFormat,
    outputDir: config.outputDir,
    noFiles: config.noFiles,
    debug: config.debug,
  });

  reporter.print(contributions, dateStr);
  reporter.writeToFile(contributions, dateStr);
  const summary = reporter.generateMinimalEODReport(contributions);
  reporter.writeMinimalEODReportFile(summary);
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
