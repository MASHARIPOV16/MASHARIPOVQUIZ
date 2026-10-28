// Main App Controller with JSON Upload and 25-Question Part Support
window.App = {
    currentTab: "home",
    userProfile: null,
    quizzesList: [],
    uploadedJsonQuestions: null,

    init: async function () {
        TG.init();
        await this.syncUser();
        this.setupEventListeners();

        // Check URL params
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get("tab");
        const quizParam = urlParams.get("quiz");

        if (quizParam) {
            QuizPlayer.openPartsModal(quizParam);
        } else if (tabParam && ["home", "create", "stats", "myquizzes", "admin"].includes(tabParam)) {
            this.switchTab(tabParam);
        } else {
            this.switchTab("home");
        }
    },

    syncUser: async function () {
        try {
            const res = await fetch("/api/user/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(TG.currentUser)
            });
            const data = await res.json();
            if (data.status === "ok") {
                this.userProfile = data.user;
                TG.currentUser.is_admin = !!this.userProfile.is_admin;
                this.renderUserProfile();
                
                // Show or strictly hide Admin Navigation tab
                const adminNavBtn = document.getElementById("nav-admin");
                if (TG.currentUser.is_admin) {
                    adminNavBtn?.classList.remove("hidden");
                } else {
                    adminNavBtn?.classList.add("hidden");
                }
            }
        } catch (e) {
            console.error("User sync error:", e);
        }
    },

    renderUserProfile: function () {
        if (!this.userProfile) return;

        const nameEl = document.getElementById("header-user-name");
        if (nameEl) nameEl.textContent = `${this.userProfile.first_name} ${this.userProfile.last_name || ""}`.trim();

        const userTagEl = document.getElementById("header-username-tag");
        if (userTagEl) {
            userTagEl.textContent = this.userProfile.username ? `@${this.userProfile.username}` : `ID: ${this.userProfile.telegram_id}`;
        }

        const codeBadge = document.getElementById("user-subscribed-badge");
        const codePrompt = document.getElementById("user-no-code-prompt");

        if (this.userProfile.subscribed_code) {
            codeBadge?.classList.remove("hidden");
            codePrompt?.classList.add("hidden");
            const label = document.getElementById("subscribed-code-label");
            if (label) label.textContent = this.userProfile.subscribed_code;

            const facultyDetail = document.getElementById("subscribed-faculty-detail");
            if (facultyDetail) {
                const parts = [this.userProfile.university, this.userProfile.faculty, this.userProfile.course].filter(Boolean);
                facultyDetail.textContent = parts.join(" • ") || "Oqimga a'zo";
            }
        } else {
            codeBadge?.classList.add("hidden");
            codePrompt?.classList.remove("hidden");
        }
    },

    switchTab: function (tabName) {
        TG.haptic("light");

        // Admin Security Check
        if (tabName === "admin") {
            if (!TG.currentUser || !TG.currentUser.is_admin) {
                alert("⛔ Sizda admin huquqlari mavjud emas!");
                return;
            }
            if (!AdminPanel.isUnlocked) {
                AdminPanel.openPinModal();
                return;
            }
        }

        this.currentTab = tabName;

        document.querySelectorAll(".tab-view").forEach(el => el.classList.add("hidden"));
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.classList.remove("text-blue-500", "font-bold");
            btn.classList.add("text-slate-400");
        });

        const activeNavBtn = document.getElementById(`nav-${tabName}`);
        if (activeNavBtn) {
            activeNavBtn.classList.remove("text-slate-400");
            activeNavBtn.classList.add("text-blue-500", "font-bold");
        }

        const targetView = document.getElementById(`view-${tabName}`);
        if (targetView) targetView.classList.remove("hidden");

        if (tabName === "home") {
            this.loadQuizzes();
        } else if (tabName === "stats") {
            UserStats.load();
        } else if (tabName === "myquizzes") {
            this.loadMyCreatedQuizzes();
        } else if (tabName === "admin") {
            AdminPanel.init();
        }
    },

    showAdminView: function () {
        this.currentTab = "admin";
        document.querySelectorAll(".tab-view").forEach(el => el.classList.add("hidden"));
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.classList.remove("text-blue-500", "font-bold");
            btn.classList.add("text-slate-400");
        });

        const activeNavBtn = document.getElementById("nav-admin");
        if (activeNavBtn) {
            activeNavBtn.classList.remove("text-slate-400");
            activeNavBtn.classList.add("text-blue-500", "font-bold");
        }

        const targetView = document.getElementById("view-admin");
        if (targetView) targetView.classList.remove("hidden");
        AdminPanel.init();
    },

    loadQuizzes: async function () {
        try {
            const code = this.userProfile?.subscribed_code || "";
            const res = await fetch(`/api/quizzes?subscribed_code=${encodeURIComponent(code)}`);
            const data = await res.json();
            this.quizzesList = data.quizzes || [];
            this.renderQuizzesList(this.quizzesList);
        } catch (e) {
            console.error("Load quizzes error:", e);
        }
    },

    renderQuizzesList: function (quizzes) {
        const container = document.getElementById("quizzes-list-container");
        if (!container) return;
        container.innerHTML = "";

        if (!quizzes || quizzes.length === 0) {
            container.innerHTML = `
                <div class="text-center py-10 text-slate-400">
                    <p class="text-lg">📭 Hozircha testlar mavjud emas</p>
                    <p class="text-xs mt-1">Yangi test yuklash uchun pastdagi "+" tugmasini bosing</p>
                </div>
            `;
            return;
        }

        quizzes.forEach(q => {
            const isMyFaculty = this.userProfile?.subscribed_code && q.unique_code.toUpperCase() === this.userProfile.subscribed_code.toUpperCase();
            const card = document.createElement("div");
            card.className = `p-5 rounded-3xl border transition-all shadow-xl ${
                isMyFaculty 
                    ? 'border-blue-500/50 bg-gradient-to-br from-blue-950/60 via-slate-900 to-indigo-950/40 shadow-blue-950/30' 
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
            } flex flex-col justify-between space-y-3.5`;

            const facultySubtitle = [q.university, q.faculty, q.course].filter(Boolean).join(" • ");
            const emojiIcon = q.title.toLowerCase().includes("matematik") ? "📐" : (q.title.toLowerCase().includes("ingliz") ? "🌐" : "🧠");

            card.innerHTML = `
                <div class="space-y-2.5">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm border border-blue-500/30">
                                ${emojiIcon}
                            </span>
                            <span class="px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold ${
                                isMyFaculty ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }">
                                ${q.unique_code}
                            </span>
                        </div>
                        ${isMyFaculty ? '<span class="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-extrabold border border-blue-500/30 flex items-center gap-1"><span>🎯</span><span>Sizning oqimingiz</span></span>' : ''}
                    </div>

                    <div>
                        <h3 class="font-extrabold text-base text-white tracking-tight leading-snug">${q.title}</h3>
                        <p class="text-xs text-slate-400 mt-0.5 font-medium">${q.description || facultySubtitle || "Maxsus test bazasi"}</p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2.5 text-xs text-slate-300 pt-1">
                        <span class="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 font-semibold text-blue-300">
                            <span>📦</span>
                            <span>${q.parts_count || 1} ta bo'lim (25 tadan)</span>
                        </span>
                        <span class="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 font-medium text-slate-300">
                            <span>❓</span>
                            <span>${q.questions_count || 0} ta savol</span>
                        </span>
                    </div>
                </div>

                <div class="pt-3 flex items-center justify-between border-t border-slate-800">
                    <span class="text-xs text-slate-400 truncate max-w-[150px] flex items-center gap-1">
                        <span>👤</span>
                        <span>Muallif: <b class="text-slate-200">${q.creator_name || "O'qituvchi"}</b></span>
                    </span>
                    <button class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs transition active:scale-95 shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                            onclick="QuizPlayer.openPartsModal('${q.unique_code}')">
                        <span>Bo'limlarni ochish</span>
                        <span>🚀</span>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    },

    // ----------------- JSON File Upload Handler -----------------

    handleJsonFileSelect: function (fileInput) {
        const file = fileInput.files[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".json")) {
            alert("Iltimos, faqat .json formatidagi faylni tanlang!");
            fileInput.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) {
                    alert("JSON fayl massiv (array) ko'rinishida bo'lishi kerak: [ {...}, {...} ]");
                    return;
                }

                this.uploadedJsonQuestions = data;
                const total = data.length;
                const parts = Math.ceil(total / 25);

                // Show success info box
                const infoBox = document.getElementById("json-file-info");
                infoBox.classList.remove("hidden");
                document.getElementById("json-file-name").textContent = file.name;
                document.getElementById("json-file-stats").textContent = `${total} ta savol aniqlandi • ${parts} ta 25 talik bo'limga ajratiladi`;

                // Prefill title if empty
                const titleInput = document.getElementById("create-title");
                if (!titleInput.value) {
                    titleInput.value = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                }
                TG.haptic("success");
            } catch (err) {
                console.error("JSON parse error:", err);
                alert("JSON faylni o'qishda xatolik yuz berdi. Fayl sintaksisini tekshiring.");
            }
        };
        reader.readAsText(file, "UTF-8");
    },

    submitCreateQuiz: async function () {
        const title = document.getElementById("create-title").value.trim();
        const description = document.getElementById("create-desc").value.trim();
        const university = document.getElementById("create-university").value.trim() || "Universitet";
        const faculty = document.getElementById("create-faculty").value.trim() || "Fakultet";
        const direction = document.getElementById("create-direction").value.trim() || "Yo'nalish";
        const course = document.getElementById("create-course").value || "1-kurs";
        const unique_code = document.getElementById("create-unique-code").value.trim().toUpperCase();
        const time_limit = parseInt(document.getElementById("create-time-limit").value) || 30;

        if (!title) return alert("Iltimos, quiz nomini kiriting!");
        if (!unique_code) return alert("Iltimos, unikal kodni kiriting!");

        if (!this.uploadedJsonQuestions || this.uploadedJsonQuestions.length === 0) {
            return alert("Iltimos, avval .json formatidagi savollar faylini yuklang!");
        }

        const btn = document.getElementById("create-submit-btn");
        btn.disabled = true;
        btn.textContent = "Saqlanmoqda va 25 talik qismlarga ajratilmoqda...";

        try {
            const payload = {
                creator_id: TG.currentUser.telegram_id,
                unique_code,
                title,
                description,
                university,
                faculty,
                direction,
                course,
                time_limit,
                raw_questions: this.uploadedJsonQuestions
            };

            const res = await fetch("/api/quiz/import-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                alert(`Xatolik: ${data.detail || "Quiz saqlanmadi"}`);
                return;
            }

            TG.haptic("success");
            alert(`🎉 Quiz muvaffaqiyatli saqlandi!\n\n📝 Jami savollar: ${data.quiz.questions_count} ta\n📦 Bo'limlar: ${data.quiz.total_parts} ta 25 talik qism\n🔑 Unikal kod: ${unique_code}`);
            
            // Reset
            this.uploadedJsonQuestions = null;
            document.getElementById("json-file-input").value = "";
            document.getElementById("json-file-info").classList.add("hidden");
            this.switchTab("home");
        } catch (e) {
            console.error(e);
            alert("Quizni saqlashda xatolik yuz berdi");
        } finally {
            btn.disabled = false;
            btn.textContent = "Quizni saqlash va 25 talik bo'limlarga ajratish 🚀";
        }
    },

    generateRandomCode: function () {
        const uni = document.getElementById("create-university")?.value.trim().toUpperCase().replace(/\s+/g, "") || "QUIZ";
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const codeInput = document.getElementById("create-unique-code");
        if (codeInput) {
            codeInput.value = `${uni.slice(0, 4)}-${randomNum}`;
        }
    },

    // ----------------- Subscription Modal -----------------

    openSubscriptionModal: function () {
        TG.haptic("medium");
        if (this.userProfile) {
            document.getElementById("sub-university").value = this.userProfile.university || "";
            document.getElementById("sub-faculty").value = this.userProfile.faculty || "";
            document.getElementById("sub-direction").value = this.userProfile.direction || "";
            document.getElementById("sub-course").value = this.userProfile.course || "1-kurs";
            document.getElementById("sub-code").value = this.userProfile.subscribed_code || "";
        }
        document.getElementById("modal-subscription").classList.remove("hidden");
    },

    closeSubscriptionModal: function () {
        document.getElementById("modal-subscription").classList.add("hidden");
    },

    saveSubscription: async function () {
        const university = document.getElementById("sub-university").value.trim();
        const faculty = document.getElementById("sub-faculty").value.trim();
        const direction = document.getElementById("sub-direction").value.trim();
        const course = document.getElementById("sub-course").value;
        const code = document.getElementById("sub-code").value.trim().toUpperCase();

        if (!code) {
            alert("Iltimos, unikal oqim kodini kiriting (masalan: TATU-DIF-23)!");
            return;
        }

        try {
            const res = await fetch("/api/user/subscription", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    telegram_id: TG.currentUser.telegram_id,
                    university,
                    faculty,
                    direction,
                    course,
                    subscribed_code: code
                })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.detail || "Saqlashda xatolik");
                return;
            }

            const data = await res.json();
            this.userProfile = data.user;
            this.renderUserProfile();
            this.closeSubscriptionModal();
            TG.haptic("success");
            this.loadQuizzes();
        } catch (e) {
            console.error("Save subscription error:", e);
            alert("Xatolik yuz berdi");
        }
    },

    // ----------------- My Created Quizzes -----------------

    loadMyCreatedQuizzes: async function () {
        try {
            const res = await fetch(`/api/user/${TG.currentUser.telegram_id}/created-quizzes`);
            const data = await res.json();
            const quizzes = data.created_quizzes || [];

            const container = document.getElementById("myquizzes-list-container");
            if (!container) return;
            container.innerHTML = "";

            if (quizzes.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-10 text-slate-400">
                        <p class="text-base">Siz hali birorta ham quiz yuklamadingiz.</p>
                        <button class="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs"
                                onclick="App.switchTab('create')">
                            + .json fayl yuklash
                        </button>
                    </div>
                `;
                return;
            }

            quizzes.forEach(q => {
                const card = document.createElement("div");
                card.className = "p-4 rounded-xl border border-slate-700 bg-slate-800/50 space-y-3";

                const facultySubtitle = [q.university, q.faculty, q.course].filter(Boolean).join(" • ");

                card.innerHTML = `
                    <div class="flex items-start justify-between">
                        <div>
                            <span class="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 font-mono font-bold text-xs border border-blue-500/30">${q.unique_code}</span>
                            <h3 class="font-bold text-sm text-white mt-1.5">${q.title}</h3>
                            <p class="text-[11px] text-slate-400 mt-0.5">${facultySubtitle || "Maxsus test"}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 text-xs text-slate-300 pt-1 border-t border-slate-700/40">
                        <span class="flex items-center gap-1 font-semibold text-blue-400">📦 ${q.parts_count || 1} ta 25 talik bo'lim</span>
                        <span class="text-slate-500">•</span>
                        <span>❓ ${q.questions_count || 0} ta savol</span>
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <button class="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs transition flex items-center justify-center gap-1.5"
                                onclick="TG.shareResult('🎓 Mana mening testim kodi: ${q.unique_code}\\nMini App-da kodni kiritib testni yeching!')">
                            ✈️ Ulashish
                        </button>
                        <button class="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                                onclick="QuizPlayer.openPartsModal('${q.unique_code}')">
                            Testni ko'rish 🚀
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            console.error("Load my quizzes error:", e);
        }
    },

    setupEventListeners: function () {
        document.getElementById("btn-quick-join")?.addEventListener("click", () => {
            const code = document.getElementById("input-quick-code")?.value.trim().toUpperCase();
            if (code) {
                QuizPlayer.openPartsModal(code);
            } else {
                alert("Iltimos, unikal test kodini kiriting!");
            }
        });

        document.getElementById("search-quizzes-input")?.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = this.quizzesList.filter(q => 
                q.title.toLowerCase().includes(term) || 
                q.unique_code.toLowerCase().includes(term) ||
                (q.description && q.description.toLowerCase().includes(term))
            );
            this.renderQuizzesList(filtered);
        });

        this.generateRandomCode();
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.App.init();
});
