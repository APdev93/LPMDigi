const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = path.join(__dirname, "..", "data");
const filePath = path.join(dataDir, "activation.json");

fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
        filePath,
        JSON.stringify({ licenses: {}, tokens: [] }, null, 2),
        { mode: 0o600 }
    );
}

function normalizeUsername(username) {
    return String(username || "")
        .trim()
        .toLowerCase();
}

function readStore() {
    const store = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!store.licenses || !Array.isArray(store.tokens)) {
        throw new Error("Format data/activation.json tidak valid");
    }
    if (!Array.isArray(store.sessions)) store.sessions = [];
    return store;
}

function writeStore(store) {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
}

function getLicense(username) {
    const key = normalizeUsername(username);
    const store = readStore();
    const license = store.licenses[key];
    const active = Boolean(
        license &&
        license.isActive === true &&
        license.expiresAt &&
        Date.parse(license.expiresAt) > Date.now()
    );

    if (license && license.isActive && !active) {
        store.licenses[key] = { ...license, isActive: false };
        writeStore(store);
    }

    return {
        isActive: active,
        expiresAt: active ? license.expiresAt : null
    };
}

function createSession(username) {
    const key = normalizeUsername(username);
    const store = readStore();
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    store.sessions = store.sessions.filter(
        item => Date.parse(item.expiresAt) > now.getTime()
    );
    store.sessions.push({
        tokenHash: crypto
            .createHash("sha256")
            .update(sessionToken)
            .digest("hex"),
        username: key,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
    });
    writeStore(store);
    return sessionToken;
}

function verifySession(sessionToken, username) {
    if (typeof sessionToken !== "string" || !sessionToken) return false;
    const key = normalizeUsername(username);
    const hash = crypto.createHash("sha256").update(sessionToken).digest("hex");
    const store = readStore();
    const session = store.sessions.find(
        item => item.tokenHash === hash && item.username === key
    );
    return Boolean(session && Date.parse(session.expiresAt) > Date.now());
}

function getAdminOverview() {
    const store = readStore();
    const now = Date.now();
    const licenses = Object.entries(store.licenses)
        .map(([username, license]) => {
            const active =
                license.isActive === true &&
                Date.parse(license.expiresAt) > now;
            return {
                username,
                isActive: active,
                activatedAt: license.activatedAt || null,
                expiresAt: license.expiresAt || null
            };
        })
        .sort((a, b) => a.username.localeCompare(b.username));
    const tokens = store.tokens
        .map(token => ({
            id: token.id,
            username: token.username,
            createdAt: token.createdAt,
            expiresAt: token.expiresAt,
            usedAt: token.usedAt || null,
            status: token.usedAt
                ? "used"
                : Date.parse(token.expiresAt) <= now
                  ? "expired"
                  : "available"
        }))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return {
        summary: {
            totalUsers: licenses.length,
            activeLicenses: licenses.filter(item => item.isActive).length,
            totalTokens: tokens.length,
            availableTokens: tokens.filter(item => item.status === "available")
                .length
        },
        licenses,
        tokens
    };
}

function revokeLicense(username) {
    const key = normalizeUsername(username);
    if (!key) throw new Error("Username wajib diisi");
    const store = readStore();
    const license = store.licenses[key];
    if (!license) return false;
    store.licenses[key] = {
        ...license,
        isActive: false,
        revokedAt: new Date().toISOString()
    };
    store.sessions = (store.sessions || []).filter(
        item => item.username !== key
    );
    writeStore(store);
    return true;
}

function issueToken(username) {
    const key = normalizeUsername(username);
    if (!key) throw new Error("Username wajib diisi");

    const store = readStore();
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    store.tokens.push({
        id: crypto.randomUUID(),
        username: key,
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        createdAt: now.toISOString(),
        expiresAt,
        usedAt: null
    });
    writeStore(store);

    return { token, username: key, expiresAt };
}

function getMonthlyExpirationDate(date) {
    const next = new Date(date);

    // Gunakan tanggal 25 pada bulan berjalan
    next.setUTCDate(1);
    next.setUTCDate(25);

    // 0 = Minggu, 6 = Sabtu
    const dayOfWeek = next.getUTCDay();

    // Sabtu: maju ke Jumat, tanggal 24
    if (dayOfWeek === 6) {
        next.setUTCDate(24);
    }
    // Minggu: maju ke Jumat, tanggal 23
    else if (dayOfWeek === 0) {
        next.setUTCDate(23);
    }

    // Jika tanggal kedaluwarsa bulan ini sudah lewat,
    // gunakan tanggal 25 bulan berikutnya
    if (next.getTime() <= date.getTime()) {
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(25);

        const nextDay = next.getUTCDay();

        if (nextDay === 6) {
            next.setUTCDate(24);
        } else if (nextDay === 0) {
            next.setUTCDate(23);
        }
    }

    return next;
}

function redeemToken(username, rawToken) {
    const key = normalizeUsername(username);
    const token = String(rawToken || "").trim();
    if (!key || !token || token.length > 200) {
        return { ok: false, message: "Token tidak valid" };
    }

    const store = readStore();
    const existingLicense = store.licenses[key];
    if (
        existingLicense?.isActive &&
        Date.parse(existingLicense.expiresAt) > Date.now()
    ) {
        return { ok: false, message: "Akun masih aktif" };
    }

    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const record = store.tokens.find(item => item.tokenHash === hash);

    if (
        !record ||
        record.username !== key ||
        record.usedAt ||
        Date.parse(record.expiresAt) <= Date.now()
    ) {
        return {
            ok: false,
            message: "Token salah, kedaluwarsa, atau bukan untuk username ini"
        };
    }

    const now = new Date();
    const expiresAt = getMonthlyExpirationDate(now).toISOString();
    record.usedAt = now.toISOString();
    store.licenses[key] = {
        isActive: true,
        activatedAt: now.toISOString(),
        expiresAt
    };
    writeStore(store);

    return {
        ok: true,
        username: key,
        expiresAt,
        sessionToken: createSession(key)
    };
}

module.exports = {
    normalizeUsername,
    getLicense,
    issueToken,
    redeemToken,
    createSession,
    verifySession,
    getAdminOverview,
    revokeLicense
};
