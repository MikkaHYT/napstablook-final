const util = require("minecraft-server-util");
const { Rcon } = require("rcon-client");

function isRconAllowed(client, message) {
    if (!message?.guild || !message?.member) return false;

    const authorId = message?.author?.id;
    const isDev = Boolean(authorId && Array.isArray(client?.config?.dev) && client.config.dev.includes(authorId));

    const allowedUserIds = (process.env.RCON_ALLOWED_USER_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const isAllowedUser = Boolean(authorId && allowedUserIds.includes(authorId));

    const allowedRoleIds = (process.env.RCON_ALLOWED_ROLE_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const memberRoleIds = Array.isArray(message?.member?.roles?.cache)
        ? message.member.roles.cache.map((r) => r.id)
        : message?.member?.roles?.cache
              ? Array.from(message.member.roles.cache.keys())
              : [];
    const hasAllowedRole = allowedRoleIds.length > 0 && memberRoleIds.some((id) => allowedRoleIds.includes(id));

    return Boolean(isDev || isAllowedUser || hasAllowedRole);
}

function getEnvInt(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === "") return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
    getMinecraftStatus: async (client, message) => {
        const host = process.env.MC_HOST || "127.0.0.1";
        const port = getEnvInt("MC_PORT", 25565);
        const timeout = getEnvInt("MC_STATUS_TIMEOUT_MS", 3000);

        try {
            const result = await util.status(host, port, { timeout });

            const playersOnline = result?.players?.online ?? 0;
            const playersMax = result?.players?.max ?? 0;
            const versionName = result?.version?.name ?? "unknown";

            return {
                success: true,
                online: true,
                message: `minecraft server is online. version: ${versionName}. players: ${playersOnline}/${playersMax}.`,
                data: {
                    host,
                    port,
                    version: result?.version,
                    players: result?.players,
                    motd: result?.motd,
                    latencyMs: result?.roundTripLatency,
                },
            };
        } catch (error) {
            const reason = error?.message ? String(error.message) : "unknown error";
            return {
                success: false,
                online: false,
                message: `minecraft server status check failed: ${reason}`,
                data: { host, port },
            };
        }
    },

    runMinecraftRcon: async (client, message, command) => {
        if (!isRconAllowed(client, message)) {
            return {
                success: false,
                message: "you aren't allowed to use minecraft rcon. ask mikka to add your user id to rcon_allowed_user_ids (or give you an allowed role).",
            };
        }

        const host = process.env.RCON_HOST || "127.0.0.1";
        const port = getEnvInt("RCON_PORT", 25575);
        const password = process.env.RCON_PASSWORD;
        const timeout = getEnvInt("RCON_TIMEOUT_MS", 5000);

        if (!password) {
            return {
                success: false,
                message: "rcon is not configured. set enable-rcon=true and rcon.password in server.properties, then set env var rcon_password (and rcon_port if needed).",
            };
        }

        if (!command || typeof command !== "string" || !command.trim()) {
            return { success: false, message: "missing rcon command." };
        }

        const rcon = new Rcon({ host, port, password, timeout });

        try {
            await rcon.connect();
            const response = await rcon.send(command.trim());
            return {
                success: true,
                message: response && String(response).trim() ? `rcon response: ${String(response).trim()}` : "rcon command sent (no response).",
                data: { host, port, command: command.trim(), response },
            };
        } catch (error) {
            const reason = error?.message ? String(error.message) : "unknown error";
            return {
                success: false,
                message: `rcon failed: ${reason}`,
                data: { host, port, command: command.trim() },
            };
        } finally {
            try {
                await rcon.end();
            } catch {
                // ignore
            }
        }
    },
};
