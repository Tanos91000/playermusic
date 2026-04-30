const DiscordRPC = require('discord-rpc');

let rpcClient = null;
let rpcClientId = null;
let rendererClientId = '';

function readPkgDiscordFields() {
  try {
    return require('../package.json');
  } catch {
    return {};
  }
}

function effectiveClientId() {
  const trimmed = (rendererClientId || '').trim();
  if (trimmed) return trimmed;
  const env = (process.env.DISCORD_CLIENT_ID || '').trim();
  if (env) return env;
  const pkg = readPkgDiscordFields();
  return ((pkg.discordClientId || '') + '').trim();
}

function effectiveLargeImageKey() {
  const pkg = readPkgDiscordFields();
  return ((pkg.discordLargeImageKey || '') + '').trim();
}

async function teardownRpc() {
  if (!rpcClient) return;
  const c = rpcClient;
  rpcClient = null;
  rpcClientId = null;
  try {
    await c.clearActivity().catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    c.removeAllListeners();
    await c.destroy();
  } catch {
    /* ignore */
  }
}

async function ensureClient() {
  const clientId = effectiveClientId();
  if (!clientId) {
    await teardownRpc();
    return null;
  }

  if (rpcClient && rpcClientId === clientId) return rpcClient;

  await teardownRpc();
  rpcClientId = clientId;
  rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

  try {
    await rpcClient.login({ clientId });
    return rpcClient;
  } catch {
    await teardownRpc();
    return null;
  }
}

function setRendererClientId(id) {
  rendererClientId = typeof id === 'string' ? id : '';
}

/**
 * @param {object} payload
 * @param {'idle'|'playing'|'paused'} payload.mode
 * @param {string} [payload.title]
 * @param {string} [payload.artist]
 * @param {number} [payload.startedAt] unix ms
 * @param {string} [payload.largeImageKey] override asset key
 */
async function update(payload) {
  const mode = payload?.mode || 'idle';
  const client = await ensureClient();
  if (!client) return;

  if (mode === 'idle' || !payload?.title) {
    await client.clearActivity().catch(() => {});
    return;
  }

  const details = String(payload.title).slice(0, 128);
  const state = String(payload.artist || 'Aura Player').slice(0, 128);

  const activity = {
    details,
    state: mode === 'paused' ? `${state} · En pause` : state,
    instance: false
  };

  if (mode === 'playing') {
    const t = payload.startedAt;
    activity.startTimestamp = typeof t === 'number' && Number.isFinite(t) ? t : Date.now();
  }

  const assetKey = (payload.largeImageKey || effectiveLargeImageKey() || '').trim();
  if (assetKey) {
    activity.largeImageKey = assetKey;
    activity.largeImageText = String(payload.largeImageText || 'Aura Player').slice(0, 128);
  }

  await client.setActivity(activity).catch(() => {});
}

async function shutdown() {
  rendererClientId = '';
  await teardownRpc();
}

module.exports = {
  setRendererClientId,
  update,
  shutdown
};
