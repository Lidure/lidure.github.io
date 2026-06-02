export type GitHubProject = {
  name: string;
  htmlUrl: string;
  description: string;
  language: string;
  stars: number;
  pushedAt: string;
  homepage: string | null;
};

type GitHubRepo = {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  homepage: string | null;
  fork: boolean;
  archived: boolean;
  private: boolean;
};

const GITHUB_USER = 'Lidure';
const EXCLUDED_REPO = 'lidure.github.io';

export async function getGitHubProjects(): Promise<GitHubProject[]> {
  try {
    const response = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=pushed`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'lidure.github.io',
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const repos = (await response.json()) as GitHubRepo[];

    return repos
      .filter((repo) => !repo.private && !repo.fork && !repo.archived && repo.name !== EXCLUDED_REPO)
      .map((repo) => ({
        name: repo.name,
        htmlUrl: repo.html_url,
        description: repo.description?.trim() || '暂无简介。',
        language: repo.language || 'Unknown',
        stars: repo.stargazers_count,
        pushedAt: repo.pushed_at,
        homepage: repo.homepage,
      }))
      .sort((left, right) => new Date(right.pushedAt).valueOf() - new Date(left.pushedAt).valueOf())
      .slice(0, 8);
  } catch {
    return [];
  }
}