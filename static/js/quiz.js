// Quiz Gameplay Engine with 25-Question Partitioning & Progressive Scroll
window.QuizPlayer = {
    currentQuizCode: "",
    currentPartNum: 1,
    totalParts: 1,
    quizId: 0,
    questions: [],
    currentIndex: 0,
    userAnswers: {},
    timeSpent: 0,
    timerInterval: null,
    isSubmitting: false,

    // Step 1: Open 25-question parts selector modal/view
    openPartsModal: async function (uniqueCode) {
        TG.haptic("medium");
        this.currentQuizCode = uniqueCode;

        try {
            const userId = TG.currentUser?.telegram_id || 0;
            const res = await fetch(`/api/quiz/${encodeURIComponent(uniqueCode)}/parts?user_id=${userId}`);
            if (!res.ok) {
                const err = await res.json();
                alert(err.detail || "Quizni yuklab bo'lmadi");
                return;
            }

            const data = await res.json();
            const quiz = data.quiz;
            this.quizId = quiz.id;
            this.totalParts = quiz.total_parts;

            // Fill parts modal
            document.getElementById("parts-modal-title").textContent = quiz.title;
            document.getElementById("parts-modal-code").textContent = quiz.unique_code;
            document.getElementById("parts-modal-stats").textContent = `Jami ${quiz.total_questions} ta savol • ${quiz.total_parts} ta 25 talik bo'lim`;

            const container = document.getElementById("parts-list-container");
            container.innerHTML = "";

            quiz.parts.forEach(part => {
                const card = document.createElement("div");
                card.className = "p-4 rounded-3xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 transition flex items-center justify-between shadow-lg";

                const statusBadge = part.is_completed 
                    ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1"><span>✓</span><span>Natija: ${part.best_score}/${part.questions_count} (${part.best_percentage}%)</span></span>`
                    : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-400 bg-slate-800/80">⚡ Hali topshirilmagan</span>`;

                card.innerHTML = `
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-extrabold flex items-center justify-center text-xs border border-blue-500/30 shadow-sm">
                                ${part.part_num}
                            </span>
                            <h4 class="font-extrabold text-sm text-white">${part.title}</h4>
                        </div>
                        <p class="text-xs text-slate-400 pl-10 font-medium">${part.range_text}</p>
                        <div class="pl-10 pt-1">${statusBadge}</div>
                    </div>
                    <button class="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs transition active:scale-95 shadow-md shadow-blue-600/30 flex items-center gap-1"
                            onclick="QuizPlayer.startPart('${uniqueCode}', ${part.part_num})">
                        <span>Boshlash</span>
                        <span>🚀</span>
                    </button>
                `;
                container.appendChild(card);
            });

            document.getElementById("modal-quiz-parts").classList.remove("hidden");
        } catch (e) {
            console.error("Open parts error:", e);
            alert("Bo'limlarni yuklashda xatolik");
        }
    },

    closePartsModal: function () {
        document.getElementById("modal-quiz-parts").classList.add("hidden");
    },

    // Step 2: Start solving a 25-question part in continuous scroll mode
    startPart: async function (uniqueCode, partNum) {
        this.closePartsModal();
        TG.haptic("medium");

        try {
            const res = await fetch(`/api/quiz/${encodeURIComponent(uniqueCode)}/play?part=${partNum}`);
            if (!res.ok) {
                const err = await res.json();
                alert(err.detail || "Savollarni yuklab bo'lmadi");
                return;
            }

            const resData = await res.json();
            const partData = resData.data;

            this.currentQuizCode = uniqueCode;
            this.currentPartNum = partNum;
            this.quizId = partData.quiz_id;
            this.questions = partData.questions;
            this.currentIndex = 0;
            this.userAnswers = {};
            this.timeSpent = 0;
            this.isSubmitting = false;

            if (!this.questions || this.questions.length === 0) {
                alert("Ushbu bo'limda savollar mavjud emas");
                return;
            }

            // Switch to Scroll View
            document.getElementById("main-app-container").classList.add("hidden");
            document.getElementById("quiz-scroll-container").classList.remove("hidden");

            // Header info
            document.getElementById("scroll-quiz-title").textContent = partData.title;
            document.getElementById("scroll-quiz-part").textContent = `${partData.part_num}-qism (${this.questions.length} ta savol)`;

            // Clear feed container
            const feed = document.getElementById("scroll-feed-container");
            feed.innerHTML = "";

            // Start timer
            clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => {
                this.timeSpent++;
                const mins = Math.floor(this.timeSpent / 60);
                const secs = this.timeSpent % 60;
                document.getElementById("scroll-timer-text").textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }, 1000);

            // Render first question
            this.renderQuestionCard(0);
        } catch (e) {
            console.error("Start part error:", e);
            alert("Savollarni yuklashda xatolik yuz berdi");
        }
    },

    // Render a single question card and append to the vertical feed
    renderQuestionCard: function (index) {
        if (index >= this.questions.length) return;

        const q = this.questions[index];
        const feed = document.getElementById("scroll-feed-container");

        // Update top progress
        const answeredCount = Object.keys(this.userAnswers).length;
        const totalCount = this.questions.length;
        document.getElementById("scroll-progress-text").textContent = `${answeredCount} / ${totalCount} yechildi`;
        const pct = (answeredCount / totalCount) * 100;
        document.getElementById("scroll-progress-bar").style.width = `${pct}%`;

        // Card container with smooth animation
        const card = document.createElement("div");
        card.id = `q-card-${index}`;
        card.className = "p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 transition-all duration-300 opacity-0 translate-y-3";

        // Card header
        const cardHeader = document.createElement("div");
        cardHeader.className = "flex items-center justify-between";
        cardHeader.innerHTML = `
            <span class="text-xs font-black px-3 py-1 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 shadow-sm">
                <span>🧩</span>
                <span>Savol #${index + 1}</span>
            </span>
            <span class="text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full">25 talik qism</span>
        `;
        card.appendChild(cardHeader);

        // Question text
        const qText = document.createElement("p");
        qText.className = "text-sm md:text-base font-bold text-white leading-relaxed";
        qText.textContent = q.question_text;
        card.appendChild(qText);

        // Options
        const optContainer = document.createElement("div");
        optContainer.className = "space-y-2.5 pt-1";
        optContainer.id = `options-container-${index}`;

        q.options.forEach(opt => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "w-full text-left p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 hover:border-blue-500/50 text-white flex items-center space-x-3 transition active:scale-98 option-btn group";
            btn.id = `btn-q${index}-${opt.key}`;
            btn.innerHTML = `
                <span class="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-extrabold flex items-center justify-center shrink-0 border border-blue-500/30 group-hover:bg-blue-600 group-hover:text-white transition shadow-sm">${opt.key}</span>
                <span class="text-xs md:text-sm font-semibold flex-1 leading-snug">${opt.text}</span>
            `;

            btn.onclick = () => this.handleOptionClick(index, opt.key, opt.text, q.correct_key);
            optContainer.appendChild(btn);
        });

        // Feedback label container (reveals on click)
        const feedbackBadge = document.createElement("div");
        feedbackBadge.id = `feedback-${index}`;
        feedbackBadge.className = "hidden text-xs font-bold p-2.5 rounded-xl text-center transition";
        card.appendChild(feedbackBadge);

        card.appendChild(optContainer);
        feed.appendChild(card);

        // Trigger entrance animation
        setTimeout(() => {
            card.classList.remove("opacity-0", "translate-y-3");
            card.classList.add("opacity-100", "translate-y-0");
        }, 30);
    },

    // Handle answer click, instant visual feedback + reveal next question + smooth scroll!
    handleOptionClick: function (index, selectedKey, selectedText, correctKey) {
        const q = this.questions[index];
        const isCorrect = (selectedKey === correctKey);

        // Record answer
        this.userAnswers[q.id] = selectedText;

        // Feedback sound / haptic
        if (isCorrect) {
            TG.haptic("success");
        } else {
            TG.haptic("error");
        }

        // Lock all options for this question
        const optContainer = document.getElementById(`options-container-${index}`);
        const buttons = optContainer.querySelectorAll("button");
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add("cursor-default");
        });

        // Highlight chosen & correct button
        const chosenBtn = document.getElementById(`btn-q${index}-${selectedKey}`);
        const correctBtn = document.getElementById(`btn-q${index}-${correctKey}`);
        const feedbackEl = document.getElementById(`feedback-${index}`);

        if (isCorrect) {
            chosenBtn?.classList.remove("border-slate-800", "bg-slate-950/80");
            chosenBtn?.classList.add("option-correct");
            if (feedbackEl) {
                feedbackEl.textContent = "🎉 Ajoyib! To'g'ri topdingiz (+1 Ball)";
                feedbackEl.className = "text-xs font-bold p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-center";
                feedbackEl.classList.remove("hidden");
            }
        } else {
            chosenBtn?.classList.remove("border-slate-800", "bg-slate-950/80");
            chosenBtn?.classList.add("option-incorrect");
            // Also reveal correct option in green
            correctBtn?.classList.remove("border-slate-800", "bg-slate-950/80");
            correctBtn?.classList.add("option-correct");
            if (feedbackEl) {
                feedbackEl.textContent = "💔 Xato javob! To'g'ri variant yashil bilan belgilandi";
                feedbackEl.className = "text-xs font-bold p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-center";
                feedbackEl.classList.remove("hidden");
            }
        }

        // Update progress bar
        const answeredCount = Object.keys(this.userAnswers).length;
        const totalCount = this.questions.length;
        document.getElementById("scroll-progress-text").textContent = `${answeredCount} / ${totalCount} yechildi`;
        const pct = (answeredCount / totalCount) * 100;
        document.getElementById("scroll-progress-bar").style.width = `${pct}%`;

        const nextIndex = index + 1;

        if (nextIndex < this.questions.length) {
            // Next question appears below!
            setTimeout(() => {
                this.renderQuestionCard(nextIndex);

                // Smooth scroll to the new question!
                setTimeout(() => {
                    const nextEl = document.getElementById(`q-card-${nextIndex}`);
                    if (nextEl) {
                        nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }, 80);
            }, 300);
        } else {
            // All 25 questions completed!
            setTimeout(() => {
                this.finishPart();
            }, 500);
        }
    },

    // Finish 25-question part and show summary card in the feed
    finishPart: async function () {
        clearInterval(this.timerInterval);
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        try {
            const payload = {
                quiz_id: this.quizId,
                user_id: TG.currentUser?.telegram_id || 0,
                part_num: this.currentPartNum,
                answers: this.userAnswers,
                time_spent: this.timeSpent
            };

            const res = await fetch("/api/quiz/submit-part", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Natijalarni yuborib bo'lmadi");

            const data = await res.json();
            const result = data.result;

            this.renderPartSummaryCard(result);
        } catch (e) {
            console.error("Submit part error:", e);
            alert("Natijalarni saqlashda xatolik");
        } finally {
            this.isSubmitting = false;
        }
    },

    // Append beautiful completion card at the bottom of the feed
    renderPartSummaryCard: function (result) {
        const feed = document.getElementById("scroll-feed-container");

        // Confetti if >= 60%
        if (result.percentage >= 60 && typeof confetti === "function") {
            TG.haptic("success");
            confetti({
                particleCount: 90,
                spread: 80,
                origin: { y: 0.6 }
            });
        }

        const summaryCard = document.createElement("div");
        summaryCard.id = "part-summary-card";
        summaryCard.className = "p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-blue-500/50 shadow-2xl space-y-5 text-center mt-6";

        const hasNextPart = this.currentPartNum < this.totalParts;
        const nextPartNum = this.currentPartNum + 1;

        summaryCard.innerHTML = `
            <div class="inline-block p-4 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 text-5xl border border-amber-500/30 float-bob">
                🏆
            </div>
            <div>
                <span class="px-3.5 py-1 rounded-full text-xs font-black ${
                    result.percentage >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }">
                    ✨ ${this.currentPartNum}-QISM YAKUNLANDI! ✨
                </span>
                <h3 class="font-black text-xl text-white mt-2 tracking-tight">${result.quiz_title}</h3>
            </div>

            <div class="grid grid-cols-3 gap-2.5 p-4 rounded-3xl bg-slate-950/80 border border-slate-800">
                <div class="space-y-0.5">
                    <p class="text-[11px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                        <span>🎯</span>
                        <span>To'g'ri</span>
                    </p>
                    <h4 class="text-xl font-black text-white">${result.score} / ${result.total_questions}</h4>
                </div>
                <div class="space-y-0.5">
                    <p class="text-[11px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                        <span>⚡</span>
                        <span>Foiz</span>
                    </p>
                    <h4 class="text-xl font-black text-emerald-400">${result.percentage}%</h4>
                </div>
                <div class="space-y-0.5">
                    <p class="text-[11px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                        <span>⏱️</span>
                        <span>Vaqt</span>
                    </p>
                    <h4 class="text-xl font-black text-blue-400">${result.time_spent_seconds}s</h4>
                </div>
            </div>

            <div class="space-y-2.5 pt-2">
                ${hasNextPart ? `
                    <button class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-black text-xs shadow-xl shadow-blue-600/30 transition active:scale-98 flex items-center justify-center gap-2"
                            onclick="QuizPlayer.startPart('${this.currentQuizCode}', ${nextPartNum})">
                        <span>Keyingi 25 talik bo'limga o'tish (${nextPartNum}-qism)</span>
                        <span>⏭️</span>
                    </button>
                ` : `
                    <div class="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-2">
                        <span>👑</span>
                        <span>Tabriklaymiz! Barcha 25 talik bo'limlar yakunlandi!</span>
                    </div>
                `}

                <div class="flex gap-2">
                    <button class="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1"
                            onclick="QuizPlayer.startPart('${this.currentQuizCode}', ${this.currentPartNum})">
                        <span>🔄</span>
                        <span>Qayta urinish</span>
                    </button>
                    <button class="flex-1 py-3 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs transition flex items-center justify-center gap-1"
                            onclick="QuizPlayer.openPartsModal('${this.currentQuizCode}')">
                        <span>📋</span>
                        <span>Barcha bo'limlar</span>
                    </button>
                </div>

                <button class="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1"
                        onclick="QuizPlayer.exitScrollView()">
                    <span>🏠</span>
                    <span>Bosh sahifaga qaytish</span>
                </button>
            </div>
        `;

        feed.appendChild(summaryCard);

        setTimeout(() => {
            summaryCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
    },

    // Exit scroll view and return to main home view
    exitScrollView: function () {
        clearInterval(this.timerInterval);
        document.getElementById("quiz-scroll-container").classList.add("hidden");
        document.getElementById("main-app-container").classList.remove("hidden");
        if (window.App) {
            window.App.loadQuizzes();
        }
    }
};
