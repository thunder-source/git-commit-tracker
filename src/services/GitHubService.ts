/**
 * GitHub API Service
 * Handles all interactions with the GitHub API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Configuration for the GitHub service
 */
export interface GitHubServiceConfig {
  /** GitHub personal access token */
  token: string;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Service for interacting with the GitHub API
 */
export class GitHubService {
  private client: AxiosInstance;
  private debug: boolean;

  /**
   * Creates a new GitHubService instance
   * @param config Configuration options
   */
  constructor(config: GitHubServiceConfig) {
    this.debug = config.debug ?? false;

    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `token ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (this.debug) {
      this.client.interceptors.request.use((req) => {
        console.debug(`[DEBUG] → ${req.method?.toUpperCase()} ${req.url}`);
        return req;
      });

      this.client.interceptors.response.use(
        (res) => {
          console.debug(`[DEBUG] ← ${res.status} from ${res.config.url}`);
          return res;
        },
        (err: AxiosError) => {
          if (err.response) {
            console.debug(
              `[DEBUG] Error ${err.response.status} from ${err.config?.url}`
            );
          }
          return Promise.reject(err);
        }
      );
    }
  }

  /**
   * Gets the authenticated user's login name
   * @returns Promise resolving to the user's login name
   */
  async getAuthenticatedUser(): Promise<string> {
    const res = await this.client.get<{ login: string }>('/user');
    return res.data.login;
  }

  /**
   * Gets the scopes available to the current token
   * @returns Promise resolving to an array of scope names
   */
  async getTokenScopes(): Promise<string[]> {
    const res = await this.client.get('/');
    const scopes = res.headers['x-oauth-scopes'] ?? '';
    return scopes
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  /**
   * Gets all repositories in an organization
   * @param org Organization name
   * @returns Promise resolving to an array of repository full names
   */
  async getOrgRepos(org: string): Promise<string[]> {
    const res = await this.client.get(`/orgs/${org}/repos`, {
      params: { per_page: 100 },
    });
    return res.data.map((repo: any) => repo.full_name);
  }

  /**
   * Gets all repositories accessible to the authenticated user
   * @returns Promise resolving to an array of repository full names
   */
  async getUserRepos(): Promise<string[]> {
    const res = await this.client.get('/user/repos', {
      params: { per_page: 100 },
    });
    return res.data.map((repo: any) => repo.full_name);
  }

  /**
   * Gets events for a repository
   * @param repoFullName Repository full name (owner/repo)
   * @returns Promise resolving to an array of events
   */
  async getRepoEvents(repoFullName: string): Promise<any[]> {
    const res = await this.client.get(`/repos/${repoFullName}/events`, {
      params: { per_page: 100 },
    });
    return res.data;
  }

  /**
   * Gets events for a user
   * @param username GitHub username
   * @returns Promise resolving to an array of events
   */
  async getUserEvents(username: string): Promise<any[]> {
    const res = await this.client.get(`/users/${username}/events`, {
      params: { per_page: 100 },
    });
    return res.data;
  }

  /**
   * Gets public events for a user
   * @param username GitHub username
   * @returns Promise resolving to an array of events
   */
  async getUserPublicEvents(username: string): Promise<any[]> {
    const res = await this.client.get(`/users/${username}/events/public`, {
      params: { per_page: 100 },
    });
    return res.data;
  }

  /**
   * Gets all branches for a repository
   * @param repoFullName Repository full name (owner/repo)
   * @returns Promise resolving to an array of branch names
   */
  async getBranchesForRepo(repoFullName: string): Promise<string[]> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repo format: ${repoFullName}`);
    }

    const res = await this.client.get(`/repos/${owner}/${repo}/branches`, {
      params: {
        per_page: 100,
      },
    });

    return res.data.map((branch: any) => branch.name);
  }

  /**
   * Gets commits for a repository across multiple branches
   * @param repoFullName Repository full name (owner/repo)
   * @param since ISO date string for the start date
   * @param until ISO date string for the end date
   * @param maxBranches Maximum number of branches to check
   * @returns Promise resolving to an array of commits
   */
  async getCommitsForRepo(
    repoFullName: string,
    since: string,
    until: string,
    maxBranches: number = 10 // Default limit to prevent excessive API calls
  ): Promise<any[]> {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repo format: ${repoFullName}`);
    }

    // Get all branches for the repository
    let branches = await this.getBranchesForRepo(repoFullName);

    // Limit the number of branches to check if there are too many
    if (branches.length > maxBranches) {
      if (this.debug) {
        console.debug(
          `[DEBUG] Limiting from ${branches.length} to ${maxBranches} branches for ${repoFullName}`
        );
      }

      // Always include main/master branch if it exists
      const mainBranch = branches.find((b) => b === 'main' || b === 'master');
      const otherBranches = branches.filter(
        (b) => b !== 'main' && b !== 'master'
      );

      // Sort other branches to prioritize recently active ones (this is a heuristic)
      branches = mainBranch ? [mainBranch] : [];
      branches = branches.concat(
        otherBranches.slice(0, maxBranches - branches.length)
      );
    }

    if (this.debug) {
      console.debug(
        `[DEBUG] Checking ${
          branches.length
        } branches for ${repoFullName}: ${branches.join(', ')}`
      );
    }

    // Fetch commits from all branches and merge them
    const allCommits: any[] = [];
    const processedCommits = new Set<string>(); // To avoid duplicate commits

    for (const branch of branches) {
      try {
        const res = await this.client.get(`/repos/${owner}/${repo}/commits`, {
          params: {
            since,
            until,
            sha: branch,
            per_page: 100,
          },
        });

        // Add unique commits to the result
        for (const commit of res.data) {
          if (!processedCommits.has(commit.sha)) {
            processedCommits.add(commit.sha);
            allCommits.push(commit);
          }
        }
      } catch (error) {
        if (this.debug) {
          console.debug(
            `[DEBUG] Error fetching commits for branch ${branch} in ${repoFullName}`
          );
        }
        // Continue with other branches even if one fails
      }
    }

    return allCommits;
  }
}
