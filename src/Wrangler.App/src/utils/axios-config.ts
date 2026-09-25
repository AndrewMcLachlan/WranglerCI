import type { CreateClientConfig } from '../api/client.gen'

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseURL: "/api",
  withCredentials: true,
  // A failed call must reject, or its caller caches an empty result over good data.
  throwOnError: true,
});
