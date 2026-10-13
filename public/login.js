const loginBtn = document.getElementById("btnLogin");
const togglePassword = document.getElementById("togglePassword");
const inputPassword = document.getElementById("inputPassword");

// Hindari menjalankan script jika elemen login tidak tersedia.
if (togglePassword && inputPassword) {
    togglePassword.addEventListener("click", () => {
        const type = inputPassword.type === "password" ? "text" : "password";
        inputPassword.type = type;
        togglePassword.innerHTML = `<i data-feather="${type === "password" ? "eye" : "eye-off"}"></i>`;
        feather.replace();
    });
}

function showError(msg) {
    Swal.fire({
        title: "Login Gagal!",
        text: msg,
        icon: "error",
        confirmButtonText: "Mengerti",
        customClass: { popup: "swal-err-popup", confirmButton: "swal-err-btn" }
    });
}

function showLoading() {
    document.getElementById("loadingIndicator").style.display = "flex";
}

function hideLoading() {
    document.getElementById("loadingIndicator").style.display = "none";
}

async function askActivationToken(username) {
    const result = await Swal.fire({
        title: "Aktivasi akun",
        text: "Akun ini belum aktif. Silahkan melakukan pembayaran bulanan untuk mendapatkan token.",
        input: "text",
        inputPlaceholder: "Masukkan token aktivasi",

        customClass: {
            popup: "activation-popup",
            input: "activation-input"
        },

        showCancelButton: true,
        confirmButtonText: "Aktifkan",
        cancelButtonText: "Nanti",

        inputValidator: value =>
            !value?.trim() ? "Token wajib diisi" : undefined
    });

    if (!result.isConfirmed) return false;

    const response = await fetch("/activation/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, token: result.value.trim() })
    });
    const data = await response.json();

    if (!response.ok || !data.status) {
        await Swal.fire({
            title: "Aktivasi gagal",
            text: data.message || "Token tidak valid",
            icon: "error"
        });
        return false;
    }

    await Swal.fire({
        title: "Aktivasi berhasil",
        text: `Masa aktif sampai ${new Date(data.expiresAt).toLocaleString("id-ID")}`,
        icon: "success"
    });
    return data.licenseSession || false;
}

async function loginUser() {
    const username = document
        .getElementById("inputUserName")
        .value.trim()
        .toLowerCase();
    const password = document.getElementById("inputPassword").value;

    if (!username) return showError("Username wajib diisi");
    if (!password) return showError("Password wajib diisi");

    showLoading();
    loginBtn.disabled = true;

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok || !data.responseStatus) {
            return showError(data.message || "Login gagal");
        }
        if (!data.token || !data.data) {
            return showError("Data login dari server tidak lengkap");
        }

        let licenseSession = data.licenseSession;
        if (data.activationRequired || !data.license?.isActive) {
            hideLoading();
            licenseSession = await askActivationToken(username);
            if (!licenseSession) return;
        }
        if (!licenseSession)
            return showError(
                "Sesi tidak ditemukan. Silakan minta kode aktivasi ke admin."
            );

        // Simpan sesi aplikasi hanya setelah login eksternal dan aktivasi lokal lolos.
        localStorage.setItem("licenseSession", licenseSession);
        localStorage.setItem("auth", data.token);
        localStorage.setItem("tokenExpired", data.tokenexpired || "");
        localStorage.setItem("username", username);
        localStorage.setItem("name", data.data.nama || "");
        localStorage.setItem("cabangID", data.data.unitKerja || "");
        localStorage.setItem("unit", data.data.branchName || "");
        window.location.href = "/";
    } catch (error) {
        showError("Terjadi kesalahan jaringan");
    } finally {
        hideLoading();
        loginBtn.disabled = false;
    }
}

loginBtn.addEventListener("click", loginUser);
