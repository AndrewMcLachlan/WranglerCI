import { generateRandomCodeVerifier, calculatePKCECodeChallenge } from 'oauth4webapi';

const githubAuthServer = {
  authorization_endpoint: 'https://github.com/login/oauth/authorize',
  token_endpoint: 'https://github.com/login/oauth/access_token',
};

const client = {
  client_id: 'Ov23lifbpnuz2SpcBzwk',
  redirect_uri: 'http://localhost:3010/oauth/callback',
};

export async function startLogin() {
  const codeVerifier = generateRandomCodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

  sessionStorage.setItem('pkce_verifier', codeVerifier);

  const url = new URL(githubAuthServer.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', client.client_id);
  url.searchParams.set('redirect_uri', client.redirect_uri);
  url.searchParams.set('scope', 'read:user repo');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.href = url.toString();
}

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const codeVerifier = sessionStorage.getItem('pkce_verifier');

  if (!code || !codeVerifier) throw new Error('Missing code or verifier');

  const response = await fetch('/exchange-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });

  if (!response.ok) throw new Error('Token exchange failed');

  const { access_token } = await response.json();
  return access_token;
}
