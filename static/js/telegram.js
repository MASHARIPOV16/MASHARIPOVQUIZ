// Telegram Mini App SDK Helper
window.TG = {
    webapp: window.Telegram?.WebApp || null,
    isExpanded: false,
    currentUser: null,

    init: function () {
        if (this.webapp && this.webapp.initDataUnsafe?.user) {
            this.webapp.ready();
            this.webapp.expand();
            this.isExpanded = true;
            this.currentUser = {
                telegram_id: this.webapp.initDataUnsafe.user.id,
                first_name: this.webapp.initDataUnsafe.user.first_name || "Foydalanuvchi",
                last_name: this.webapp.initDataUnsafe.user.last_name || "",
                username: this.webapp.initDataUnsafe.user.username || "",
                is_admin: false
            };
            this.applyTelegramTheme();
        } else {
            // Mock user for testing in regular browsers
            console.log("Telegram WebApp topilmadi. Standalone/Test rejimida ishga tushdi.");
            const savedUser = localStorage.getItem("mock_user");
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
            } else {
                this.currentUser = {
                    telegram_id: 1001,
                    first_name: "Alisher",
                    last_name: "Navoiy",
                    username: "alisher_dev",
                    is_admin: false
                };
                localStorage.setItem("mock_user", JSON.stringify(this.currentUser));
            }
            this.showDevBanner();
        }
    },

    setMockRole: function (isAdmin) {
        if (isAdmin) {
            this.currentUser = {
                telegram_id: 999999, // default sample admin id
                first_name: "Admin",
                last_name: "Boshqaruvchi",
                username: "super_admin",
                is_admin: true
            };
        } else {
            this.currentUser = {
                telegram_id: 1001,
                first_name: "Alisher",
                last_name: "Navoiy",
                username: "alisher_dev",
                is_admin: false
            };
        }
        localStorage.setItem("mock_user", JSON.stringify(this.currentUser));
        window.location.reload();
    },

    showDevBanner: function () {
        const devBar = document.getElementById("dev-banner");
        if (devBar) {
            devBar.classList.remove("hidden");
            const roleLabel = document.getElementById("dev-role-label");
            if (roleLabel) {
                roleLabel.textContent = this.currentUser.is_admin ? "🛡 Admin" : "👤 Talaba";
            }
        }
    },

    applyTelegramTheme: function () {
        if (!this.webapp) return;
        const theme = this.webapp.themeParams;
        if (theme) {
            if (theme.bg_color) document.documentElement.style.setProperty("--tg-theme-bg-color", theme.bg_color);
            if (theme.text_color) document.documentElement.style.setProperty("--tg-theme-text-color", theme.text_color);
            if (theme.button_color) document.documentElement.style.setProperty("--tg-theme-button-color", theme.button_color);
            if (theme.button_text_color) document.documentElement.style.setProperty("--tg-theme-button-text-color", theme.button_text_color);
            if (theme.secondary_bg_color) document.documentElement.style.setProperty("--tg-theme-secondary-bg-color", theme.secondary_bg_color);
        }
    },

    haptic: function (type) {
        try {
            if (this.webapp?.HapticFeedback) {
                if (type === "success" || type === "error" || type === "warning") {
                    this.webapp.HapticFeedback.notificationOccurred(type);
                } else if (type === "light" || type === "medium" || type === "heavy") {
                    this.webapp.HapticFeedback.impactOccurred(type);
                } else {
                    this.webapp.HapticFeedback.selectionChanged();
                }
            }
        } catch (e) {
            // ignore haptic error
        }
    },

    shareResult: function (text) {
        const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`;
        if (this.webapp?.openTelegramLink) {
            this.webapp.openTelegramLink(url);
        } else {
            window.open(url, "_blank");
        }
    }
};
