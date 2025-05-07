#!/usr/bin/env node

/**
 * EOD GitHub Contribution Tracker
 * 
 * Generates a summary of GitHub contributions made today or on a specified date
 * by specified users or to specified repositories.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadAppConfig } from './config/env';
import { GitHubService } from './services/GitHubService';
import { EODProcessor } from './services/EODProcessor';
import { Reporter } from './services/Reporter';
import { formatISODate, getStartOfDay, getEndOfDay, getPreviousDay } from './utils/date';
import type { GitHubEvent } from './types';

/**
 * Fetches GitHub events for the specified parameters
 */
async function fetchEvents(
  github: GitHubService,
  targetUsers: string[],
  targetRepos: string[],
  org?: string,
  date?: Date,
  maxBranches: number = 10
): Promise<GitHubEvent[]> {
  const events: GitHubEvent[] = [];
  const since = getStartOfDay(date ?? new Date());
  const until = getEndOfDay(since);

  const sinceISO = since.toISOString();
  const untilISO = until.toISOString();

  const repos: Set<string> = new Set();

  const isValidFullRepo = (r: string) =>
    r.includes('/') && r.split('/').length === 2;

  // Get repositories from organization
  if (org) {
    try {
      const orgRepos = await github.getOrgRepos(org);
      orgRepos.forEach((r) => repos.add(r));
    } catch (error) {
      console.warn(`⚠️ Failed to fetch repositories for organization ${org}`);
    }
  }

  // Get repositories accessible to the authenticated user
  try {
    const userRepos = await github.getUserRepos();
    userRepos.forEach((r) => repos.add(r));
  } catch (error) {
    console.warn('⚠️ Failed to fetch user repositories');
  }

  // Add explicitly specified repositories
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

  // Fetch commits for each repository
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

  // Fetch events for each user
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

/**
 * Main function
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .option('date', { type: 'string', description: 'Date to check (YYYY-MM-DD)' })
    .option('outputFormat', { 
      type: 'string', 
      choices: ['simple', 'detailed'],
      description: 'Output format (simple or detailed)'
    })
    .option('noFiles', { 
      type: 'boolean',
      description: 'Skip writing to files'
    })
    .option('output', {
      type: 'string',
      choices: ['txt', 'json', 'md'],
      default: 'txt',
      description: 'Output file format'
    })
    .parseSync();

  // Load configuration
  const config = loadAppConfig(argv);

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

  // Initialize services
  const github = new GitHubService({
    token: config.token,
    debug: config.debug,
  });
  
  const dateStr = formatISODate(config.date);

  // Fetch events
  const events = await fetchEvents(
    github,
    config.targetUsers,
    config.targetRepos,
    config.organization,
    config.date,
    config.maxBranches
  );

  // Process events into contributions
  const processor = new EODProcessor({
    targetRepos: config.targetRepos,
    targetUsers: config.targetUsers,
    date: config.date,
    debug: config.debug,
  });

  const contributions = processor.process(events);

  // Check previous day if no contributions found and checkPreviousDay is enabled
  if (contributions.length === 0 && config.checkPreviousDay) {
    const prevDate = getPreviousDay(config.date);
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
      const altDateStr = formatISODate(prevDate);
      const reporter = new Reporter({
        outputFormat: config.outputFormat,
        outputDir: config.outputDir,
        noFiles: config.noFiles,
        debug: config.debug,
      });
      
      reporter.print(altContribs, altDateStr);
      reporter.writeToFile(altContribs, altDateStr);
      
      const summary = reporter.generateMinimalEODReport(altContribs);
      reporter.writeMinimalEODReportFile(summary);
      
      return;
    }
  }

  // If no contributions found, print a message and exit
  if (contributions.length === 0) {
    console.log(`\n❌ No contributions found for ${dateStr}`);
    return;
  }

  // Generate and output reports
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

// Run the script
main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
