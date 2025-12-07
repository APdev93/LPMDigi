const loginBtn = document.getElementById("btnLogin");

function showError(msg) {
    alert(msg);
}

function showLoading() {
    document.getElementById("loadingIndicator").style.display = "flex";
}

function hideLoading() {
    document.getElementById("loadingIndicator").style.display = "none";
}

async function loginUser() {
    const username = document.getElementById("inputUserName").value.trim();
    const password = document.getElementById("inputPassword").value.trim();

    if (!username) return showError("Username wajib diisi");
    if (!password) return showError("Password wajib diisi");

    showLoading();

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) return showError("Login gagal");

        const data = await res.json();
        console.log(data);
        if (!data.responseStatus) return showError(data.message);

        if (!data.token) return showError("Token tidak ditemukan");

        localStorage.setItem("auth", data.token);
        localStorage.setItem("tokenExpired", data.tokenexpired);
        localStorage.setItem("username", username);
        localStorage.setItem("name", data.data.nama);
        localStorage.setItem("cabangID", data.data.unitKerja);
        localStorage.setItem("unit", data.data.branchName);

        window.location.href = "/";
    } catch (e) {
        showError("Terjadi kesalahan jaringan");
    } finally {
        hideLoading();
    }
}

loginBtn.addEventListener("click", loginUser);
