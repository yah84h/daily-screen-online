import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import {
  randomBytes,
  randomUUID,
  createHash,
  createPublicKey,
  verify,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
/** Credentials never leave this process; each staff account has a separate encrypted record. */
export function createChatGPTConnection(directory, userId, fetch = globalThis.fetch) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyFile = path.join(directory, 'key');
  if (!fs.existsSync(keyFile))
    fs.writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
  fs.chmodSync(keyFile, 0o600);
  const key = fs.readFileSync(keyFile);
  const credentialFile = path.join(
    directory,
    createHash('sha256').update(String(userId)).digest('hex') + '.enc',
  );
  const safeStorage = {
    isEncryptionAvailable: () => key.length === 32,
    encryptString(text) {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decryptString(bytes) {
      const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
    },
  };
  const AUTH = 'https://auth.openai.com';
  const API = 'https://api.openai.com/v1';
  const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
  const random = () => randomBytes(32).toString('base64url');
  const file = () => credentialFile;
  let saved;
  let pending;
  let lastError;
  let refreshing;
  let epoch = 0;
  let sessionAbort = new AbortController();
  function invalidate() {
    epoch++;
    sessionAbort.abort();
    sessionAbort = new AbortController();
  }
  function read() {
    if (saved) return saved;
    if (fs.existsSync(file())) {
      if (!safeStorage.isEncryptionAvailable())
        throw new Error('Secure storage is unavailable. Unlock your login keychain.');
      saved = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
      if (!saved.host || !Array.isArray(saved.profiles))
        throw new Error('ChatGPT connection storage is invalid.');
    } else saved = { host: `urn:uuid:${randomUUID()}`, profiles: [] };
    return saved;
  }
  function write() {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('Secure storage is unavailable. No ChatGPT credentials were saved.');
    const target = file(),
      temp = target + '.tmp';
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temp, safeStorage.encryptString(JSON.stringify(read())), { mode: 0o600 });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, target);
  }
  function selected() {
    const store = read();
    return store.profiles.find((p) => p.id === store.active);
  }
  function chatGPTStatus() {
    try {
      const store = read(),
        profile = selected();
      return {
        pending: !!pending,
        connected: !!profile?.access,
        sharing: !!profile?.access && !!profile.scopes?.includes('chatgpt.tokens.use.direct'),
        active: store.active,
        profiles: store.profiles.map((p, i) => ({
          id: p.id,
          label: `${p.email || 'ChatGPT account'} · ${i + 1}`,
        })),
        error: lastError,
      };
    } catch {
      return {
        pending: false,
        connected: false,
        sharing: false,
        profiles: [],
        error:
          'Could not unlock ChatGPT connection storage. Unlock your login keychain and try again.',
      };
    }
  }
  function cancelChatGPTSignIn() {
    if (pending) {
      clearTimeout(pending.timer);
      pending.server.close();
      pending = undefined;
    }
  }
  async function tokenRequest(values) {
    const response = await fetch(`${AUTH}/api/accounts/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values),
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(
        `ChatGPT authorization failed (HTTP ${response.status}). Please reconnect; your API provider was not changed.`,
      );
    return response.json();
  }
  /** Only trust signed OpenAI ID tokens, never unverified JWT account claims. */
  async function verifyChatGPTIdentity(token, clientId, nonce) {
    const pieces = token.split('.');
    if (pieces.length !== 3) throw new Error('Invalid ChatGPT identity token.');
    const header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString());
    if (header.alg !== 'RS256' || typeof header.kid !== 'string')
      throw new Error('Unsupported ChatGPT identity signature.');
    const response = await fetch(`${AUTH}/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Could not verify ChatGPT identity. Try signing in again.');
    const jwks = await response.json();
    const jwk = jwks.keys.find(
      (key) =>
        key.kid === header.kid &&
        key.kty === 'RSA' &&
        (!key.use || key.use === 'sig') &&
        (!key.alg || key.alg === 'RS256'),
    );
    if (
      !jwk ||
      !verify(
        'RSA-SHA256',
        Buffer.from(`${pieces[0]}.${pieces[1]}`),
        createPublicKey({ key: jwk, format: 'jwk' }),
        Buffer.from(pieces[2], 'base64url'),
      )
    )
      throw new Error('ChatGPT identity signature did not verify.');
    const claims = JSON.parse(Buffer.from(pieces[1], 'base64url').toString());
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const now = Date.now() / 1000;
    if (
      claims.iss !== AUTH ||
      !audience.includes(clientId) ||
      (audience.length > 1 && claims.azp !== clientId) ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      (claims.nbf && claims.nbf > now + 30) ||
      (nonce && claims.nonce !== nonce) ||
      typeof claims.sub !== 'string' ||
      !claims.sub
    )
      throw new Error('ChatGPT identity validation failed.');
    return {
      subject: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : undefined,
    };
  }
  function credentials(data, old) {
    if (
      typeof data.access_token !== 'string' ||
      data.token_type?.toLowerCase() !== 'bearer' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new Error('ChatGPT returned incomplete credentials.');
    return {
      access: data.access_token,
      refresh: typeof data.refresh_token === 'string' ? data.refresh_token : old?.refresh,
      idToken: typeof data.id_token === 'string' ? data.id_token : old?.idToken,
      expires: Date.now() + data.expires_in * 1000,
      scopes: typeof data.scope === 'string' ? data.scope.split(/\s+/) : old?.scopes || [],
    };
  }
  async function startChatGPTSignIn(profileId = read().active) {
    cancelChatGPTSignIn();
    lastError = undefined;
    if (!safeStorage.isEncryptionAvailable())
      throw new Error('Unlock your login keychain before connecting ChatGPT.');
    const store = read(),
      profile = profileId ? store.profiles.find((p) => p.id === profileId) : undefined;
    if (profileId && !profile) throw new Error('Unknown ChatGPT account.');
    write(); // Persist this installation's host identifier before opening the browser.
    const state = random(),
      nonce = random(),
      verifier = random();
    const server = createServer(async (request, response) => {
      const attempt = pending;
      if (!attempt || attempt.server !== server) {
        response.writeHead(410).end('Sign-in expired.');
        return;
      }
      const url = new URL(request.url || '/', attempt.redirect);
      if (request.method !== 'GET' || url.pathname !== '/auth/callback') {
        response.writeHead(404).end();
        return;
      }
      if (url.searchParams.get('state') !== state) {
        response.writeHead(400).end('Invalid sign-in state. Return to Daily Screen and try again.');
        return;
      }
      if (attempt.processing) {
        response.writeHead(409).end('Sign-in is already being processed.');
        return;
      }
      attempt.processing = true;
      try {
        if (url.searchParams.has('error'))
          throw new Error('ChatGPT sign-in was declined. You can reconnect when ready.');
        const code = url.searchParams.get('code'),
          issued = url.searchParams.get('client_id') || profile?.clientId;
        if (
          !code ||
          !issued ||
          issued === 'dynamic_agent_client' ||
          (profile && issued !== profile.clientId)
        )
          throw new Error('Incomplete or mismatched ChatGPT registration.');
        // Keep a newly issued registration even if its one-time code later expires.
        const registration = profile || { id: randomUUID(), clientId: issued };
        if (!profile) {
          store.profiles.push(registration);
          write();
        }
        const data = await tokenRequest({
          grant_type: 'authorization_code',
          client_id: issued,
          code,
          code_verifier: verifier,
          redirect_uri: attempt.redirect,
          resource: API,
        });
        const identity = await verifyChatGPTIdentity(String(data.id_token || ''), issued, nonce);
        if (profile?.subject && profile.subject !== identity.subject)
          throw new Error('That is a different ChatGPT account. Add it as a new account instead.');
        if (pending !== attempt) throw new Error('Sign-in cancelled.');
        const next = { ...registration, ...identity, ...credentials(data) };
        store.profiles[store.profiles.findIndex((p) => p.id === registration.id)] = next;
        store.active = next.id;
        invalidate();
        write();
        response
          .writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
          })
          .end(
            'ChatGPT connected. Return to Daily Screen, choose an available model and save your provider selection.',
          );
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'ChatGPT sign-in failed.';
        response
          .writeHead(400, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
          .end('ChatGPT sign-in did not complete. Return to Daily Screen for details.');
      } finally {
        if (pending === attempt) cancelChatGPTSignIn();
      }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('Could not start the ChatGPT callback listener.');
    }
    const redirect = `http://127.0.0.1:${address.port}/auth/callback`;
    const timer = setTimeout(
      () => {
        if (pending?.server === server) {
          lastError = 'ChatGPT sign-in timed out. Please try again.';
          cancelChatGPTSignIn();
        }
      },
      5 * 60 * 1000,
    );
    pending = { server, timer, state, nonce, verifier, redirect, profile, processing: false };
    const url = new URL(`${AUTH}/api/accounts/authorize`);
    const parameters = {
      client_id: profile?.clientId || 'dynamic_agent_client',
      ext_agent_host_id: store.host,
      response_type: 'code',
      redirect_uri: redirect,
      scope: SCOPE,
      resource: API,
      state,
      nonce,
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    };
    if (!profile) parameters.agent_name_hint = 'Daily Screen';
    if (profile?.idToken) parameters.id_token_hint = profile.idToken;
    if (profile?.email) parameters.login_hint = profile.email;
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    return { ...chatGPTStatus(), url: url.href };
  }
  function selectChatGPTAccount(id) {
    if (!read().profiles.some((p) => p.id === id)) throw new Error('Unknown ChatGPT account.');
    cancelChatGPTSignIn();
    invalidate();
    read().active = id;
    lastError = undefined;
    write();
    return chatGPTStatus();
  }
  async function accessToken() {
    const profile = selected();
    if (!profile?.access || !profile.scopes?.includes('chatgpt.tokens.use.direct'))
      throw new Error(
        'Connect ChatGPT and authorize ChatGPT plan usage first. An eligible plan is required.',
      );
    if ((profile.expires || 0) > Date.now() + 60000) return profile.access;
    if (refreshing) return refreshing;
    const generation = epoch;
    const refresh = (async () => {
      if (!profile.refresh)
        throw new Error('Your ChatGPT connection expired. Reconnect in Settings.');
      const data = await tokenRequest({
        grant_type: 'refresh_token',
        client_id: profile.clientId,
        refresh_token: profile.refresh,
        resource: API,
      });
      const next = credentials(data, profile);
      if (data.id_token) {
        const identity = await verifyChatGPTIdentity(data.id_token, profile.clientId);
        if (identity.subject !== profile.subject)
          throw new Error('ChatGPT account identity changed. Reconnect in Settings.');
      }
      if (generation !== epoch) throw new Error('ChatGPT account changed during renewal.');
      Object.assign(profile, next);
      write();
      if (!profile.scopes?.includes('chatgpt.tokens.use.direct'))
        throw new Error('ChatGPT plan usage is no longer authorized. Reconnect in Settings.');
      return profile.access;
    })();
    refreshing = refresh;
    try {
      return await refresh;
    } finally {
      if (refreshing === refresh) refreshing = undefined;
    }
  }
  async function disconnectChatGPT() {
    cancelChatGPTSignIn();
    invalidate();
    const profile = selected();
    let revoked = !profile?.refresh;
    try {
      if (profile?.refresh) {
        const response = await fetch(`${AUTH}/api/accounts/oauth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: profile.refresh,
            token_type_hint: 'refresh_token',
            client_id: profile.clientId,
          }),
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        });
        revoked = response.ok;
      }
    } catch {
      revoked = false;
    }
    if (profile) {
      delete profile.access;
      delete profile.refresh;
      delete profile.idToken;
      delete profile.expires;
      delete profile.scopes;
      write();
    }
    lastError = revoked
      ? undefined
      : 'Disconnected locally. Remote revocation was not confirmed; disconnect Daily Screen in ChatGPT Settings to revoke access.';
    return chatGPTStatus();
  }
  async function chatGPTModels() {
    const token = await accessToken();
    const response = await fetch(`${API}/models`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.any([sessionAbort.signal, AbortSignal.timeout(20000)]),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(
        `Could not list ChatGPT models (HTTP ${response.status}). Reconnect or check your plan access.`,
      );
    const data = await response.json();
    return (data.models || [])
      .filter((m) => m.visibility === 'list' && typeof m.slug === 'string')
      .map((m) => ({ id: m.slug, name: m.display_name || m.slug }));
  }
  async function chatGPTRequest(payload, signal) {
    const token = await accessToken();
    return fetch(`${API}/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'error',
      signal: AbortSignal.any([
        sessionAbort.signal,
        ...(signal ? [signal] : []),
        AbortSignal.timeout(120000),
      ]),
    });
  }
  return {
    status: chatGPTStatus,
    start: startChatGPTSignIn,
    cancel: cancelChatGPTSignIn,
    disconnect: disconnectChatGPT,
    models: chatGPTModels,
    request: chatGPTRequest,
    verifyIdentity: verifyChatGPTIdentity,
  };
}
