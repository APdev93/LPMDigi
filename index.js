const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const {
    saveData,
    readData,
    deleteData,
    deleteAllDatabase,
    logger
} = require("./lib/utils");

const app = express();
app.use(bodyParser.json());

app.engine("html", ejs.renderFile);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

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

app.post("/sync", async (req, res) => {
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

app.post("/delete-data", async (req, res) => {
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

app.get("/data/:branch/:username", async (req, res) => {
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
    logger.info("Login request", { username });
    try {
        let payload = {
            username,
            password,
            apk_version
        };

        let headers = {
            "Content-Type": "application/json",
            Cookie: cookie
        };

        let response = await axios.post(`${baseUrl}/AuthLogin`, payload, {
            headers
        });
        //console.log(response);
        logger.success("Login success", { username });
        return res.json(response.data);
    } catch (error) {
        logger.error("Login failed", error);
        console.log("ERROR:", error.response?.data || error.message);
        return res.json(error.response?.data || error.message);
    }
});

app.get("/collect-list/:cabang/:username", async (req, res) => {
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

app.get("/group-list/:cabang/:username", async (req, res) => {
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
