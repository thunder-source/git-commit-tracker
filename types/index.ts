export interface Commit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface Contribution {
  repo: string;
  commits: Commit[];
}

export interface GitHubEvent {
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

export interface AppConfig {
  token: string;
  targetUsers: string[];
  targetRepos: string[];
  organization?: string;
  date: Date;
  debug: boolean;
  checkPreviousDay: boolean;
  outputFormat: 'simple' | 'detailed';
  noFiles: boolean;
  outputDir: string;
  output: 'txt' | 'json' | 'md';
  maxBranches: number;
}
