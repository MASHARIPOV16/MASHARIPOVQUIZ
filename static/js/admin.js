// Admin Panel Logic with Telegram ID & 4-digit PIN Security
window.AdminPanel = {
    cachedUsers: [],
    isUnlocked: false,
    currentPin: "",

    checkAccess: function () {
        return !!(TG.currentUser && TG.currentUser.is_admin);
    },

    openPinModal: function () {
        this.currentPin = "";
        this.updatePinDots();
        const err = document.getElementById("pin-error-msg");
        if (err) err.textContent = "";
        document.getElementById("modal-admin-pin")?.classList.remove("hidden");
    },

    closePinModal: function () {
        this.currentPin = "";
        document.getElementById("modal-admin-pin")?.classList.add("hidden");
    },

    pressKey: function (digit) {
        if (this.currentPin.length >= 4) return;
        TG.haptic("light");
        this.currentPin += digit.toString();
        this.updatePinDots();

        if (this.currentPin.length === 4) {
            this.verifyPin();
        }
    },

    deleteKey: function () {
        if (this.currentPin.length > 0) {
            TG.haptic("light");
            this.currentPin = this.currentPin.slice(0, -1);
            this.updatePinDots();
        }
    },

    clearKey: function () {
        TG.haptic("light");
        this.currentPin = "";
        this.updatePinDots();
    },

    updatePinDots: function () {
        for (let i = 1; i <= 4; i++) {
            const dot = document.getElementById(`pin-dot-${i}`);
            if (dot) {
                if (i <= this.currentPin.length) {
                    dot.className = "w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 scale-110 transition-all duration-150";
                } else {
                    dot.className = "w-4 h-4 rounded-full border-2 border-slate-600 bg-transparent transition-all duration-150";
                }
            }
        }
    },

    verifyPin: async function () {
        const errEl = document.getElementById("pin-error-msg");
        if (errEl) errEl.textContent = "Tekshirilmoqda...";

        try {
            const res = await fetch("/api/admin/verify-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin_id: TG.currentUser.telegram_id,
                    pin: this.currentPin
                })
            });

            if (res.ok) {
                TG.haptic("success");
                this.isUnlocked = true;
                // Green dots celebration
                for (let i = 1; i <= 4; i++) {
                    const dot = document.getElementById(`pin-dot-${i}`);
                    if (dot) dot.className = "w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50";
                }
                setTimeout(() => {
                    this.closePinModal();
                    App.showAdminView();
                }, 200);
            } else {
                TG.haptic("error");
                if (errEl) errEl.textContent = "❌ Noto'g'ri PIN kod!";
                for (let i = 1; i <= 4; i++) {
                    const dot = document.getElementById(`pin-dot-${i}`);
                    if (dot) dot.className = "w-4 h-4 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50 animate-pulse";
                }
                setTimeout(() => {
                    this.currentPin = "";
                    this.updatePinDots();
                    if (errEl) errEl.textContent = "";
                }, 700);
            }
        } catch (e) {
            console.error("PIN verify error:", e);
            if (errEl) errEl.textContent = "Tarmoq xatoligi!";
        }
    },

    lockAdmin: function () {
        this.isUnlocked = false;
        this.currentPin = "";
        TG.haptic("medium");
        App.switchTab("home");
        alert("🔒 Admin Panel qulflandi");
    },

    init: async function () {
        if (!this.checkAccess()) {
            console.log("Admin huquqlari mavjud emas.");
            return;
        }

        await this.loadStats();
        await this.loadUsers();
    },

    loadStats: async function () {
        try {
            const adminId = TG.currentUser.telegram_id;
            const res = await fetch(`/api/admin/stats?admin_id=${adminId}`);
            if (!res.ok) throw new Error("Admin statistikasini yuklab bo'lmadi");

            const data = await res.json();
            const s = data.stats;

            document.getElementById("adm-total-users").textContent = s.total_users;
            document.getElementById("adm-users-today").textContent = `+${s.users_today} bugun`;
            document.getElementById("adm-total-quizzes").textContent = s.total_quizzes;
            document.getElementById("adm-total-attempts").textContent = s.total_attempts;

            this.renderLeaderboard(s.leaderboard);
            this.renderTopFaculties(s.top_faculties);
        } catch (e) {
            console.error("Admin stats error:", e);
        }
    },

    loadUsers: async function (search = "") {
        try {
            const adminId = TG.currentUser.telegram_id;
            const res = await fetch(`/api/admin/users?admin_id=${adminId}&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error("Foydalanuvchilarni yuklab bo'lmadi");

            const data = await res.json();
            this.cachedUsers = data.users;
            this.renderUsersList(this.cachedUsers);
        } catch (e) {
            console.error("Admin users error:", e);
        }
    },

    renderUsersList: function (users) {
        const container = document.getElementById("adm-users-list");
        if (!container) return;
        container.innerHTML = "";

        if (!users || users.length === 0) {
            container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">Foydalanuvchilar topilmadi</div>`;
            return;
        }

        users.forEach(u => {
            const card = document.createElement("div");
            card.className = "p-4 rounded-2xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 transition flex flex-col space-y-2.5 shadow-sm";

            const fullName = `${u.first_name} ${u.last_name || ""}`.trim();
            const usernameHtml = u.username 
                ? `<a href="https://t.me/${u.username}" target="_blank" class="text-blue-400 hover:underline flex items-center gap-1 font-mono text-xs font-semibold">@${u.username} ↗</a>`
                : `<span class="text-slate-500 text-xs italic">Username yo'q (ID: ${u.telegram_id})</span>`;

            const facultyCode = u.subscribed_code 
                ? `<span class="px-2.5 py-0.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono font-bold">${u.subscribed_code}</span>`
                : `<span class="text-slate-600 text-xs">Kodi yo'q</span>`;

            const joinedDate = new Date(u.created_at).toLocaleDateString("uz-UZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

            card.innerHTML = `
                <div class="flex items-start justify-between">
                    <div>
                        <div class="flex items-center space-x-2.5">
                            <span class="w-9 h-9 rounded-2xl bg-blue-600/20 text-blue-400 font-black flex items-center justify-center text-sm border border-blue-500/30">
                                ${(u.first_name || "U")[0].toUpperCase()}
                            </span>
                            <div>
                                <h4 class="font-bold text-sm text-white">${fullName} ${u.is_admin ? '<span class="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full ml-1 border border-amber-500/30 font-bold">Admin</span>' : ''}</h4>
                                ${usernameHtml}
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        ${facultyCode}
                        <p class="text-[10px] text-slate-500 mt-1">${joinedDate}</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                    <div>
                        <span class="text-slate-400">Yechgan testlari:</span> <b class="text-white">${u.attempts_count || 0} ta</b>
                    </div>
                    <div>
                        <span class="text-slate-400">Yaratgan testlari:</span> <b class="text-white">${u.created_quizzes_count || 0} ta</b>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    },

    renderLeaderboard: function (leaderboard) {
        const container = document.getElementById("adm-leaderboard-list");
        if (!container) return;
        container.innerHTML = "";

        if (!leaderboard || leaderboard.length === 0) {
            container.innerHTML = `<p class="text-xs text-slate-400">Hali natijalar mavjud emas</p>`;
            return;
        }

        leaderboard.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs";

            let medal = `#${index + 1}`;
            if (index === 0) medal = "🥇";
            else if (index === 1) medal = "🥈";
            else if (index === 2) medal = "🥉";

            const name = `${item.first_name} ${item.last_name || ""}`.trim();
            const username = item.username ? `@${item.username}` : `ID: ${item.telegram_id}`;

            row.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="font-extrabold text-base w-6 text-center text-amber-400">${medal}</span>
                    <div>
                        <p class="font-bold text-white">${name}</p>
                        <p class="text-[11px] text-slate-400 font-mono">${username}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="font-extrabold text-emerald-400">${item.total_points} ball</span>
                    <p class="text-[10px] text-slate-400">O'rtacha: ${item.avg_score}%</p>
                </div>
            `;
            container.appendChild(row);
        });
    },

    renderTopFaculties: function (topFaculties) {
        const container = document.getElementById("adm-top-faculties");
        if (!container) return;
        container.innerHTML = "";

        if (!topFaculties || topFaculties.length === 0) {
            container.innerHTML = `<p class="text-xs text-slate-400">Ma'lumot yo'q</p>`;
            return;
        }

        topFaculties.forEach(f => {
            const badge = document.createElement("div");
            badge.className = "flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs";
            badge.innerHTML = `
                <span class="font-semibold text-slate-200">${f.university || ''} - ${f.faculty || ''}</span>
                <span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">${f.count} talaba</span>
            `;
            container.appendChild(badge);
        });
    },

    openBroadcastModal: function () {
        document.getElementById("modal-broadcast")?.classList.remove("hidden");
    },

    closeBroadcastModal: function () {
        document.getElementById("modal-broadcast")?.classList.add("hidden");
    },

    sendBroadcast: async function () {
        const text = document.getElementById("broadcast-message-input").value.trim();
        if (!text) {
            alert("Iltimos, xabar matnini kiriting!");
            return;
        }

        const btn = document.getElementById("broadcast-send-btn");
        btn.disabled = true;
        btn.textContent = "Yuborilmoqda...";

        try {
            const res = await fetch("/api/admin/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin_id: TG.currentUser.telegram_id,
                    message: text
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`✅ Xabar yuborildi!\nYetib bordi: ${data.result.sent} ta\nXatolik: ${data.result.failed} ta`);
                document.getElementById("broadcast-message-input").value = "";
                this.closeBroadcastModal();
            } else {
                alert(`Xatolik: ${data.detail || "Xabar yuborilmadi"}`);
            }
        } catch (e) {
            console.error(e);
            alert("Xabarni tarqatishda xatolik yuz berdi");
        } finally {
            btn.disabled = false;
            btn.textContent = "Yuborish 🚀";
        }
    }
};
