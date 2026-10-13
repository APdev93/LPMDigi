const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { normalizeUsername, getLicense, issueToken, redeemToken, createSession, verifySession, getAdminOverview, revokeLicense } = require("./lib/activation");
const {
    saveData,
    readData,
    deleteData,
    deleteAllDatabase,
    logger
} = require("./lib/utils");


const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (match && process.env[match[1]] === undefined) {
            process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
        }
    }
}

const app = express();
app.use(bodyParser.json());

app.engine("html", ejs.renderFile);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

const progressFile = path.join(__dirname, "database", "progress.json");

// Pastikan folder database ada
if (!fs.existsSync(path.dirname(progressFile))) {
    fs.mkdirSync(path.dirname(progressFile), { recursive: true });
}

// Pastikan progress.json ada
if (!fs.existsSync(progressFile)) {
    fs.writeFileSync(progressFile, "[]", "utf8");
}

const PORT = process.env.PORT || 3000;

const startAutoDeleteScheduler = () => {
    const scheduleDelete = () => {
        const now = new Date();
        const next = new Date();

        next.setHours(5, 0, 0, 0);

        // Jika sudah lewat jam 05:00, jadwalkan untuk besok
        if (now >= next) {
            next.setDate(next.getDate() + 1);
        }

        const delay = next - now;

        logger.info(`Auto delete scheduled at ${next.toLocaleString()}`);

        setTimeout(async () => {
            try {
                const result = await deleteAllDatabase();

                logger.info("Auto delete executed", result);
            } catch (error) {
                logger.error("Auto delete failed", error);
            }

            // Jadwalkan lagi untuk besok jam 05:00
            scheduleDelete();
        }, delay);
    };

    scheduleDelete();
};

const baseUrl = "http://pkmmekaar.kresnasaraswati.id/v1/pkm";
const apk_version = "0.0.18-026-prod @ 2024-06-19";
const cookie =
    "SERVERID=DCPRDNEWAPPPKM12; TS0196d619=01a219d6f17966e8f97ccebf374a091581ba16d1cf86ce1a78d9d62826a7ba9db75dbc5debc3f3deec3a28428d0e320c4b40728618e25f44e1d2d32d1c2cae1425f0b85f66";

// Melindungi API utama berdasarkan username yang sudah berhasil login dan memiliki lisensi aktif.
function requireActiveLicense(req, res, next) {
    const username = normalizeUsername(
        req.params.username || req.body?.username || req.body?.users
    );

    if (!username) {
        return res.status(400).json({ status: false, message: "Username wajib diisi" });
    }

    try {
        const sessionToken = req.get("x-license-session") || "";
        if (!verifySession(sessionToken, username)) {
            return res.status(401).json({ status: false, code: "INVALID_LICENSE_SESSION", message: "Sesi aplikasi tidak valid. Silakan login kembali" });
        }
        const license = getLicense(username);
        if (!license.isActive) {
            return res.status(403).json({
                status: false,
                code: "ACTIVATION_REQUIRED",
                message: "Lisensi belum aktif atau sudah kedaluwarsa"
            });
        }
        next();
    } catch (error) {
        logger.error("License check failed", { message: error.message });
        return res.status(500).json({ status: false, message: "Gagal memeriksa lisensi" });
    }
}
app.get("/", (req, res) => {
    res.render("index.html");
});

app.get("/login", (req, res) => {
    res.render("login.html");
});

app.get("/tes", (req, res) => {
    res.render("tes.html");
});

app.get("/kolase", (req, res) => {
    res.render("kolase.html");
});

app.get("/master-produk", (req, res) => {
    const data = JSON.parse(
        fs.readFileSync("./data/masterProduk.json", "utf-8")
    );

    res.json({
        status: true,
        data: data
    });
});

app.get("/progress", (req, res) => {
    try {
        let progress = [];

        try {
            progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
        } catch (error) {
            progress = [];
        }

        return res.json({
            status: true,
            data: progress
        });
    } catch (error) {
        logger.error("Gagal mengambil progress", error);

        return res.status(500).json({
            status: false,
            message: error.message,
            data: []
        });
    }
});

app.post("/sync-progress", requireActiveLicense, (req, res) => {
    try {
        const data = req.body;

        if (!data.brach || !data.users || !data.ao_name || !data.pkm) {
            return res.status(400).json({
                status: false,
                message: "Data progress tidak lengkap"
            });
        }

        let progress = [];

        try {
            progress = JSON.parse(fs.readFileSync(progressFile, "utf8"));
        } catch (error) {
            progress = [];
        }

        if (!Array.isArray(progress)) {
            progress = [];
        }

        // ==========================================
        // USER HARUS UNIQUE
        // BRANCH BOLEH SAMA
        // ==========================================
        const index = progress.findIndex(
            item => String(item.users) === String(data.users)
        );

        const updatedAt = new Date().toISOString();

        if (index !== -1) {
            // ==========================
            // USER SUDAH ADA → UPDATE
            // ==========================
            progress[index] = {
                ...progress[index],
                brach: data.brach,
                ao_name: data.ao_name,
                pkm: data.pkm,
                updated_at: updatedAt
            };

            logger.info("Progress updated", {
                branch: data.brach,
                username: data.users
            });
        } else {
            // ==========================
            // USER BELUM ADA → TAMBAH
            // ==========================
            progress.push({
                brach: data.brach,
                users: data.users,
                ao_name: data.ao_name,
                pkm: data.pkm,
                updated_at: updatedAt
            });

            logger.info("Progress added", {
                branch: data.brach,
                username: data.users
            });
        }

        fs.writeFileSync(
            progressFile,
            JSON.stringify(progress, null, 2),
            "utf8"
        );

        return res.json({
            status: true,
            message:
                index !== -1
                    ? "Progress berhasil diperbarui"
                    : "Progress berhasil ditambahkan",
            data: index !== -1 ? progress[index] : progress[progress.length - 1]
        });
    } catch (error) {
        logger.error("Progress sync failed", error);

        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
});

app.post("/sync", requireActiveLicense, async (req, res) => {
    let { name, username, branch, data } = req.body;
    logger.info("Sync request", { username });
    try {
        let savedData = await saveData(name, username, branch, data);
        logger.success("Sync success", { username, name });
        res.json(savedData);
    } catch (error) {
        logger.error("Sync failed", error);
        res.json({
            status: false,
            message: error.message
        });
    }
});

app.post("/delete-data", requireActiveLicense, async (req, res) => {
    let { username, branch } = req.body;

    logger.warning("Delete data request", { username, branch });

    try {
        let deletedData = await deleteData(username, branch);

        logger.success("Data deleted", { username, branch });

        res.json(deletedData);
    } catch (error) {
        logger.error("Delete failed", error);
        res.json({
            status: false,
            message: error.message
        });
    }
});

app.get("/data/:branch/:username", requireActiveLicense, async (req, res) => {
    let { username, branch } = req.params;
    logger.info("Get data request", { username });
    try {
        let result = await readData(username, branch);
        logger.success("Get Data success", { username });
        res.json(result);
    } catch (error) {
        logger.error("Get data failed", error);
        res.json({
            status: false,
            message: error.message,
            data: null
        });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const normalizedUsername = normalizeUsername(username);
    logger.info("Login request", { username: normalizedUsername });

    if (!normalizedUsername || typeof password !== "string" || !password) {
        return res.status(400).json({ responseStatus: false, message: "Username dan password wajib diisi" });
    }

    try {
        const payload = { username: normalizedUsername, password, apk_version };
        const headers = { "Content-Type": "application/json", Cookie: cookie };
        const response = await axios.post(`${baseUrl}/AuthLogin`, payload, { headers });
        const result = response.data || {};

        // Status aktivasi hanya dicek setelah autentikasi eksternal berhasil.
        if (result.responseStatus === true && result.token && result.data) {
            const license = getLicense(normalizedUsername);
            logger.success("External login success", { username: normalizedUsername, isActive: license.isActive });
            return res.json({
                ...result,
                activationRequired: !license.isActive,
                license: {
                    isActive: license.isActive,
                    expiresAt: license.expiresAt
                },
                licenseSession: license.isActive ? createSession(normalizedUsername) : null
            });
        }

        return res.status(response.status || 200).json(result);
    } catch (error) {
        logger.error("Login failed", { username: normalizedUsername, message: error.message });
        return res.status(error.response?.status || 502).json(
            error.response?.data || { responseStatus: false, message: "Gagal menghubungi server login" }
        );
    }
});

// User menukarkan token setelah berhasil login ke endpoint eksternal.
app.post("/activation/activate", (req, res) => {
    const { username, token } = req.body || {};
    if (typeof username !== "string" || typeof token !== "string") {
        return res.status(400).json({ status: false, message: "Username dan token wajib diisi" });
    }

    try {
        const result = redeemToken(username, token);
        if (!result.ok) return res.status(400).json({ status: false, message: result.message });
        return res.json({ status: true, message: "Aktivasi berhasil", isActive: true, expiresAt: result.expiresAt, licenseSession: result.sessionToken });
    } catch (error) {
        logger.error("Activation failed", { message: error.message });
        return res.status(500).json({ status: false, message: "Gagal memproses aktivasi" });
    }
});

// Dashboard admin. Semua data/API admin tetap memerlukan ADMIN_KEY.
function requireAdmin(req, res, next) {
    const configuredKey = process.env.ADMIN_KEY;
    const suppliedKey = req.get("x-admin-key") || "";
    if (!configuredKey) {
        return res.status(503).json({ status: false, message: "ADMIN_KEY belum dikonfigurasi di server" });
    }
    const a = Buffer.from(configuredKey);
    const b = Buffer.from(suppliedKey);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({ status: false, message: "Akses admin ditolak" });
    }
    next();
}

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("/admin/overview", requireAdmin, (req, res) => {
    try { return res.json({ status: true, ...getAdminOverview() }); }
    catch (error) {
        logger.error("Admin overview failed", { message: error.message });
        return res.status(500).json({ status: false, message: "Gagal memuat data dashboard" });
    }
});
app.post("/admin/licenses/revoke", requireAdmin, (req, res) => {
    const { username } = req.body || {};
    if (typeof username !== "string" || !username.trim()) {
        return res.status(400).json({ status: false, message: "Username wajib diisi" });
    }
    try {
        const revoked = revokeLicense(username);
        return res.json({ status: true, revoked, message: revoked ? "Lisensi berhasil dinonaktifkan" : "Lisensi untuk username ini tidak ditemukan" });
    } catch (error) {
        logger.error("License revoke failed", { message: error.message });
        return res.status(500).json({ status: false, message: "Gagal menonaktifkan lisensi" });
    }
});

// Endpoint admin dilindungi ADMIN_KEY dari environment, bukan dari frontend.
app.post("/admin/tokens", requireAdmin, (req, res) => {
    const { username } = req.body || {};
    if (typeof username !== "string" || !username.trim()) {
        return res.status(400).json({ status: false, message: "Username target wajib diisi" });
    }

    try {
        const result = issueToken(username);
        return res.status(201).json({
            status: true,
            username: result.username,
            activationToken: result.token,
            redeemBefore: result.expiresAt
        });
    } catch (error) {
        logger.error("Token generation failed", { message: error.message });
        return res.status(500).json({ status: false, message: "Gagal membuat token" });
    }
});

app.get("/collect-list/:cabang/:username", requireActiveLicense, async (req, res) => {
    let { cabang, username } = req.params;

    logger.info("Fetch collect list", { username, cabang });

    let Authorization = req.headers["authorization"];

    try {
        let response = await axios.get(
            `${baseUrl}/GetCollectionList/${cabang}/${username}`,
            {
                headers: {
                    Cookie: cookie,
                    Authorization: Authorization
                }
            }
        );

        let data = response.data.data
            .filter(item => item.StatusPAR === "NO")
            .map(item => ({
                id: item.AccountID,
                IdKelompok: item.GroupID,
                namaKelompok: item.GroupName,
                idProduk: item.ProductID,
                nama: item.ClientName,
                rill: item.Rill,
                ke: item.Ke,
                flapond: item.DisburseAmount,
                up: item.UPAmount,
                jumlahAngsuran: item.InstallmentAmount,
                angsuranSebelumnya: item.AngsuranSebelumnya,
                hariPertemuan: item.MeetingDay,
                status: "none"
            }));

        logger.success("Collect list fetched", {
            total: data.length
        });

        return res.json({
            responseCode: response.data.responseCode,
            responseDescription: response.data.responseDescription,
            data
        });
    } catch (error) {
        logger.error("Collect list failed", error);
        return res.json(error.response?.data || error.message);
    }
});

app.get("/group-list/:cabang/:username", requireActiveLicense, async (req, res) => {
    let { cabang, username } = req.params;

    let Authorization = req.headers["authorization"];

    try {
        let response = await axios.get(
            `${baseUrl}/GetListGroup/${cabang}/${username}`,
            {
                headers: {
                    Cookie: cookie,
                    Authorization: Authorization
                }
            }
        );

        let data = response.data.data.map(item => ({
            id: item.GroupID,
            nama: item.GroupName,
            hariPertemuan: item.MeetingDay
        }));

        console.log("jumlah data:", data.length);

        return res.json({
            responseCode: response.data.responseCode,
            responseDescription: response.data.responseDescription,
            data
        });
    } catch (error) {
        console.log("ERROR:", error.response?.data || error.message);
        return res.json(error.response?.data || error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startAutoDeleteScheduler();
});
