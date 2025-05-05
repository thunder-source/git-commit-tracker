import type { GitHubEvent, Commit, Contribution } from "../types";

export interface EODProcessorConfig {
  targetRepos: string[];
  targetUsers: string[];
  date: Date;
  debug?: boolean;
}

export class EODProcessor {
  private targetRepos: string[];
  private targetUsers: string[];
  private date: Date;
  private debug: boolean;

  constructor(config: EODProcessorConfig) {
    this.targetRepos = config.targetRepos;
    this.targetUsers = config.targetUsers;
    this.date = config.date;
    this.debug = config.debug ?? false;
  }

  private isDateInRange(eventDateStr: string): boolean {
    const eventDate = new Date(eventDateStr);
    const start = new Date(this.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.date);
    end.setHours(23, 59, 59, 999);
    return eventDate >= start && eventDate <= end;
  }

  process(events: GitHubEvent[]): Contribution[] {
    const contributions: Contribution[] = [];

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

    for (const event of filteredEvents) {
      const repoName = event.repo.name;

      if (!event.payload.commits) continue;

      const userCommits = event.payload.commits
        .filter((commit) => this.targetUsers.includes(commit.author.name))
        .map<Commit>((commit) => ({
          hash: commit.sha.substring(0, 7),
          message: commit.message,
          author: commit.author.name,
          timestamp: event.created_at,
        }));

      if (userCommits.length === 0) continue;

      let repoEntry = contributions.find((c) => c.repo === repoName);
      if (!repoEntry) {
        repoEntry = { repo: repoName, commits: [] };
        contributions.push(repoEntry);
      }

      repoEntry.commits.push(...userCommits);
    }

    return contributions;
  }
}
