const basePath = process.cwd();
const fs = require("fs");
const path = require("path");

const saveData = async (username, branch, data) => {
	try {
		const dbPath = path.join(basePath, "database", branch, username);

		if (!fs.existsSync(dbPath)) {
			fs.mkdirSync(dbPath, { recursive: true });
		}

		const filePath = path.join(dbPath, "pkm.json");

		fs.writeFileSync(filePath, JSON.stringify(data));

		return {
			status: true,
			message: "Berhasil Sinkronisasi Data"
		};
	} catch (error) {
		return {
			status: false,
			message: error.message
		};
	}
};

const readData = async (username, branch) => {
	try {
		const filePath = path.join(
			basePath,
			"database",
			branch,
			username,
			"pkm.json"
		);

		if (!fs.existsSync(filePath)) {
			return {
				status: false,
				message: "Data tidak ditemukan"
			};
		}

		const raw = fs.readFileSync(filePath);

		const data = JSON.parse(raw);

		return {
			status: true,
			data
		};
	} catch (error) {
		return {
			status: false,
			message: error.message
		};
	}
};

const deleteData = async (username, branch) => {
	try {
		const filePath = path.join(
			basePath,
			"database",
			branch,
			username,
			"pkm.json"
		);

		if (!fs.existsSync(filePath)) {
			return {
				status: false,
				message: "Data tidak ditemukan"
			};
		}

		fs.unlinkSync(filePath);

		const userDir = path.join(
			basePath,
			"database",
			branch,
			username
		);

		if (fs.existsSync(userDir)) {
			const files = fs.readdirSync(userDir);

			if (files.length === 0) {
				fs.rmdirSync(userDir);
			}
		}

		return {
			status: true,
			message: "Data berhasil dihapus"
		};
	} catch (error) {
		return {
			status: false,
			message: error.message
		};
	}
};

const deleteAllDatabase = async () => {
	try {
		const dbPath = path.join(basePath, "database");

		if (!fs.existsSync(dbPath)) {
			return {
				status: false,
				message: "Folder database tidak ditemukan"
			};
		}

		const branches = fs.readdirSync(dbPath);

		for (const branch of branches) {
			const branchPath = path.join(dbPath, branch);

			if (fs.lstatSync(branchPath).isDirectory()) {
				fs.rmSync(branchPath, { recursive: true, force: true });
			}
		}

		return {
			status: true,
			message: "Semua data database berhasil dihapus"
		};
	} catch (error) {
		return {
			status: false,
			message: error.message
		};
	}
};


module.exports = {
	saveData,
	readData,
  deleteData,
  deleteAllDatabase
};
