// User Visual Statistics & Diagrams Module (Chart.js)
window.UserStats = {
    pieChartInstance: null,
    barChartInstance: null,

    load: async function () {
        if (!TG.currentUser) return;
        try {
            const res = await fetch(`/api/user/${TG.currentUser.telegram_id}/stats`);
            if (!res.ok) throw new Error("Statistikani yuklab bo'lmadi");
            const data = await res.json();
            const stats = data.stats;

            // Metric cards
            document.getElementById("stat-total-attempts").textContent = stats.total_attempts;
            document.getElementById("stat-avg-percentage").textContent = `${stats.avg_percentage}%`;
            document.getElementById("stat-total-correct").textContent = stats.total_correct;
            document.getElementById("stat-highest-score").textContent = `${stats.highest_score}%`;

            this.renderCharts(stats.chart_data);
            this.renderHistory(stats.history);
        } catch (e) {
            console.error("Stats load error:", e);
        }
    },

    renderCharts: function (chartData) {
        if (typeof Chart === "undefined") return;

        // 1. Doughnut Chart: Correct vs Incorrect answers
        const pieCtx = document.getElementById("stats-pie-chart")?.getContext("2d");
        if (pieCtx) {
            if (this.pieChartInstance) {
                this.pieChartInstance.destroy();
            }

            const correct = chartData.pie.correct;
            const incorrect = chartData.pie.incorrect;
            const total = correct + incorrect;

            this.pieChartInstance = new Chart(pieCtx, {
                type: "doughnut",
                data: {
                    labels: ["To'g'ri javoblar", "Noto'g'ri javoblar"],
                    datasets: [{
                        data: total > 0 ? [correct, incorrect] : [1, 0],
                        backgroundColor: ["#10b981", "#ef4444"],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                color: "#cbd5e1",
                                font: { size: 12, weight: "bold" },
                                padding: 15
                            }
                        }
                    },
                    cutout: "70%"
                }
            });
        }

        // 2. Bar Chart: Progression across quizzes
        const barCtx = document.getElementById("stats-bar-chart")?.getContext("2d");
        if (barCtx) {
            if (this.barChartInstance) {
                this.barChartInstance.destroy();
            }

            const labels = chartData.labels.length > 0 ? chartData.labels : ["Hali test yo'q"];
            const scores = chartData.scores.length > 0 ? chartData.scores : [0];

            this.barChartInstance = new Chart(barCtx, {
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [{
                        label: "To'plangan ball (%)",
                        data: scores,
                        backgroundColor: "rgba(59, 130, 246, 0.7)",
                        borderColor: "#3b82f6",
                        borderWidth: 1,
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                color: "#94a3b8",
                                callback: val => `${val}%`
                            },
                            grid: { color: "rgba(255, 255, 255, 0.05)" }
                        },
                        x: {
                            ticks: { color: "#94a3b8", font: { size: 10 } },
                            grid: { display: false }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }
    },

    renderHistory: function (history) {
        const container = document.getElementById("stats-history-container");
        if (!container) return;

        container.innerHTML = "";
        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400 text-sm">
                    Siz hali birorta ham test yechmadingiz.<br>Bosh sahifaga o'tib testlarni boshlang!
                </div>
            `;
            return;
        }

        history.forEach(item => {
            const card = document.createElement("div");
            card.className = "p-4 rounded-xl border border-slate-700/60 bg-slate-800/40 flex items-center justify-between";
            const dateStr = new Date(item.created_at).toLocaleDateString("uz-UZ", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });

            const badgeColor = item.percentage >= 80 ? "text-emerald-400 bg-emerald-500/10" : (item.percentage >= 60 ? "text-blue-400 bg-blue-500/10" : "text-rose-400 bg-rose-500/10");

            card.innerHTML = `
                <div class="space-y-1">
                    <p class="font-semibold text-sm text-white line-clamp-1">${item.quiz_title}</p>
                    <div class="flex items-center space-x-2 text-xs text-slate-400">
                        <span class="px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 font-mono">${item.unique_code}</span>
                        <span>•</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold ${badgeColor}">
                        ${item.percentage}%
                    </span>
                    <p class="text-[11px] text-slate-400 mt-1">${item.score} / ${item.total_questions} to'g'ri</p>
                </div>
            `;
            container.appendChild(card);
        });
    }
};
