/**
 * EOD Processor Service
 * Processes GitHub events into contributions
 */

import type { GitHubEvent, Commit, Contribution } from "../types";

/**
 * Configuration for the EOD Processor
 */
export interface EODProcessorConfig {
  /** List of repositories to track */
  targetRepos: string[];
  /** List of users to track */
  targetUsers: string[];
  /** Date to filter events by */
  date: Date;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Service for processing GitHub events into contributions
 */
export class EODProcessor {
  private targetRepos: string[];
  private targetUsers: string[];
  private date: Date;
  private debug: boolean;

  /**
   * Creates a new EODProcessor instance
   * @param config Configuration options
   */
  constructor(config: EODProcessorConfig) {
    this.targetRepos = config.targetRepos;
    this.targetUsers = config.targetUsers;
    this.date = config.date;
    this.debug = config.debug ?? false;
  }

  /**
   * Checks if an event date is within the target date range
   * @param eventDateStr ISO date string from the event
   * @returns True if the event is within the target date range
   */
  private isDateInRange(eventDateStr: string): boolean {
    const eventDate = new Date(eventDateStr);
    const start = new Date(this.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.date);
    end.setHours(23, 59, 59, 999);
    return eventDate >= start && eventDate <= end;
  }

  /**
   * Processes GitHub events into contributions
   * @param events Array of GitHub events
   * @returns Array of contributions grouped by repository
   */
  public process(events: GitHubEvent[]): Contribution[] {
    const contributions: Contribution[] = [];

    // Filter events by type, date, and target repos/users
    const filteredEvents = events.filter((event) => {
      if (event.type !== "PushEvent") return false;
      if (!this.isDateInRange(event.created_at)) return false;

      const repoMatch =
        this.targetRepos.length === 0 ||
        this.targetRepos.includes(event.repo.name);

      const userMatch =
        this.targetUsers.length === 0 ||
        (event.payload.commits &&
          event.payload.commits.some((c) =>
            this.targetUsers.includes(c.author.name)
          )) ||
        (event.actor && this.targetUsers.includes(event.actor.login));

      return repoMatch && userMatch;
    });

    if (this.debug) {
      console.debug(`[DEBUG] Filtered ${filteredEvents.length} events`);
    }

    // Process filtered events into contributions
    for (const event of filteredEvents) {
      const repoName = event.repo.name;

      if (!event.payload.commits) continue;

      // Filter commits by target users and convert to our Commit format
      const userCommits = event.payload.commits
        .filter((commit) => 
          this.targetUsers.length === 0 || 
          this.targetUsers.includes(commit.author.name)
        )
        .map<Commit>((commit) => ({
          hash: commit.sha.substring(0, 7),
          message: commit.message,
          author: commit.author.name,
          timestamp: event.created_at,
        }));

      if (userCommits.length === 0) continue;

      // Find or create a repository entry in the contributions array
      let repoEntry = contributions.find((c) => c.repo === repoName);
      if (!repoEntry) {
        repoEntry = { repo: repoName, commits: [] };
        contributions.push(repoEntry);
      }

      // Add the commits to the repository entry
      repoEntry.commits.push(...userCommits);
    }

    // Sort contributions by repository name
    contributions.sort((a, b) => a.repo.localeCompare(b.repo));

    return contributions;
  }
}
