const state = {
  questions: [...window.QUESTION_BANK],
  submitted: false,
  results: new Map(),
  answers: new Map(),
  submittedIds: new Set(),
};

const $ = (selector) => document.querySelector(selector);

function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[；;，,\s]/g, "")
    .replace(/[()（）]/g, "");
}

function isObjective(q) {
  return ["true_false", "single_choice", "fill_blank", "code_fill"].includes(q.type);
}

function sections() {
  return ["全部题目", ...new Set(state.questions.map((q) => q.section))];
}

function userAnswer(q) {
  return state.answers.get(q.id) || (q.type === "fill_blank" || q.type === "code_fill" ? [] : "");
}

function answered(q) {
  const ans = userAnswer(q);
  if (Array.isArray(ans)) return ans.every((part) => part.trim());
  return Boolean(ans);
}

function grade(q) {
  const ans = userAnswer(q);
  if (q.type === "true_false") {
    return ans === q.answer[0];
  }
  if (q.type === "single_choice") {
    return q.answer.includes(ans);
  }
  if (q.type === "fill_blank" || q.type === "code_fill") {
    return q.answer.every((expected, index) => normalizeAnswer(ans[index]) === normalizeAnswer(expected));
  }
  return ans === "correct";
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInputs(q) {
  if (q.type === "true_false") {
    return `
      <div class="options">
        ${["√", "×"].map((value) => `
          <label class="option">
            <input type="radio" name="${q.id}" value="${value}" data-qid="${q.id}" ${userAnswer(q) === value ? "checked" : ""} />
            <span>${value === "√" ? "正确" : "错误"}（${value}）</span>
          </label>
        `).join("")}
      </div>`;
  }

  if (q.type === "single_choice") {
    return `
      <div class="options">
        ${q.options.map((option) => {
          const value = option.slice(0, 1);
          return `
            <label class="option">
              <input type="radio" name="${q.id}" value="${value}" data-qid="${q.id}" ${userAnswer(q) === value ? "checked" : ""} />
              <span>${escapeHtml(option)}</span>
            </label>`;
        }).join("")}
      </div>`;
  }

  if (q.type === "fill_blank" || q.type === "code_fill") {
    return `
      ${q.code ? `<pre>${escapeHtml(q.code)}</pre>` : ""}
      <div class="blanks">
        ${q.answer.map((_, index) => `
          <input class="blank-input" data-qid="${q.id}" data-blank="${index}" value="${escapeHtml(userAnswer(q)[index] || "")}" placeholder="第 ${index + 1} 空答案" />
        `).join("")}
      </div>`;
  }

  return `
    ${q.code ? `<pre>${escapeHtml(q.code)}</pre>` : ""}
    <textarea data-qid="${q.id}" data-open-answer placeholder="在这里写你的思路或代码，提交后对照参考答案自评。">${escapeHtml(state.answers.get(`${q.id}-draft`) || "")}</textarea>
    <div class="self-check">
      <label><input type="radio" name="${q.id}-self" value="correct" data-qid="${q.id}" ${userAnswer(q) === "correct" ? "checked" : ""} />我对照参考答案，认为写对了</label>
      <label><input type="radio" name="${q.id}-self" value="wrong" data-qid="${q.id}" ${userAnswer(q) === "wrong" ? "checked" : ""} />我还没写对，需要回看解析</label>
    </div>`;
}

function feedback(q) {
  const result = state.results.get(q.id);
  if (!state.submitted || !result) return "";
  const answer = q.type === "open_code" ? q.answerText : (q.answerText || q.answer.join("；"));
  return `
    <div class="feedback">
      <p class="${result.correct ? "ok" : "no"}">${result.correct ? "回答正确" : "需要订正"}</p>
      <p><span class="answer">正确答案：</span>${escapeHtml(answer)}</p>
      ${q.code && q.type === "open_code" ? `<pre>${escapeHtml(q.code)}</pre>` : ""}
      <p><span class="answer">解析：</span>${escapeHtml(q.explanation || "暂无解析")}</p>
    </div>`;
}

function visibleQuestions() {
  const section = $("#sectionFilter").value;
  const onlyWrong = $("#onlyWrong").checked;
  return state.questions.filter((q) => {
    const sectionOk = section === "全部题目" || q.section === section;
    const wrongOk = !onlyWrong || state.results.get(q.id)?.correct === false;
    return sectionOk && wrongOk;
  });
}

function practiceQuestions() {
  const section = $("#sectionFilter").value;
  return state.questions.filter((q) => section === "全部题目" || q.section === section);
}

function render() {
  const list = $("#questionList");
  const items = visibleQuestions();
  const scope = practiceQuestions();
  $("#viewTitle").textContent = $("#sectionFilter").value;
  $("#totalCount").textContent = scope.length;
  const done = scope.filter(answered).length;
  $("#answeredCount").textContent = done;
  $("#progressFill").style.width = `${Math.round((done / scope.length) * 100)}%`;

  list.innerHTML = items.map((q) => {
    const result = state.results.get(q.id);
    const resultClass = state.submitted && result ? (result.correct ? "correct" : "wrong") : "";
    return `
      <article class="question ${resultClass} ${state.submitted ? "submitted" : ""}" id="${q.id}">
        <div class="q-meta">
          <span class="pill">${q.section}</span>
          <span class="pill">第 ${q.number} 题</span>
          ${isObjective(q) ? "" : `<span class="pill">自评题</span>`}
        </div>
        <div class="stem">${escapeHtml(q.stem)}</div>
        ${q.code && q.type !== "code_fill" && q.type !== "open_code" ? `<pre>${escapeHtml(q.code)}</pre>` : ""}
        ${renderInputs(q)}
        ${feedback(q)}
      </article>`;
  }).join("");
}

function updateProgress() {
  const scope = practiceQuestions();
  const done = scope.filter(answered).length;
  $("#answeredCount").textContent = done;
  $("#progressFill").style.width = `${Math.round((done / scope.length) * 100)}%`;
}

function populateFilters() {
  $("#sectionFilter").innerHTML = sections()
    .map((section) => `<option value="${section}">${section}</option>`)
    .join("");
}

function submit() {
  const scope = practiceQuestions();
  state.submitted = true;
  state.results.clear();
  state.submittedIds = new Set(scope.map((q) => q.id));
  scope.forEach((q) => {
    state.results.set(q.id, {
      correct: answered(q) ? grade(q) : false,
      unanswered: !answered(q),
    });
  });

  const scored = scope.length;
  const correct = [...state.results.values()].filter((r) => r.correct).length;
  const wrong = scored - correct;
  const rate = Math.round((correct / scored) * 100);
  const scopeName = $("#sectionFilter").value;
  $("#resultBox").classList.remove("hidden");
  $("#resultBox").innerHTML = `
    <strong>正确率：${rate}%</strong><br />
    本次范围：${scopeName}，共 ${scored} 题。<br />
    正确 ${correct} 题，错误/未答 ${wrong} 题。<br />
    错题解析已经整理在下方。
  `;
  render();
  renderWrongList();
  $("#wrongPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderWrongList() {
  const wrongQuestions = state.questions.filter((q) => state.submittedIds.has(q.id) && state.results.get(q.id)?.correct === false);
  $("#wrongPanel").classList.toggle("hidden", wrongQuestions.length === 0);
  $("#wrongList").innerHTML = wrongQuestions.map((q) => {
    const answer = q.type === "open_code" ? q.answerText : (q.answerText || q.answer.join("；"));
    return `
      <div class="wrong-item">
        <p><strong>${q.section} 第 ${q.number} 题：</strong>${escapeHtml(q.stem)}</p>
        <p><span class="answer">正确答案：</span>${escapeHtml(answer)}</p>
        ${q.code ? `<pre>${escapeHtml(q.code)}</pre>` : ""}
        <p><span class="answer">解析：</span>${escapeHtml(q.explanation || "暂无解析")}</p>
      </div>`;
  }).join("");
}

function resetAll() {
  state.submitted = false;
  state.results.clear();
  state.submittedIds.clear();
  state.answers.clear();
  $("#resultBox").classList.add("hidden");
  $("#wrongPanel").classList.add("hidden");
  render();
}

function clearSubmission() {
  state.submitted = false;
  state.results.clear();
  state.submittedIds.clear();
  $("#resultBox").classList.add("hidden");
  $("#wrongPanel").classList.add("hidden");
  render();
}

function shuffle() {
  for (let i = state.questions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.questions[i], state.questions[j]] = [state.questions[j], state.questions[i]];
  }
  resetAll();
}

populateFilters();
render();

$("#sectionFilter").addEventListener("change", clearSubmission);
$("#onlyWrong").addEventListener("change", render);
$("#submitBtn").addEventListener("click", submit);
$("#resetBtn").addEventListener("click", resetAll);
$("#shuffleBtn").addEventListener("click", shuffle);
document.addEventListener("input", () => {
  updateProgress();
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-blank]")) {
    const qid = target.dataset.qid;
    const values = state.answers.get(qid) || [];
    values[Number(target.dataset.blank)] = target.value;
    state.answers.set(qid, values);
    updateProgress();
  }
  if (target.matches("[data-open-answer]")) {
    state.answers.set(`${target.dataset.qid}-draft`, target.value);
  }
});
document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("input[type='radio'][data-qid]")) {
    state.answers.set(target.dataset.qid, target.value);
    updateProgress();
  }
});
