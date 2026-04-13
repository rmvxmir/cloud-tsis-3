/**
 * CFO Bot — Chatbot State Machine
 * SSOT §9 — Chatbot Behavior
 *
 * States: GREETING → ASK_VM → ASK_K8S → ASK_STORAGE → CALCULATE → DONE
 * No external AI API is used during calculation. Fully deterministic.
 */

import { calcVM, calcKubernetes, calcStorage, calcGrandTotal } from "./pricingEngine.js";
import { validateVM, validateKubernetes, validateStorage } from "./validator.js";

// ─── State constants ─────────────────────────────────────────────────────────
export const STATES = Object.freeze({
    GREETING: "GREETING",
    ASK_VM: "ASK_VM",
    ASK_K8S: "ASK_K8S",
    ASK_STORAGE: "ASK_STORAGE",
    CALCULATE: "CALCULATE",
    DONE: "DONE",
});

// ─── Chatbot class ───────────────────────────────────────────────────────────
export class CFOBot {
    constructor({ onMessage, onRenderForm, onRenderResults, onReset }) {
        // Callbacks injected by app.js (UI controller)
        this._onMessage = onMessage;       // (text: string, isBot: boolean) => void
        this._onRenderForm = onRenderForm;    // (formDef: object) => void
        this._onRenderResults = onRenderResults; // (results: object) => void
        this._onReset = onReset;         // () => void

        this._state = STATES.GREETING;
        this._data = {};           // accumulated user inputs

        // Start immediately
        this._enter(STATES.GREETING);
    }

    // ─── Public: user submitted a form section ──────────────────────────────
    submitSection(sectionId, values) {
        switch (sectionId) {
            case "vm": return this._handleVM(values);
            case "k8s": return this._handleK8s(values);
            case "storage": return this._handleStorage(values);
            default: break;
        }
    }

    // ─── Public: reset to initial state ────────────────────────────────────
    reset() {
        this._state = STATES.GREETING;
        this._data = {};
        this._onReset();
        this._enter(STATES.GREETING);
    }

    // ─── State transitions ──────────────────────────────────────────────────
    _enter(state) {
        this._state = state;

        switch (state) {
            case STATES.GREETING:
                this._bot(
                    "👋 Welcome to <strong>CFO Bot</strong> — the PS Cloud cost estimator.\n" +
                    "I'll walk you through three steps:\n" +
                    "① Virtual Machines &nbsp;② Kubernetes Cluster &nbsp;③ Cloud Storage\n\n" +
                    "Let's start with your <strong>Virtual Machines</strong>."
                );
                this._enter(STATES.ASK_VM);
                break;

            case STATES.ASK_VM:
                this._onRenderForm({
                    id: "vm",
                    title: "① Virtual Machines",
                    fields: [
                        { id: "vm_count", label: "Number of VMs", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "cpu_cores", label: "CPU Cores per VM", type: "number", min: 1, step: 1, placeholder: "2" },
                        { id: "ram_gb", label: "RAM per VM (GB)", type: "number", min: 0, step: 0.5, placeholder: "4" },
                        { id: "nvme_gb", label: "NVMe Disk per VM (GB)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "hdd_gb", label: "HDD Disk per VM (GB)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "white_ip_enabled", label: "White/floating IP per VM", type: "checkbox" },
                    ],
                });
                break;

            case STATES.ASK_K8S:
                this._bot("Great! Now configure your <strong>Kubernetes Cluster</strong>.");
                this._onRenderForm({
                    id: "k8s",
                    title: "② Kubernetes Cluster",
                    fields: [
                        // Master group
                        { id: "master_count", label: "Master nodes count", type: "number", min: 1, step: 1, placeholder: "1", value: 1 },
                        { id: "master_cpu_cores", label: "CPU cores per master", type: "number", min: 1, step: 1, placeholder: "2" },
                        { id: "master_ram_gb", label: "RAM per master (GB)", type: "number", min: 0, step: 0.5, placeholder: "4" },
                        { id: "master_disk_type", label: "Master disk type", type: "select", options: ["nvme", "hdd"] },
                        { id: "master_disk_gb", label: "Master disk per node (GB)", type: "number", min: 1, step: 1, placeholder: "40" },
                        // Worker group
                        { id: "worker_count", label: "Worker nodes count", type: "number", min: 0, step: 1, placeholder: "2", value: 0 },
                        { id: "worker_cpu_cores", label: "CPU cores per worker", type: "number", min: 1, step: 1, placeholder: "2" },
                        { id: "worker_ram_gb", label: "RAM per worker (GB)", type: "number", min: 0, step: 0.5, placeholder: "4" },
                        { id: "worker_disk_type", label: "Worker disk type", type: "select", options: ["nvme", "hdd"] },
                        { id: "worker_disk_gb", label: "Worker disk per node (GB)", type: "number", min: 1, step: 1, placeholder: "80" },
                    ],
                });
                break;

            case STATES.ASK_STORAGE:
                this._bot("Almost done! Configure your <strong>Cloud Storage</strong>.");
                this._onRenderForm({
                    id: "storage",
                    title: "③ Cloud Storage",
                    fields: [
                        { id: "storage_gb", label: "Stored data (GB)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "write_requests", label: "Write requests per month (PUT/COPY/LIST)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "read_requests", label: "Read requests per month (GET)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                    ],
                });
                break;

            case STATES.CALCULATE:
                this._calculate();
                break;

            case STATES.DONE:
                this._bot(
                    "✅ Calculation complete! See the results panel on the right.\n" +
                    "Click <strong>Reset</strong> to start over."
                );
                break;
        }
    }

    // ─── Section handlers ───────────────────────────────────────────────────
    _handleVM(raw) {
        const p = {
            vm_count: this._int(raw.vm_count),
            cpu_cores: this._int(raw.cpu_cores),
            ram_gb: this._float(raw.ram_gb),
            nvme_gb: this._float(raw.nvme_gb),
            hdd_gb: this._float(raw.hdd_gb),
            white_ip_enabled: Boolean(raw.white_ip_enabled),
        };
        const { valid, errors } = validateVM(p);
        if (!valid) { this._showErrors(errors); return; }

        this._user(this._summarizeVM(p));
        this._data.vm = p;
        this._enter(STATES.ASK_K8S);
    }

    _handleK8s(raw) {
        const p = {
            master_count: this._int(raw.master_count),
            master_cpu_cores: this._int(raw.master_cpu_cores),
            master_ram_gb: this._float(raw.master_ram_gb),
            master_disk_type: raw.master_disk_type,
            master_disk_gb: this._float(raw.master_disk_gb),
            worker_count: this._int(raw.worker_count),
            worker_cpu_cores: this._int(raw.worker_cpu_cores),
            worker_ram_gb: this._float(raw.worker_ram_gb),
            worker_disk_type: raw.worker_disk_type,
            worker_disk_gb: this._float(raw.worker_disk_gb),
        };
        const { valid, errors } = validateKubernetes(p);
        if (!valid) { this._showErrors(errors); return; }

        this._user(this._summarizeK8s(p));
        this._data.k8s = p;
        this._enter(STATES.ASK_STORAGE);
    }

    _handleStorage(raw) {
        const p = {
            storage_gb: this._float(raw.storage_gb),
            write_requests: this._int(raw.write_requests),
            read_requests: this._int(raw.read_requests),
        };
        const { valid, errors } = validateStorage(p);
        if (!valid) { this._showErrors(errors); return; }

        this._user(this._summarizeStorage(p));
        this._data.storage = p;
        this._enter(STATES.CALCULATE);
    }

    // ─── Calculation ────────────────────────────────────────────────────────
    _calculate() {
        const vmResult = calcVM(this._data.vm);
        const k8sResult = calcKubernetes(this._data.k8s);
        const storageResult = calcStorage(this._data.storage);
        const totals = calcGrandTotal(vmResult, k8sResult, storageResult);

        this._onRenderResults({ vmResult, k8sResult, storageResult, totals });
        this._enter(STATES.DONE);
    }

    // ─── UI helpers ─────────────────────────────────────────────────────────
    _bot(html) { this._onMessage(html, true); }
    _user(html) { this._onMessage(html, false); }

    _showErrors(errors) {
        this._bot(
            "⚠️ Please fix the following:\n<ul>" +
            errors.map(e => `<li>${e}</li>`).join("") +
            "</ul>"
        );
    }

    // ─── Type coercions ──────────────────────────────────────────────────────
    _int(v) { const n = parseInt(v, 10); return isNaN(n) ? NaN : n; }
    _float(v) { const n = parseFloat(v); return isNaN(n) ? NaN : n; }

    // ─── Summary strings for user echo ──────────────────────────────────────
    _summarizeVM(p) {
        const ip = p.white_ip_enabled ? "yes" : "no";
        return `VMs: <strong>${p.vm_count}</strong> × ${p.cpu_cores} vCPU / ${p.ram_gb} GB RAM / ` +
            `NVMe ${p.nvme_gb} GB / HDD ${p.hdd_gb} GB / White IP: ${ip}`;
    }
    _summarizeK8s(p) {
        return `Masters: <strong>${p.master_count}</strong> × ${p.master_cpu_cores} vCPU / ${p.master_ram_gb} GB RAM / ` +
            `${p.master_disk_type.toUpperCase()} ${p.master_disk_gb} GB &nbsp;|&nbsp; ` +
            `Workers: <strong>${p.worker_count}</strong> × ${p.worker_cpu_cores} vCPU / ${p.worker_ram_gb} GB RAM / ` +
            `${p.worker_disk_type.toUpperCase()} ${p.worker_disk_gb} GB`;
    }
    _summarizeStorage(p) {
        return `Storage: <strong>${p.storage_gb} GB</strong> / Writes: ${p.write_requests.toLocaleString()} / Reads: ${p.read_requests.toLocaleString()}`;
    }
}
