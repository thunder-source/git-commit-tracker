#!/usr/bin/env node

/**
 * EOD GitHub Contribution Tracker
 *
 * Generates a summary of GitHub contributions made today or on a specified date
 * by specified users or to specified repositories.
 *
 * @version 1.1.0
 */

import "dotenv/config";
import axios, { type AxiosInstance, type AxiosError } from "axios";
import fs from "fs";
import path from "path";
/**
 * Represents a Git commit with essential information
 */
interface Commit {
  /** Short form of commit hash */
  hash: string;
  /** Commit message (first line) */
  message: string;
  /** Author name */
  author: string;
  /** ISO timestamp of commit */
  timestamp: string;
}

/**
 * GitHub API event structure for push events
 */
interface GitHubEvent {
  created_at: string;
  type: string;
  repo: {
    name: string;
  };
  payload: {
    commits?: Array<{
      sha: string;
      message: string;
      author: {
        name: string;
        email?: string;
      };
    }>;
  };
  actor?: {
    login: string;
  };
}

/**
 * Structure for repository information
 */
interface RepoInfo {
  full_name: string;
  private: boolean;
}

/**
 * Structure for grouped contributions by repository
 */
interface Contribution {
  /** Repository name in format "owner/repo" */
  repo: string;
  /** Array of commits made to this repository */
  commits: Commit[];
}

/**
 * Configuration options for the EODUpdate
 */
interface EODConfig {
  /** GitHub personal access token */
  token: string;
  /** List of repositories to track in format "owner/repo" */
  targetRepos: string[];
  /** List of GitHub usernames to track */
  targetUsers: string[];
  /** GitHub organization name */
  organization?: string;
  /** Date to use for filtering (defaults to today) */
  date?: Date;
  /** Enable debug mode */
  debug?: boolean;
  /** Check previous day if no contributions found today */
  checkPreviousDay?: boolean;
  /** Format to use for console output (simple or detailed) */
  outputFormat?: "simple" | "detailed";
  /** Skip writing to files */
  noFiles?: boolean;
  /** Custom output directory for reports */
  outputDir?: string;
}

/**
 * Validates that required environment variables are present
 * @returns Configuration object or throws an error
 */
function validateConfig(): EODConfig {
  const token = process.env.GITHUB_TOKEN;
  const organization = process.env.GITHUB_ORG;
  const targetRepos = process.env.TARGET_REPOS
    ? process.env.TARGET_REPOS.split(",").map((repo) => repo.trim())
    : [];
  const targetUsers = process.env.TARGET_USERS
    ? process.env.TARGET_USERS.split(",").map((user) => user.trim())
    : [];
  const debug = process.env.DEBUG === "true";
  const checkPreviousDay = process.env.CHECK_PREVIOUS_DAY === "true";
  const outputFormat = (
    process.env.OUTPUT_FORMAT === "detailed" ? "detailed" : "simple"
  ) as "simple" | "detailed";
  const noFiles = process.env.NO_FILES === "true";
  const outputDir = process.env.OUTPUT_DIR || "reports";

  // Use custom date if provided in format YYYY-MM-DD
  let date: Date | undefined = undefined;
  if (process.env.TARGET_DATE) {
    date = new Date(process.env.TARGET_DATE);
    if (isNaN(date.getTime())) {
      console.error(
        `Invalid TARGET_DATE format: ${process.env.TARGET_DATE}. Using today's date instead.`
      );
      date = new Date();
    }
  }

  if (!token) {
    throw new Error("Please set GITHUB_TOKEN environment variable");
  }

  if (targetRepos.length === 0 && targetUsers.length === 0 && !organization) {
    throw new Error(
      "Please specify at least one of: TARGET_REPOS, TARGET_USERS, or GITHUB_ORG environment variables"
    );
  }

  return {
    token,
    organization,
    targetRepos,
    targetUsers,
    debug,
    date,
    checkPreviousDay,
    outputFormat,
    noFiles,
    outputDir,
  };
}

/**
 * EOD Update generator that fetches and formats GitHub contributions
 */
class EODUpdate {
  private date: Date;
  private github: AxiosInstance;
  private config: EODConfig;
  private authenticatedUser: string = "";

  /**
   * Creates a new EODUpdate instance
   * @param config Configuration options
   */
  constructor(config: EODConfig) {
    this.config = config;
    this.date = config.date ?? new Date();
    // Set to beginning of day in local timezone
    this.date.setHours(0, 0, 0, 0);

    this.github = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `token ${config.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    // Add response interceptor for debugging
    if (config.debug) {
      this.github.interceptors.response.use(
        (response) => {
          console.debug(
            `[DEBUG] Request to ${response.config.url} succeeded with status ${response.status}`
          );
          return response;
        },
        (error: AxiosError) => {
          if (error.response) {
            console.debug(
              `[DEBUG] Request to ${error.config?.url} failed with status ${error.response.status}`
            );
            console.debug(`[DEBUG] Response data:`, error.response.data);
          }
          return Promise.reject(error);
        }
      );

      this.github.interceptors.request.use((config) => {
        console.debug(`[DEBUG] Making request to: ${config.url}`);
        return config;
      });
    }
  }

  /**
   * Gets the user's scopes from the GitHub API
   * @returns Promise resolving to array of scopes
   */
  private async getTokenScopes(): Promise<string[]> {
    try {
      const response = await this.github.get<any>("/");
      const scopeHeader = response.headers["x-oauth-scopes"] || "";
      return scopeHeader.split(", ").filter((scope: string) => scope !== "");
    } catch (error) {
      console.error("Error fetching token scopes:", error);
      return [];
    }
  }

  /**
   * Fetches valid repositories based on configured filters
   * @returns Promise resolving to an array of repository names
   */
  private async getValidRepos(): Promise<string[]> {
    try {
      const { organization, targetRepos } = this.config;
      let repos: RepoInfo[] = [];

      // If organization is specified, fetch repos from that org
      if (organization) {
        console.log(`Fetching repositories for organization: ${organization}`);
        try {
          const orgReposResponse = await this.github.get<Array<RepoInfo>>(
            `/orgs/${organization}/repos`,
            {
              params: { per_page: 100 },
            }
          );

          if (orgReposResponse.data && orgReposResponse.data.length > 0) {
            repos = repos.concat(orgReposResponse.data);
            console.log(
              `Found ${orgReposResponse.data.length} repositories in ${organization}`
            );
          } else {
            console.log(
              `No repositories found in organization ${organization}`
            );
          }
        } catch (error) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            console.error(
              `Organization "${organization}" not found or not accessible with your token.`
            );
          } else {
            console.error(
              `Error fetching repositories from organization ${organization}:`,
              error
            );
          }
        }
      }

      // Also fetch user's own repositories
      console.log("Fetching your own repositories...");
      try {
        const userReposResponse = await this.github.get<Array<RepoInfo>>(
          "/user/repos",
          {
            params: { per_page: 100 },
          }
        );

        if (userReposResponse.data && userReposResponse.data.length > 0) {
          repos = repos.concat(userReposResponse.data);
          console.log(
            `Found ${userReposResponse.data.length} repositories in your account`
          );
        } else {
          console.log("No repositories found in your account");
        }
      } catch (error) {
        console.error("Error fetching your repositories:", error);
      }

      if (repos.length === 0) {
        console.log("No repositories found in any source");

        // If targetRepos is specified but we couldn't find any repos, use the targetRepos directly
        if (targetRepos.length > 0) {
          console.log("Using explicitly defined target repositories:");
          targetRepos.forEach((repo) => console.log(`- ${repo}`));

          // Convert simple repo names to full names if needed
          const fullTargetRepos = targetRepos.map((repo) => {
            if (!repo.includes("/") && this.authenticatedUser) {
              return `${this.authenticatedUser}/${repo}`;
            }
            return repo;
          });

          return fullTargetRepos;
        }

        return [];
      }

      // Make the repos list unique based on full_name
      const uniqueRepos = Array.from(
        new Map(repos.map((repo) => [repo.full_name, repo])).values()
      );

      console.log(`Total unique repositories found: ${uniqueRepos.length}`);

      // Display all repositories found (first 10 for brevity)
      console.log("\nSample of available repositories:");
      uniqueRepos.slice(0, 10).forEach((repo) => {
        console.log(`- ${repo.full_name} (private: ${repo.private})`);
      });
      if (uniqueRepos.length > 10) {
        console.log(`... and ${uniqueRepos.length - 10} more`);
      }

      // Filter repositories based on targetRepos if specified
      let validRepoNames = uniqueRepos.map(
        (repo: RepoInfo): string => repo.full_name
      );

      if (targetRepos.length > 0) {
        validRepoNames = validRepoNames.filter((repoName: string): boolean => {
          return targetRepos.some((target: string) => {
            // Check if target matches exactly or as a simple name
            if (target.includes("/")) {
              return repoName === target;
            } else {
              // Try to match just the repo name part
              const repoNamePart = repoName.split("/")[1];
              return repoNamePart === target;
            }
          });
        });

        if (validRepoNames.length === 0) {
          console.warn(
            "None of the specified repositories were found in API results."
          );
          console.log("\nSpecified repositories:");
          targetRepos.forEach((repo) => console.log(`- ${repo}`));

          // Use the target repos directly as a fallback
          console.log("Using explicitly defined target repositories instead:");
          const fullTargetRepos = targetRepos.map((repo) => {
            if (!repo.includes("/") && this.authenticatedUser) {
              return `${this.authenticatedUser}/${repo}`;
            }
            return repo;
          });

          return fullTargetRepos;
        }
      }

      console.log(`\nTracking repositories: ${validRepoNames.join(", ")}`);
      return validRepoNames;
    } catch (error) {
      console.error("Error in getValidRepos:", error);
      return [];
    }
  }

  /**
   * Fetches contributions for the specified date
   * @param date Date to fetch contributions for
   * @returns Promise resolving to an array of contributions
   */
  private async getContributionsForDate(date: Date): Promise<Contribution[]> {
    try {
      // First, verify token permissions by checking user info
      try {
        const userInfo = await this.github.get<{ login: string }>("/user");
        this.authenticatedUser = userInfo.data.login;
        console.log(`Authenticated as: ${this.authenticatedUser}`);
      } catch (e) {
        console.error(
          "Failed to get authenticated user info. Check your token."
        );
      }

      // Check token scopes
      const scopes = await this.getTokenScopes();
      console.log(`Token scopes: ${scopes.join(", ") || "none"}`);

      // Warn about token permissions
      if (!scopes.includes("repo")) {
        if (scopes.includes("public_repo")) {
          console.warn(
            "Warning: Your token only has 'public_repo' scope. Private repositories will not be accessible."
          );
        } else {
          console.warn(
            "Warning: Your token may not have sufficient permissions to access repository data."
          );
          console.log(
            "For private repositories, your token needs the 'repo' scope."
          );
          console.log(
            "You can create a new token at: https://github.com/settings/tokens"
          );
        }
      }

      // Get repositories to track
      const validRepos = await this.getValidRepos();

      if (validRepos.length === 0 && this.config.targetUsers.length === 0) {
        console.log(
          "No valid repositories found to track and no target users specified."
        );
        console.log(
          "\nPlease check your TOKEN permissions and make sure the repositories you're trying to access exist."
        );
        return [];
      }

      // Then fetch events
      const dateStr = date.toISOString().split("T")[0];
      const { targetUsers } = this.config;

      console.log(`\nFetching events for ${dateStr}`);
      console.log(`Target Users: ${targetUsers.join(", ") || "none"}`);

      // Collection to store all relevant events
      const allEvents: GitHubEvent[] = [];

      // Approach 1: Try to get user's own events (received events often works better than user/events)
      if (this.authenticatedUser) {
        try {
          console.log("Fetching your received events...");
          const eventsResponse = await this.github.get<Array<GitHubEvent>>(
            `/users/${this.authenticatedUser}/received_events`,
            {
              params: {
                per_page: 100,
                page: 1,
              },
            }
          );

          console.log(`Found ${eventsResponse.data.length} received events`);
          allEvents.push(...eventsResponse.data);
        } catch (error) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            console.log(
              "Received events endpoint not accessible. Trying alternative approaches..."
            );
          } else {
            console.error(
              "Error fetching received events:",
              axiosError.message
            );
          }
        }

        // Also get your own events
        try {
          console.log("Fetching your own events...");
          const eventsResponse = await this.github.get<Array<GitHubEvent>>(
            `/users/${this.authenticatedUser}/events`,
            {
              params: {
                per_page: 100,
                page: 1,
              },
            }
          );

          console.log(`Found ${eventsResponse.data.length} of your events`);
          allEvents.push(...eventsResponse.data);
        } catch (error) {
          console.error("Error fetching your events:", error);
        }
      }

      // Approach 2: Try to get events for each repository
      for (const repo of validRepos) {
        try {
          console.log(`Fetching events for repository: ${repo}`);
          const repoEventsResponse = await this.github.get<Array<GitHubEvent>>(
            `/repos/${repo}/events`,
            {
              params: {
                per_page: 100,
                page: 1,
              },
            }
          );

          console.log(
            `Found ${repoEventsResponse.data.length} events for ${repo}`
          );
          allEvents.push(...repoEventsResponse.data);
        } catch (error) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            console.error(
              `Repository ${repo} not found or not accessible with your token.`
            );
          } else {
            console.error(
              `Error fetching events for ${repo}:`,
              axiosError.message
            );
          }
        }
      }

      // Approach 3: Try to get commits directly for each repository
      // This is more reliable for private repositories
      for (const repo of validRepos) {
        try {
          console.log(`Fetching commits for repository: ${repo}`);
          const [owner, repoName] = repo.split("/");

          const commitsResponse = await this.github.get<
            Array<{
              sha: string;
              commit: {
                message: string;
                author: {
                  name: string;
                  date: string;
                };
              };
              author?: {
                login: string;
              };
            }>
          >(`/repos/${owner}/${repoName}/commits`, {
            params: {
              since: new Date(date).toISOString(),
              until: new Date(
                date.getTime() + 24 * 60 * 60 * 1000
              ).toISOString(),
              per_page: 100,
              page: 1,
            },
          });

          console.log(
            `Found ${commitsResponse.data.length} commits for ${repo}`
          );

          // Convert commits to our event format
          if (commitsResponse.data.length > 0) {
            // Create a fake event to represent these commits
            const fakeEvent: GitHubEvent = {
              created_at: date.toISOString(),
              type: "PushEvent",
              repo: { name: repo },
              payload: {
                commits: commitsResponse.data.map((commit) => ({
                  sha: commit.sha,
                  message: commit.commit.message,
                  author: {
                    name: commit.commit.author.name,
                    email: commit.commit.author.name, // Use as placeholder
                  },
                })),
              },
              actor: commitsResponse.data[0].author
                ? { login: commitsResponse.data[0].author.login }
                : undefined,
            };

            allEvents.push(fakeEvent);
          }
        } catch (error) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 404) {
            console.error(
              `Repository ${repo} not found or not accessible with your token.`
            );
          } else {
            console.error(
              `Error fetching commits for ${repo}:`,
              axiosError.message
            );
          }
        }
      }

      // Approach 4: If targetUsers specified, try to get events for each user
      for (const user of targetUsers) {
        try {
          console.log(`Fetching events for user: ${user}`);
          // Try public events first
          const userEventsResponse = await this.github.get<Array<GitHubEvent>>(
            `/users/${user}/events/public`,
            {
              params: {
                per_page: 100,
                page: 1,
              },
            }
          );

          console.log(
            `Found ${userEventsResponse.data.length} public events for ${user}`
          );
          allEvents.push(...userEventsResponse.data);

          // Then try regular events (requires higher permissions)
          try {
            const userAllEventsResponse = await this.github.get<
              Array<GitHubEvent>
            >(`/users/${user}/events`, {
              params: {
                per_page: 100,
                page: 1,
              },
            });

            console.log(
              `Found ${userAllEventsResponse.data.length} total events for ${user}`
            );
            allEvents.push(...userAllEventsResponse.data);
          } catch (err) {
            // This might fail due to permissions, that's ok
          }
        } catch (error) {
          const axiosError = error as AxiosError;
          console.error(
            `Error fetching events for user ${user}:`,
            axiosError.message
          );
        }
      }

      if (allEvents.length === 0) {
        console.log("No events found from any source");
        return [];
      }

      console.log(
        `\nFound a total of ${allEvents.length} events from all sources`
      );

      // Deduplicate events based on unique identifiers
      const uniqueEvents = Array.from(
        new Map(
          allEvents.map((event) => [
            event.type +
              event.created_at +
              (event.payload.commits?.[0]?.sha || ""),
            event,
          ])
        ).values()
      );

      console.log(`After deduplication: ${uniqueEvents.length} unique events`);

      // Filter for events on the specified date and type PushEvent
      const dateStartTime = new Date(date);
      dateStartTime.setHours(0, 0, 0, 0);

      const dateEndTime = new Date(date);
      dateEndTime.setHours(23, 59, 59, 999);

      const filteredEvents = uniqueEvents.filter((event: GitHubEvent) => {
        const eventDate = new Date(event.created_at);
        const isInDateRange =
          eventDate >= dateStartTime && eventDate <= dateEndTime;

        // For debugging date issues
        if (this.config.debug && !isInDateRange) {
          console.debug(`[DEBUG] Event date out of range: ${event.created_at}`);
        }

        const isPushEvent = event.type === "PushEvent";

        if (!isPushEvent) {
          return false;
        }

        // Check if this event matches our filtering criteria
        const matchesRepos =
          validRepos.length === 0 || validRepos.includes(event.repo.name);

        // Check if any commit is by a target user (checking both name and login if available)
        const matchesUsers =
          targetUsers.length === 0
            ? true
            : (event.payload.commits &&
                event.payload.commits.some((commit) =>
                  targetUsers.includes(commit.author.name)
                )) ||
              (event.actor && targetUsers.includes(event.actor.login));

        if (!matchesUsers) return false;

        // If we have repos but no users, just check repos
        if (validRepos.length > 0 && targetUsers.length === 0) {
          return isInDateRange && matchesRepos;
        }

        // If we have users but no repos, just check users
        if (targetUsers.length > 0 && validRepos.length === 0) {
          return isInDateRange && matchesUsers;
        }

        // If we have both, either can match
        return isInDateRange && (matchesRepos || matchesUsers);
      });

      console.log(`Found ${filteredEvents.length} events for ${dateStr}`);

      // If we have no events after filtering, return empty
      if (filteredEvents.length === 0) {
        return [];
      }

      // Group events by repository
      return filteredEvents.reduce<Contribution[]>(
        (acc: Contribution[], event: GitHubEvent) => {
          // Find existing repo in accumulator or create new one
          let repoContribution = acc.find(
            (c: Contribution) => c.repo === event.repo.name
          );

          if (!repoContribution) {
            repoContribution = { repo: event.repo.name, commits: [] };
            acc.push(repoContribution);
          }

          // Add commits to the repo
          if (event.payload.commits) {
            const userCommits = event.payload.commits
              .filter((commit) => targetUsers.includes(commit.author.name))
              .map((commit) => ({
                hash: commit.sha.substring(0, 7),
                message: commit.message.split("\n")[0],
                author: commit.author.name,
                timestamp: event.created_at,
              }));

            if (userCommits.length > 0) {
              repoContribution.commits.push(...userCommits);
              console.log(
                `Added ${userCommits.length} commits from ${event.repo.name}`
              );
            }
          }
          return acc;
        },
        []
      );
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error(
          `API Error: ${axiosError.response.status} - ${JSON.stringify(
            axiosError.response.data
          )}`
        );
      } else if (axiosError.request) {
        console.error("No response received from GitHub API");
      } else {
        console.error(`Error setting up request: ${axiosError.message}`);
      }
      return [];
    }
  }

  /**
   * Generates a formatted report of contributions for today or the specified date
   * @returns Promise that resolves when the report is complete
   */
  public async generate(): Promise<void> {
    // Try the current date first
    let contributions = await this.getContributionsForDate(this.date);

    // If no contributions found and checkPreviousDay is enabled, try yesterday
    if (contributions.length === 0 && this.config.checkPreviousDay) {
      const yesterday = new Date(this.date);
      yesterday.setDate(yesterday.getDate() - 1);

      console.log(
        `\nNo contributions found for today. Checking previous day (${yesterday.toLocaleDateString()})...`
      );

      contributions = await this.getContributionsForDate(yesterday);

      if (contributions.length > 0) {
        this.date = yesterday;
      }
    }

    if (contributions.length === 0) {
      console.log("\nNo contributions found for the specified date");

      // Suggest adding more search parameters
      console.log("\nSuggestions:");
      console.log(
        "1. Check your token permissions - you need at least 'repo' scope for private repos"
      );
      console.log("2. Try setting DEBUG=true to see more details");
      console.log(
        "3. Make sure TARGET_REPOS and TARGET_USERS are correctly set"
      );
      console.log(
        "4. Try setting CHECK_PREVIOUS_DAY=true to also check yesterday's contributions"
      );
      console.log(
        "5. Set a specific TARGET_DATE in format YYYY-MM-DD if looking for past contributions"
      );

      return;
    }

    const dateStr = this.date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`\nContributions for ${dateStr}:\n`);

    const outputLines: string[] = [];

    for (const contribution of contributions) {
      console.log(`\n${contribution.repo}:`);
      outputLines.push(`\n${contribution.repo}:`);

      const sortedCommits = [...contribution.commits].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      const uniqueCommits = Array.from(
        new Map(sortedCommits.map((commit) => [commit.hash, commit])).values()
      );

      for (const commit of uniqueCommits) {
        if (this.config.outputFormat === "detailed") {
          const dt = new Date(commit.timestamp);
          const fullDate = dt.toLocaleString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });

          const line = `- ${commit.hash}\n  Author: ${commit.author}\n  Date: ${fullDate}\n  Message:\n  ${commit.message}\n`;
          console.log(line);
          outputLines.push(line);
        } else {
          const line = `- ${commit.hash}: ${commit.message.split("\n")[0]} (${
            commit.author
          })`;
          console.log(line);
          outputLines.push(line);
        }
      }
    }

    // ✅ Write to file if allowed
    if (!this.config.noFiles) {
      const dir = path.resolve(this.config.outputDir || "reports");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const dateStr = this.date.toISOString().split("T")[0];

      const filePath = path.join(dir, `contributions-${dateStr}.txt`);
      fs.writeFileSync(filePath, outputLines.join("\n"), "utf-8");
      console.log(`\n✅ Report written to ${filePath}`);
    }
  }
}

/**
 * Main function to run the EOD update
 */
async function main(): Promise<void> {
  try {
    const config = validateConfig();
    const eod = new EODUpdate(config);
    await eod.generate();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

// Export for testing or importing as a module
export { EODUpdate, validateConfig };
