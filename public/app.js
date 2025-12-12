const STORAGE_KEY = "kelompok";
const namaUnit = document.getElementById("branch");
const namaUser = document.getElementById("name");

namaUnit.innerText = localStorage.getItem("cabangID") + " " + localStorage.getItem("unit") || "";
namaUser.innerText = localStorage.getItem("name") || "";

function showLoading() {
	document.getElementById("loadingIndicator").style.display = "flex";
}

function hideLoading() {
	document.getElementById("loadingIndicator").style.display = "none";
}

function successAlert(msg) {
	Swal.fire({
		title: "Berhasil!",
		text: msg,
		icon: "success",
		confirmButtonText: "Oke",
		customClass: {
			popup: "swal-success-popup",
			confirmButton: "swal-success-btn"
		}
	});
}

function errorAlert(msg) {
	Swal.fire({
		title: "Gagal!",
		text: msg,
		icon: "error",
		confirmButtonText: "Mengerti",
		customClass: {
			popup: "swal-err-popup",
			confirmButton: "swal-err-btn"
		}
	});
}

function getKodeHariNow() {
	let day = new Date().getDay(); // 0 = Minggu, 1 = Senin, ... 6 = Sabtu

	// konversi ke mapping Anda (1–7)
	let mapping = {
		0: 1, // Minggu
		1: 2, // Senin
		2: 3, // Selasa
		3: 4, // Rabu
		4: 5, // Kamis
		5: 6, // Jumat
		6: 7 // Sabtu
	};

	return mapping[day];
}

async function getKelompok() {
	try {
		let response = await fetch(
			`/group-list/${localStorage.getItem("cabangID")}/${localStorage.getItem("username")}`,
			{
				headers: {
					Authorization: localStorage.getItem("auth")
				}
			}
		);
		if (!response.ok) throw new Error("Gagal mengambil data kelompok");
		let data = await response.json();
		return data.data;
	} catch (error) {
		alert("ERROR: " + (error.response?.data || error.message));
	}
}

async function getNasabah() {
	try {
		let response = await fetch(
			`/collect-list/${localStorage.getItem("cabangID")}/${localStorage.getItem("username")}`,
			{
				headers: {
					Authorization: localStorage.getItem("auth")
				}
			}
		);
		if (!response.ok) throw new Error("Gagal mengambil data nasabah");
		let data = await response.json();
		return data.data;
	} catch (error) {
		errorAlert("ERROR: " + (error.response?.data || error.message));
	}
}

function loadData(kelompokData, nasabahData) {
	let stored = loadLocal();

	let kelompok = kelompokData.map((g) => ({
		...g,
		nasabah: []
	}));

	nasabahData.forEach((n) => {
		let target = kelompok.find((k) => k.id === n.IdKelompok);

		if (target) {
			target.nasabah.push({
				rill: n.rill,
				ke: n.ke,
				idProduk: n.idProduk,
				id: n.id,
				nama: n.nama,
				tagihan: n.jumlahAngsuran,
				status: n.status || "none"
			});
		}
	});
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ kelompok }));
	return { kelompok };
}

function loadLocal() {
	try {
		showLoading();
		let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"kelompok": []}');
		let hariSekarang = getKodeHariNow();
		let filtered;

		if (hariSekarang >= 6) {
			filtered = filterNasabahAngsuranTerakhir(data);
		} else {
			filtered = data.kelompok.filter((k) => k.hariPertemuan === String(hariSekarang));
		}

		return { kelompok: filtered };
	} catch (e) {
		errorAlert(e.message);
		return { kelompok: [] };
	} finally {
		hideLoading();
	}
}

function getTotalAngsuran(idProduk) {
	const match = idProduk.match(/\d+$/);
	return match ? parseInt(match[0]) : 0;
}

function filterNasabahAngsuranTerakhir(dataset) {
	const hasil = { kelompok: [] };

	dataset.kelompok.forEach((k) => {
		const nasabahFiltered = k.nasabah.filter((n) => {
			const total = getTotalAngsuran(n.idProduk);
			return n.ke === total;
		});

		if (nasabahFiltered.length > 0) {
			hasil.kelompok.push({
				id: k.id,
				hariPertemuan: k.hariPertemuan,
				nama: k.nama,
				nasabah: nasabahFiltered
			});
		}
	});

	return hasil;
}

function calcPresencePercentage(state) {
	let total = 0;
	let hadir = 0;

	state.kelompok.forEach((g) => {
		g.nasabah.forEach((n) => {
			total++;
			if (n.status !== "none") hadir++;
		});
	});

	if (total === 0) return "0.00";
	return ((hadir / total) * 100).toFixed(2);
}

function syncData() {
	try {
		showLoading();
	} finally {
		hideLoading();

		Swal.fire({
			title: "Berhasil!",
			text: "Berhasil sinkronisasi",
			icon: "success",
			confirmButtonText: "Oke",
			customClass: {
				popup: "swal-success-popup",
				confirmButton: "swal-success-btn"
			}
		}).then((result) => {
			if (result.isConfirmed) {
				window.location.reload();
			}
		});
	}
}

const clearBtn = document.getElementById("clearBtn");

clearBtn.addEventListener("click", () => {
	Swal.fire({
		title: "Yakin ingin menghapus data?",
		showDenyButton: true,
		showCancelButton: true,
		customClass: {
			popup: "swal-success-popup",
			confirmButton: "swal-success-btn",
			cancelButton: "swal-err-btn",
			denyButton: "swal-deny-btn"
		},
		confirmButtonText: "Ya",
		denyButtonText: "Tidak",
		cancelButtonText: "Batal"
	}).then((result) => {
		if (result.isConfirmed) {
			localStorage.clear();
			successAlert("Berhasil menghapus data");
			location.reload();
		} else if (result.isDenied) {
			Swal.fire("Data tidak dihapus", "", "info");
		}
	});
});

function saveData(data) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function genId(prefix = "") {
	return prefix + Date.now().toString(36) + Math.floor(Math.random() * 900).toString(36);
}

function rupiah(n) {
	n = Number(n) || 0;
	return n.toLocaleString("id-ID");
}

function qs(name) {
	return new URLSearchParams(location.search).get(name);
}

/* ===== INITIAL APP STATE ===== */

let state = {};

let currentGroupId = null;

/* ===== UI ELEMENTS ===== */
const groupsListEl = document.getElementById("groupsList");
const totalUangEl = document.getElementById("totalUang");
const totalTransferEl = document.getElementById("totalTransfer");
const totalNasabahEl = document.getElementById("totalNasabah");
const totalBelumEl = document.getElementById("totalBelum");
const totalBelumNasabahEl = document.getElementById("nasBelumStor");
const totalSudahNasabahEl = document.getElementById("nasSudahStor");
const totalProgress = document.getElementById("progress");
const totalRill = document.getElementById("totalRill");

const pageGroups = document.getElementById("page-groups");
const pageGroupDetail = document.getElementById("page-group-detail");
const groupTitleEl = document.getElementById("groupTitle");
const groupMetaEl = document.getElementById("groupMeta");
const groupRecapEl = document.getElementById("groupRecap");
const nasabahListEl = document.getElementById("nasabahList");

/* modals */
const modalGroup = document.getElementById("modalGroup");
const inputGroupName = document.getElementById("inputGroupName");
const saveGroupBtn = document.getElementById("saveGroupBtn");
const closeGroupModal = document.getElementById("closeGroupModal");
const modalGroupTitle = document.getElementById("modalGroupTitle");

const modalNasabah = document.getElementById("modalNasabah");
const inputNasabahName = document.getElementById("inputNasabahName");
const inputNasabahTagihan = document.getElementById("inputNasabahTagihan");
const saveNasabahBtn = document.getElementById("saveNasabahBtn");
const saveNasabahAgainBtn = document.getElementById("saveNasabahAgainBtn");
const closeNasabahModal = document.getElementById("closeNasabahModal");

/* buttons */
const btnNewGroup = document.getElementById("btnNewGroup");
const openNewGroup = document.getElementById("openNewGroup");
const backToGroups = document.getElementById("backToGroups");
const btnAddNasabah = document.getElementById("btnAddNasabah");
const btnEditGroup = document.getElementById("btnEditGroup");
const btnDeleteGroup = document.getElementById("btnDeleteGroup");
const btnCekDo = document.getElementById("btnCekDo");

/* ===== RENDER: DASHBOARD & GROUP LIST ===== */
function calcAllTotals() {
	let totalCash = 0,
		totalTf = 0,
		totalNas = 0,
		totalTagihan = 0,
		totalBelumNas = 0,
		totalSudahNas = 0;

	state?.kelompok.forEach((k) => {
		k.nasabah.forEach((n) => {
			const t = Number(n.tagihan) || 0;
			totalTagihan += t;

			if (n.status === "cash") totalCash += t;
			else if (n.status === "tf") totalTf += t;
			else if (n.status === "none") totalBelumNas += 1;
		});

		totalNas += k.nasabah.length;
	});

	return {
		totalCash,
		totalTf,
		totalNas,
		totalTagihan,
		totalBelum: Math.max(0, totalTagihan - (totalCash + totalTf)),
		totalBelumNas,
		totalSudahNas: totalNas - totalBelumNas
	};
}

function renderDashboard() {
	const totals = calcAllTotals();
	totalUangEl.innerText = `Rp ${rupiah(totals.totalCash + totals.totalTf)}`;
	totalTransferEl.innerText = `Rp ${rupiah(totals.totalTf)}`;
	totalRill.innerText = `Rp ${rupiah(totals.totalCash)}`;
	totalNasabahEl.innerText = totals.totalNas.toString();
	totalBelumEl.innerText = `Rp ${rupiah(totals.totalBelum)}`;
	totalBelumNasabahEl.innerText = totals.totalBelumNas.toString();
	totalSudahNasabahEl.innerText = totals.totalSudahNas.toString();
	totalProgress.innerHTML = calcPresencePercentage(state) + "%";
}

function renderGroups() {
	const cardTitle = document.getElementById("cardTitle");

	groupsListEl.innerHTML = "";
	let currentDay = getKodeHariNow();

	if (currentDay >= 6) {
		cardTitle.innerText = "Daftar DO Minggu Depan";
	} else {
		cardTitle.innerText = "Daftar PKM";
	}

	if (state.kelompok.length === 0) {
		groupsListEl.innerHTML = `<div class="empty">Tidak ada penagihan hari ini.</div>`;
		return;
	}

	state.kelompok.forEach((k) => {
		let cash = 0,
			tf = 0,
			target = 0;
		k.nasabah.forEach((n) => {
			const t = Number(n.tagihan) || 0;
			target += t;
			if (n.status === "cash") cash += t;
			else if (n.status === "tf") tf += t;
		});

		const div = document.createElement("div");
		div.className = "list-item";
		div.setAttribute("data-action", "open");
		div.setAttribute("data-id", k.id);

		div.innerHTML = `
      <div class="list-left">
        <div>
          <div class="kelompok-name">${escapeHtml(k.nama)}</div>
          <div class="kelompok-meta">
            <span class="badge">Cash: Rp ${rupiah(cash)}</span>
            <span class="badge">TF: Rp ${rupiah(tf)}</span>
            <span class="badge">Nasabah: ${k.nasabah.length}</span>
          </div>
        </div>
      </div>

      <div class="actions" style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-edit" data-action="edit" data-id="${k.id}">
          <i data-feather="edit-2"></i>
        </button>
        <button class="btn btn-danger" data-action="delete" data-id="${k.id}">
          <i data-feather="trash-2"></i>
        </button>
      </div>
    `;

		groupsListEl.appendChild(div);
	});

	feather.replace();
}

/* ===== GROUP DETAIL RENDER ===== */
function renderGroupDetail(groupId) {
	const k = state.kelompok.find((x) => x.id === groupId);
	if (!k) return alert("Kelompok tidak ditemukan");

	currentGroupId = groupId;
	groupTitleEl.innerText = k.nama;

	// meta
	const totalTarget = k.nasabah.reduce((s, n) => s + (Number(n.tagihan) || 0), 0);
	const totalCash = k.nasabah
		.filter((n) => n.status === "cash")
		.reduce((s, n) => s + (Number(n.tagihan) || 0), 0);
	const totalTf = k.nasabah
		.filter((n) => n.status === "tf")
		.reduce((s, n) => s + (Number(n.tagihan) || 0), 0);
	const belum = Math.max(0, totalTarget - (totalCash + totalTf));
	groupMetaEl.innerHTML = `<small class="kelompok-meta">Total Tagihan: Rp ${rupiah(
		totalTarget
	)} • Cash: Rp ${rupiah(totalCash)} • TF: Rp ${rupiah(totalTf)} • Belum: Rp ${rupiah(
		belum
	)}</small>`;

	// recap boxes
	groupRecapEl.innerHTML = `
    <div class="group-recap">
      <div class="recap-box"><div style="color:var(--muted)">Total Tagihan</div><div style="font-weight:700;color:var(--blue)">Rp ${rupiah(
			totalTarget
		)}</div></div>
      <div class="recap-box"><div style="color:var(--muted)">Terkumpul (Cash)</div><div style="font-weight:700;color:var(--blue)">Rp ${rupiah(
			totalCash
		)}</div></div>
      <div class="recap-box"><div style="color:var(--muted)">Total Transfer</div><div style="font-weight:700;color:var(--blue)">Rp ${rupiah(
			totalTf
		)}</div></div>
      <div class="recap-box"><div style="color:var(--muted)">Belum Terkumpul</div><div style="font-weight:700;color:var(--blue)">Rp ${rupiah(
			belum
		)}</div></div>
    </div>
  `;

	// nasabah list
	nasabahListEl.innerHTML = "";
	if (k.nasabah.length === 0) {
		nasabahListEl.innerHTML = `<div class="empty">Belum ada nasabah di kelompok ini.</div>`;
	} else {
		k.nasabah.forEach((n) => {
			const nas = document.createElement("div");
			nas.className = "list-item";
			if (n.status !== "none") {
				nas.classList.add("payed");
			}
			nas.innerHTML = `
<div class="nasabah-item">

  <div class="nasabah-info">
    <div class="nama">${escapeHtml(n.nama)}</div>

    <div class="meta">
      Tagihan: Rp ${rupiah(n.tagihan)} •
      Status: <strong>${
			n.status === "cash" ? "Cash" : n.status === "tf" ? "Transfer" : "Belum Stor"
		}</strong>
    </div>

    <div class="angsuran-ke">
      Ke: <strong>${n.ke}</strong>
    </div>
  </div>

  <div class="nasabah-actions">
    <div class="status-wrap">
      <label class="radio-card">
        <input type="radio" name="st${n.id}" value="cash" ${
			n.status === "cash" ? "checked" : ""
		} data-group="${k.id}" data-nasabah="${n.id}">
        Cash
      </label>

      <label class="radio-card">
        <input type="radio" name="st${n.id}" value="tf" ${
			n.status === "tf" ? "checked" : ""
		} data-group="${k.id}" data-nasabah="${n.id}">
        Transfer
      </label>

      <label class="radio-card">
        <input type="radio" name="st${n.id}" value="none" ${
			n.status === "none" ? "checked" : ""
		} data-group="${k.id}" data-nasabah="${n.id}">
        Tidak Stor
      </label>
    </div>

    <div class="btn-wrap">
      <button class="btn btn-edit" data-action="edit-n" data-id="${n.id}" data-group="${k.id}">
        <i data-feather="edit"></i>
      </button>

      <button class="btn btn-danger" data-action="del-n" data-id="${n.id}" data-group="${k.id}">
        <i data-feather="trash-2"></i>
      </button>
    </div>
  </div>

</div>
`;
			nasabahListEl.appendChild(nas);
		});
		feather.replace();
	}

	// show detail page
	pageGroups.classList.add("hidden");
	pageGroupDetail.classList.remove("hidden");
}

/* ===== CRUD: Kelompok ===== */
function addGroup(name) {
	state.kelompok.push({ id: genId(cabangID), nama: name, nasabah: [] });
	saveData(state);
	renderAll();
}

function updateGroup(id, newName) {
	const k = state.kelompok.find((x) => x.id === id);
	if (!k) return;
	k.nama = newName;
	saveData(state);
	renderAll();
}

function removeGroup(id) {
	state.kelompok = state.kelompok.filter((x) => x.id !== id);
	saveData(state);
	renderAll();
}

/* ===== CRUD: Nasabah ===== */
function addNasabahToGroup(groupId, nama, tagihan, status = "none") {
	const k = state.kelompok.find((x) => x.id === groupId);
	if (!k) return;
	k.nasabah.push({
		rill: 0,
		ke: 0,
		idProduk: "",
		id: genId(localStorage.getItem("cabangID")),
		nama: nama,
		tagihan: Number(tagihan) || 0,
		status
	});
	saveData(state);
	renderGroupDetail(groupId);
	renderAll();
}

function updateNasabah(groupId, nasabahId, newName, newTagihan) {
	const k = state.kelompok.find((x) => x.id === groupId);
	if (!k) return;
	const n = k.nasabah.find((x) => x.id === nasabahId);
	if (!n) return;
	n.nama = newName;
	n.tagihan = Number(newTagihan) || 0;
	saveData(state);
	renderGroupDetail(groupId);
}

function removeNasabah(groupId, nasabahId) {
	const k = state.kelompok.find((x) => x.id === groupId);
	if (!k) return;
	k.nasabah = k.nasabah.filter((x) => x.id !== nasabahId);
	saveData(state);
	renderGroupDetail(groupId);
}

function setNasabahStatus(groupId, nasabahId, status) {
	const k = state.kelompok.find((x) => x.id === groupId);
	if (!k) return;
	const n = k.nasabah.find((x) => x.id === nasabahId);
	if (!n) return;
	n.status = status;
	saveData(state);
	renderGroupDetail(groupId);
}

/* ===== EVENTS & MODAL LOGIC ===== */
function openModal(modalEl) {
	modalEl.style.display = "flex";
}
function closeModal(modalEl) {
	modalEl.style.display = "none";
}

function bindEvents() {
	// open new group modal
	btnNewGroup?.addEventListener("click", () => {
		openNewGroupModal();
	});
	openNewGroup?.addEventListener("click", () => {
		openNewGroupModal();
	});

	// modal group actions
	closeGroupModal?.addEventListener("click", () => closeModal(modalGroup));
	saveGroupBtn?.addEventListener("click", () => {
		const name = inputGroupName.value.trim();
		if (!name) return alert("Isi nama kelompok");
		const editingId = saveGroupBtn.getAttribute("data-edit");
		if (editingId) {
			updateGroup(editingId, name);
			saveGroupBtn.removeAttribute("data-edit");
		} else {
			addGroup(name);
		}
		inputGroupName.value = "";
		closeModal(modalGroup);
	});

	// group list actions (delegation)
	groupsListEl.addEventListener("click", (ev) => {
		const btn = ev.target.closest("button");
		if (btn) {
			const action = btn.dataset.action;
			const id = btn.dataset.id;
			if (action === "edit") return openEditGroupModal(id);
			if (action === "delete") {
				if (confirm("Hapus kelompok?")) removeGroup(id);
				return;
			}
		}

		const item = ev.target.closest(".list-item");
		if (item) {
			const id = item.dataset.id;
			renderGroupDetail(id);
		}
	});
	// back button
	backToGroups?.addEventListener("click", () => {
		pageGroupDetail.classList.add("hidden");
		pageGroups.classList.remove("hidden");
		currentGroupId = null;
		renderAll();
	});

	// group detail buttons
	btnAddNasabah?.addEventListener("click", () => openAddNasabahModal());
	btnEditGroup?.addEventListener("click", () => {
		if (!currentGroupId) return;
		openEditGroupModal(currentGroupId);
	});
	btnDeleteGroup?.addEventListener("click", () => {
		if (!currentGroupId) return;
		if (confirm("Hapus kelompok ini?")) {
			removeGroup(currentGroupId);
			pageGroupDetail.classList.add("hidden");
			pageGroups.classList.remove("hidden");
			currentGroupId = null;
		}
	});

	// nasabah interactions (radio, edit, delete) - delegation on nasabahListEl
	nasabahListEl?.addEventListener("change", (ev) => {
		const input = ev.target;
		if (input && input.name && input.name.startsWith("st")) {
			const groupId = input.getAttribute("data-group");
			const nasId = input.getAttribute("data-nasabah");
			const value = input.value;
			setNasabahStatus(groupId, nasId, value);
		}
	});

	nasabahListEl?.addEventListener("click", (ev) => {
		const btn = ev.target.closest("button");
		if (!btn) return;
		const action = btn.getAttribute("data-action");
		const nasId = btn.getAttribute("data-id");
		const groupId = btn.getAttribute("data-group");
		if (action === "edit-n") {
			// prompt edit
			const k = state.kelompok.find((x) => x.id === groupId);
			const n = k?.nasabah.find((x) => x.id === nasId);
			if (!n) return;
			const newName = prompt("Ubah nama nasabah:", n.nama);
			if (newName === null) return;
			const newTag = prompt("Ubah jumlah tagihan (angka):", n.tagihan);
			if (newTag === null) return;
			updateNasabah(groupId, nasId, newName.trim(), Number(newTag) || 0);
		} else if (action === "del-n") {
			if (confirm("Hapus nasabah ini?")) removeNasabah(groupId, nasId);
		}
	});

	// modal nasabah controls
	closeNasabahModal?.addEventListener("click", () => {
		closeModal(modalNasabah);
		clearNasabahModal();
	});
	saveNasabahBtn?.addEventListener("click", () => {
		const name = inputNasabahName.value.trim();
		const tag = Number(inputNasabahTagihan.value) || 0;
		const status = getSelectedNasabahStatus();
		if (!name) return alert("Isi nama nasabah");
		addNasabahToGroup(currentGroupId, name, tag, status);
		closeModal(modalNasabah);
		clearNasabahModal();
	});
	saveNasabahAgainBtn?.addEventListener("click", () => {
		const name = inputNasabahName.value.trim();
		const tag = Number(inputNasabahTagihan.value) || 0;
		const status = getSelectedNasabahStatus();
		if (!name) return alert("Isi nama nasabah");
		addNasabahToGroup(currentGroupId, name, tag, status);
		// keep modal open and clear inputs for next
		inputNasabahName.value = "";
		inputNasabahTagihan.value = "";
		inputNasabahName.focus();
	});

	// clicking outside modal closes
	window.addEventListener("click", (ev) => {
		if (ev.target === modalGroup) closeModal(modalGroup);
		if (ev.target === modalNasabah) closeModal(modalNasabah);
	});
}

/* ===== OPEN / EDIT MODAL HELPERS ===== */
function openNewGroupModal() {
	modalGroupTitle.innerText = "Tambah Kelompok";
	inputGroupName.value = "";
	saveGroupBtn.removeAttribute("data-edit");
	openModal(modalGroup);
}

function openEditGroupModal(id) {
	const k = state.kelompok.find((x) => x.id === id);
	if (!k) return;
	modalGroupTitle.innerText = "Edit Kelompok";
	inputGroupName.value = k.nama;
	saveGroupBtn.setAttribute("data-edit", id);
	openModal(modalGroup);
}

function openAddNasabahModal() {
	if (!currentGroupId) return alert("Pilih kelompok terlebih dahulu");
	modalNasabah.querySelector("#modalNasabahTitle").innerText =
		"Tambah Nasabah - " + (state.kelompok.find((x) => x.id === currentGroupId)?.nama || "");
	inputNasabahName.value = "";
	inputNasabahTagihan.value = "";
	// default radio none
	const radios = modalNasabah.querySelectorAll('input[name="status"]');
	radios.forEach((r) => (r.checked = r.value === "none"));
	openModal(modalNasabah);
}

function clearNasabahModal() {
	inputNasabahName.value = "";
	inputNasabahTagihan.value = "";
	const radios = modalNasabah.querySelectorAll('input[name="status"]');
	radios.forEach((r) => (r.checked = r.value === "none"));
}

function getSelectedNasabahStatus() {
	const radios = modalNasabah.querySelectorAll('input[name="status"]');
	for (const r of radios) if (r.checked) return r.value;
	return "none";
}

/* ===== UTILITES ===== */
function escapeHtml(str) {
	if (typeof str !== "string") return str;
	return str.replace(
		/[&<>"']/g,
		(m) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;"
			})[m]
	);
}

function renderAll() {
	renderDashboard();
	renderGroups();
}

/* ===== BOOTSTRAP ===== */
async function init() {
	let auth = localStorage.getItem("auth");
	if (!auth) {
		localStorage.setItem("isSync", "0");
		// redirect to login
		window.location.href = "/login";
		return;
	}

	if (localStorage.getItem("isSync") !== "1") {
		try {
			showLoading();
			let dataKelompok = await getKelompok();
			let dataNasabah = await getNasabah();
			console.log("data kelompok:", dataKelompok);
			console.log("data nasabah:", dataNasabah);

			state = loadData(dataKelompok, dataNasabah);

			console.log(state);
		} catch (error) {
			hideLoading();
			errorAlert("Gagal sinkronisasi: " + error.message);
		} finally {
			localStorage.setItem("isSync", "1");
			hideLoading();
		}
		successAlert("sync berhasil");
	}

	state = loadLocal();

	if (!state.kelompok) state.kelompok = [];
	bindEvents();
	renderAll();
}

init();
