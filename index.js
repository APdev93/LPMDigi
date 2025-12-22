const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const ejs = require("ejs");
const path = require("path");

const app = express();
app.use(bodyParser.json());

app.engine("html", ejs.renderFile);
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const baseUrl = "http://pkmmekaar.kresnasaraswati.id/v1/pkm";
const apk_version = "0.0.18-026-prod @ 2024-06-19";
const cookie =
    "SERVERID=DCPRDNEWAPPPKM15; TS0196d619=01a219d6f17b5eef2fb400cc872382725fc5cb3fd51bfde217d3c4fd901bcdbd78ae820e16a3260677694fd48b91325fd2d75395a0f717830cec7c6587ff70a7120a42c6cf";

app.get("/", (req, res) => {
    res.render("index.html");
});

app.get("/login", (req, res) => {
    res.render("login.html");
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        let payload = {
            username,
            password,
            apk_version,
        };

        let headers = {
            "Content-Type": "application/json",
            Cookie: cookie,
        };

        let response = await axios.post(`${baseUrl}/AuthLogin`, payload, {
            headers,
        });

        return res.json(response.data);
    } catch (error) {
        console.log("ERROR:", error.response?.data || error.message);
        return res.json(error.response?.data || error.message);
    }
});

app.get("/collect-list/:cabang/:username", async (req, res) => {
    let { cabang, username } = req.params;

    console.log("Request from: ", username);

    let Authorization = req.headers["authorization"];

    try {
        let response = await axios.get(
            `${baseUrl}/GetCollectionList/${cabang}/${username}`,
            {
                headers: {
                    Cookie: cookie,
                    Authorization: Authorization,
                },
            }
        );

        let data = response.data.data
            .filter((item) => item.StatusPAR === "NO")
            .map((item) => ({
                id: item.ClientID,
                IdKelompok: item.GroupID,
                namaKelompok: item.GroupName,
                idProduk: item.ProductID,
                nama: item.ClientName,
                rill: item.Rill,
                ke: item.Ke,
                flapond: item.DisburseAmount,
                jumlahAngsuran: item.InstallmentAmount,
                hariPertemuan: item.MeetingDay,
                status: "none",
            }));

        console.log("jumlah data:", data.length);

        return res.json({
            responseCode: response.data.responseCode,
            responseDescription: response.data.responseDescription,
            data,
        });
    } catch (error) {
        console.log("ERROR:", error.response?.data || error.message);
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
                    Authorization: Authorization,
                },
            }
        );

        let data = response.data.data.map((item) => ({
            id: item.GroupID,
            nama: item.GroupName,
            hariPertemuan: item.MeetingDay,
        }));

        console.log("jumlah data:", data.length);

        return res.json({
            responseCode: response.data.responseCode,
            responseDescription: response.data.responseDescription,
            data,
        });
    } catch (error) {
        console.log("ERROR:", error.response?.data || error.message);
        return res.json(error.response?.data || error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
