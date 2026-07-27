import { client } from '../api/client.gen';

function getAntiforgeryToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('.GitHub.Antiforgery='))
    ?.split('=')[1];
}

export const configureInterceptors = () => {
  // Request interceptor to attach antiforgery token
  client.instance.interceptors.request.use((config) => {
    const token = getAntiforgeryToken();
    if (token) {
      config.headers['RequestVerificationToken'] = token;
    }
    return config;
  });

  // Response interceptor to handle 401 errors globally
  client.instance.interceptors.response.use(
    (response) => {
      // Return successful responses as-is
      return response;
    },
    (error) => {
      // Handle 401 Unauthorized errors
      if (error.response?.status === 401) {

        // Redirect to login, remembering the current screen so the callback can return here
        // instead of always landing on the dashboard.
        const returnUrl = window.location.pathname + window.location.search;
        window.location.href = `/login/github?returnUrl=${encodeURIComponent(returnUrl)}`;
      }

      // Re-throw the error so it can still be handled by individual components if needed
      return Promise.reject(error);
    }
  );
}
