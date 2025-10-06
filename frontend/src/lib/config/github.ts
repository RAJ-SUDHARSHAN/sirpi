export const GITHUB_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_GITHUB_BASE_URL,

  API_BASE_URL: process.env.NEXT_PUBLIC_GITHUB_API_BASE_URL,

  APP_INSTALLATION_URL: `${process.env.NEXT_PUBLIC_GITHUB_BASE_URL}/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME}/installations/new`,

  REPOSITORY_URL: `${process.env.NEXT_PUBLIC_GITHUB_BASE_URL}`,

  SETTINGS_INSTALLATIONS_URL: `${process.env.NEXT_PUBLIC_GITHUB_BASE_URL}/settings/installations`,
} as const;

export const getGitHubAppInstallationUrl = (state?: string): string => {
  const baseUrl = GITHUB_CONFIG.APP_INSTALLATION_URL;
  return state ? `${baseUrl}?state=${encodeURIComponent(state)}` : baseUrl;
};

export const getGitHubRepositoryUrl = (fullName: string): string => {
  return `${GITHUB_CONFIG.REPOSITORY_URL}/${fullName}`;
};
