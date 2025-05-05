import axios, { AxiosInstance, AxiosError } from "axios";

export interface GitHubServiceConfig {
  token: string;
  debug?: boolean;
}

export class GitHubService {
  private client: AxiosInstance;
  private debug: boolean;

  constructor(config: GitHubServiceConfig) {
    this.debug = config.debug ?? false;

    this.client = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `token ${config.token}`,
        Accept: "application/vnd.github.v3+json",
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

  async getAuthenticatedUser(): Promise<string> {
    const res = await this.client.get<{ login: string }>("/user");
    return res.data.login;
  }

  async getTokenScopes(): Promise<string[]> {
    const res = await this.client.get("/");
    const scopes = res.headers["x-oauth-scopes"] ?? "";
    return scopes
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  async getOrgRepos(org: string): Promise<string[]> {
    const res = await this.client.get("/orgs/" + org + "/repos", {
      params: { per_page: 100 },
    });
    return res.data.map((repo: any) => repo.full_name);
  }

  async getUserRepos(): Promise<string[]> {
    const res = await this.client.get("/user/repos", {
      params: { per_page: 100 },
    });
    return res.data.map((repo: any) => repo.full_name);
  }

  async getRepoEvents(repoFullName: string): Promise<any[]> {
    const res = await this.client.get(`/repos/${repoFullName}/events`, {
      params: { per_page: 100 },
    });
    return res.data;
  }

  async getUserEvents(username: string): Promise<any[]> {
    const res = await this.client.get(`/users/${username}/events`, {
      params: { per_page: 100 },
    });
    return res.data;
  }

  async getUserPublicEvents(username: string): Promise<any[]> {
    const res = await this.client.get(`/users/${username}/events/public`, {
      params: { per_page: 100 },
    });
    return res.data;
  }

  async getCommitsForRepo(
    repoFullName: string,
    since: string,
    until: string
  ): Promise<any[]> {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repo format: ${repoFullName}`);
    }

    const res = await this.client.get(`/repos/${owner}/${repo}/commits`, {
      params: {
        since,
        until,
        per_page: 100,
      },
    });

    return res.data;
  }
}
