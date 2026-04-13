/**
 * CFO Bot — app.js (UI Controller)
 * Wires CFOBot FSM (chatbot.js) to DOM.
 * Imports pricingEngine.js indirectly via chatbot.js.
 *
 * NOTE: This file uses ES modules and must be loaded with <script type="module">.
 *       Because it imports from ../src/, both directories are served from the
 *       same origin (firebase serve / firebase hosting).
 */

import { CFOBot } from "./src/chatbot.js";

// ─── DOM refs ────────────────────────────────────────────────────────────────
const chatMessages = document.getElementById("chat-messages");
const resultsPanel = document.getElementById("results-panel");
const placeholder = document.getElementById("results-placeholder");
const resultsContent = document.getElementById("results-content");
const resetBtn = document.getElementById("reset-btn");

// Result slots
const resVmTotal = document.getElementById("res-vm-total");
const resVmBreakdown = document.getElementById("res-vm-breakdown");
const resK8sTotal = document.getElementById("res-k8s-total");
const resK8sBreakdown = document.getElementById("res-k8s-breakdown");
const resStorTotal = document.getElementById("res-storage-total");
const resStorBreakdown = document.getElementById("res-storage-breakdown");
const resGrand = document.getElementById("res-grand-total");

// ─── KZT formatter ───────────────────────────────────────────────────────────
function kzt(amount) {
    return `${Math.round(amount).toLocaleString("ru-KZ")} KZT`;
}

// ─── Chat rendering ───────────────────────────────────────────────────────────
function appendMessage(html, isBot) {
    const wrap = document.createElement("div");
    wrap.className = `bubble-wrap ${isBot ? "bot" : "user"}`;

    const bubble = document.createElement("div");
    bubble.className = `bubble ${isBot ? "bot" : "user"}`;
    bubble.innerHTML = html;

    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ─── Inline form rendering ───────────────────────────────────────────────────
let activeFormCard = null;

function renderForm(formDef) {
    // Remove any previous form card
    if (activeFormCard) activeFormCard.remove();

    const card = document.createElement("div");
    card.className = "form-card";
    card.id = `form-${formDef.id}`;

    const title = document.createElement("div");
    title.className = "form-card-title";
    title.textContent = formDef.title;
    card.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "form-grid";

    formDef.fields.forEach(f => {
        // Group separator for k8s form
        if (f.type === "separator") {
            const sep = document.createElement("div");
            sep.className = "form-group-label";
            sep.textContent = f.label;
            grid.appendChild(sep);
            return;
        }

        const fieldDiv = document.createElement("div");

        if (f.type === "checkbox") {
            fieldDiv.className = "field checkbox-field";
            const cb = document.createElement("input");
            cb.type = "checkbox"; cb.id = f.id; cb.name = f.id;
            const lbl = document.createElement("label");
            lbl.htmlFor = f.id; lbl.textContent = f.label;
            fieldDiv.appendChild(cb);
            fieldDiv.appendChild(lbl);
        } else if (f.type === "select") {
            fieldDiv.className = "field";
            const lbl = document.createElement("label");
            lbl.htmlFor = f.id; lbl.textContent = f.label;
            const sel = document.createElement("select");
            sel.id = f.id; sel.name = f.id;
            f.options.forEach(opt => {
                const o = document.createElement("option");
                o.value = opt; o.textContent = opt.toUpperCase();
                sel.appendChild(o);
            });
            fieldDiv.appendChild(lbl);
            fieldDiv.appendChild(sel);
        } else {
            fieldDiv.className = "field";
            const lbl = document.createElement("label");
            lbl.htmlFor = f.id; lbl.textContent = f.label;
            const inp = document.createElement("input");
            inp.type = "number"; inp.id = f.id; inp.name = f.id;
            inp.placeholder = f.placeholder || "";
            if (f.min !== undefined) inp.min = f.min;
            if (f.step !== undefined) inp.step = f.step;
            if (f.value !== undefined) inp.value = f.value;
            fieldDiv.appendChild(lbl);
            fieldDiv.appendChild(inp);
        }

        grid.appendChild(fieldDiv);
    });

    card.appendChild(grid);

    // Error area
    const errDiv = document.createElement("div");
    errDiv.className = "form-errors hidden";
    errDiv.id = `form-errors-${formDef.id}`;
    card.appendChild(errDiv);

    // Confirm button
    const actions = document.createElement("div");
    actions.className = "form-actions";
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.id = `confirm-${formDef.id}`;
    confirmBtn.textContent = "Confirm →";
    confirmBtn.addEventListener("click", () => {
        const values = collectForm(card, formDef);
        bot.submitSection(formDef.id, values);
    });
    actions.appendChild(confirmBtn);
    card.appendChild(actions);

    // Append after chat messages (inside chat-panel)
    chatMessages.parentElement.appendChild(card);
    activeFormCard = card;
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function collectForm(card, formDef) {
    const values = {};
    formDef.fields.forEach(f => {
        if (f.type === "separator") return;
        const el = card.querySelector(`#${f.id}`);
        if (!el) return;
        if (f.type === "checkbox") values[f.id] = el.checked;
        else values[f.id] = el.value;
    });
    return values;
}

// ─── Results rendering ───────────────────────────────────────────────────────
function renderResults({ vmResult, k8sResult, storageResult, totals }) {
    // Show results area
    placeholder.classList.add("hidden");
    resultsContent.classList.remove("hidden");

    // VM breakdown
    resVmTotal.textContent = kzt(vmResult.totalCost);
    resVmBreakdown.innerHTML = "";
    const vmRows = [
        ["CPU", vmResult.breakdown.cpu],
        ["RAM", vmResult.breakdown.ram],
        ["NVMe", vmResult.breakdown.nvme],
        ["HDD", vmResult.breakdown.hdd],
        ["White IP", vmResult.breakdown.whiteIp],
    ];
    vmRows.forEach(([label, val]) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${label}</span><span>${kzt(val)}</span>`;
        resVmBreakdown.appendChild(li);
    });

    // K8s breakdown
    resK8sTotal.textContent = kzt(k8sResult.totalCost);
    resK8sBreakdown.innerHTML = "";
    const k8sRows = [
        [`Masters (×${totals.vmCost !== undefined ? "" : ""}${k8sResult.masterTotal / k8sResult.masterUnitCost || 1}) × ${kzt(k8sResult.masterUnitCost)}/node`, k8sResult.masterTotal],
        [`Workers × ${kzt(k8sResult.workerUnitCost)}/node`, k8sResult.workerTotal],
    ];
    // Simpler, cleaner rows:
    resK8sBreakdown.innerHTML = "";
    [
        ["Master group", k8sResult.masterTotal],
        ["Worker group", k8sResult.workerTotal],
        [`Master/node (CPU+RAM+${k8sResult.masterBreakdown.diskType.toUpperCase()})`, k8sResult.masterUnitCost],
        [`Worker/node (CPU+RAM+${k8sResult.workerBreakdown.diskType.toUpperCase()})`, k8sResult.workerUnitCost],
    ].forEach(([label, val]) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${label}</span><span>${kzt(val)}</span>`;
        resK8sBreakdown.appendChild(li);
    });

    // Storage breakdown
    resStorTotal.textContent = kzt(storageResult.totalCost);
    resStorBreakdown.innerHTML = "";
    [
        ["Volume", storageResult.volumeCost],
        ["Write requests", storageResult.writeCost],
        ["Read requests", storageResult.readCost],
    ].forEach(([label, val]) => {
        const li = document.createElement("li");
        li.innerHTML = `<span>${label}</span><span>${kzt(val)}</span>`;
        resStorBreakdown.appendChild(li);
    });

    // Grand total
    resGrand.textContent = kzt(totals.grandTotal);
}

// ─── Reset ───────────────────────────────────────────────────────────────────
function onReset() {
    chatMessages.innerHTML = "";
    if (activeFormCard) { activeFormCard.remove(); activeFormCard = null; }
    placeholder.classList.remove("hidden");
    resultsContent.classList.add("hidden");
}

// ─── Init bot ────────────────────────────────────────────────────────────────
const bot = new CFOBot({
    onMessage: appendMessage,
    onRenderForm: renderForm,
    onRenderResults: renderResults,
    onReset: onReset,
});

resetBtn.addEventListener("click", () => bot.reset());
