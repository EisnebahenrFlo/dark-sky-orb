const PRODUCTION_HOSTNAMES = ["meteoflo.com", "www.meteoflo.com"];

export const isDevEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  return !PRODUCTION_HOSTNAMES.includes(window.location.hostname);
};
