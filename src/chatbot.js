/**
 * CFO Bot — Chatbot State Machine (v2)
 * SSOT: cfo-bot-ssot-cloud.md §7, §10, §11.1
 *
 * v2 change: services are OPTIONAL (SSOT §7).
 * New state: ASK_SERVICE_SELECTION — user picks which services to include.
 * Only selected services are asked about and validated.
 * Unselected services contribute 0 to the total (SSOT §8).
 *
 * States:
 *   GREETING → ASK_SERVICE_SELECTION
 *   → [ASK_VM if selected]
 *   → [ASK_K8S if selected]
 *   → [ASK_STORAGE if selected]
 *   → CALCULATE → DONE
 */

import { calcVM, calcKubernetes, calcStorage, calcGrandTotal } from "./pricingEngine.js";
import {
    validateServiceSelection,
    validateVM,
    validateKubernetes,
    validateStorage,
} from "./validator.js";

// ─── State constants ─────────────────────────────────────────────────────────
export const STATES = Object.freeze({
    GREETING: "GREETING",
    ASK_SERVICE_SELECTION: "ASK_SERVICE_SELECTION",
    ASK_VM: "ASK_VM",
    ASK_K8S: "ASK_K8S",
    ASK_STORAGE: "ASK_STORAGE",
    CALCULATE: "CALCULATE",
    DONE: "DONE",
});

// ─── Zero results for unselected services (SSOT §8) ──────────────────────────
const ZERO_VM = { unitCost: 0, totalCost: 0, breakdown: { cpu: 0, ram: 0, nvme: 0, hdd: 0, whiteIp: 0 } };
const ZERO_K8S = {
    masterUnitCost: 0, masterTotal: 0, workerUnitCost: 0, workerTotal: 0, totalCost: 0,
    masterBreakdown: { cpu: 0, ram: 0, disk: 0, diskType: "hdd" },
    workerBreakdown: { cpu: 0, ram: 0, disk: 0, diskType: "hdd" }
};
const ZERO_STORAGE = { volumeCost: 0, writeCost: 0, readCost: 0, totalCost: 0, writeBlocks: 0, readBlocks: 0 };

// ─── CFOBot class ─────────────────────────────────────────────────────────────
export class CFOBot {
    constructor({ onMessage, onRenderForm, onRenderResults, onReset }) {
        this._onMessage = onMessage;
        this._onRenderForm = onRenderForm;
        this._onRenderResults = onRenderResults;
        this._onReset = onReset;

        this._state = STATES.GREETING;
        this._selected = { vm: false, k8s: false, storage: false }; // SSOT §7
        this._data = {};

        this._enter(STATES.GREETING);
    }

    // ─── Public API ─────────────────────────────────────────────────────────
    submitSection(sectionId, values) {
        switch (sectionId) {
            case "services": return this._handleServiceSelection(values);
            case "vm": return this._handleVM(values);
            case "k8s": return this._handleK8s(values);
            case "storage": return this._handleStorage(values);
        }
    }

    reset() {
        this._state = STATES.GREETING;
        this._selected = { vm: false, k8s: false, storage: false };
        this._data = {};
        this._onReset();
        this._enter(STATES.GREETING);
    }

    // ─── State machine ───────────────────────────────────────────────────────
    _enter(state) {
        this._state = state;
        switch (state) {

            case STATES.GREETING:
                this._bot(
                    "👋 Welcome to <strong>CFO Bot</strong> — PS Cloud Cost Estimator.\n" +
                    "Select the services you want to estimate, then configure each one."
                );
                this._enter(STATES.ASK_SERVICE_SELECTION);
                break;

            case STATES.ASK_SERVICE_SELECTION:
                this._onRenderForm({
                    id: "services",
                    title: "Select Services to Estimate",
                    fields: [
                        { id: "sel_vm", label: "🖥️  Virtual Machines", type: "checkbox" },
                        { id: "sel_k8s", label: "⎈  Kubernetes Cluster", type: "checkbox" },
                        { id: "sel_storage", label: "🗄️  Cloud Storage", type: "checkbox" },
                    ],
                    confirmLabel: "Next →",
                });
                break;

            case STATES.ASK_VM:
                this._bot("Configure your <strong>Virtual Machines</strong>.");
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
                this._bot("Configure your <strong>Kubernetes Cluster</strong>.");
                this._onRenderForm({
                    id: "k8s",
                    title: "② Kubernetes Cluster",
                    fields: [
                        { id: "master_count", label: "Master nodes", type: "number", min: 1, step: 1, placeholder: "1", value: 1 },
                        { id: "master_cpu_cores", label: "CPU cores per master", type: "number", min: 1, step: 1, placeholder: "2" },
                        { id: "master_ram_gb", label: "RAM per master (GB)", type: "number", min: 0, step: 0.5, placeholder: "4" },
                        { id: "master_disk_type", label: "Master disk type", type: "select", options: ["nvme", "hdd"] },
                        { id: "master_disk_gb", label: "Master disk per node (GB)", type: "number", min: 1, step: 1, placeholder: "40" },
                        { id: "worker_count", label: "Worker nodes", type: "number", min: 0, step: 1, placeholder: "2", value: 0 },
                        { id: "worker_cpu_cores", label: "CPU cores per worker", type: "number", min: 1, step: 1, placeholder: "2" },
                        { id: "worker_ram_gb", label: "RAM per worker (GB)", type: "number", min: 0, step: 0.5, placeholder: "4" },
                        { id: "worker_disk_type", label: "Worker disk type", type: "select", options: ["nvme", "hdd"] },
                        { id: "worker_disk_gb", label: "Worker disk per node (GB)", type: "number", min: 1, step: 1, placeholder: "80" },
                    ],
                });
                break;

            case STATES.ASK_STORAGE:
                this._bot("Configure your <strong>Cloud Storage</strong>.");
                this._onRenderForm({
                    id: "storage",
                    title: "③ Cloud Storage",
                    fields: [
                        { id: "storage_gb", label: "Stored data (GB)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "write_requests", label: "Write requests/month (PUT/COPY/LIST)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                        { id: "read_requests", label: "Read requests/month (GET)", type: "number", min: 0, step: 1, placeholder: "0", value: 0 },
                    ],
                });
                break;

            case STATES.CALCULATE:
                this._calculate();
                break;

            case STATES.DONE:
                this._bot("✅ Calculation complete! See the results panel.\nClick <strong>Reset</strong> to start over.");
                break;
        }
    }

    // ─── Section handlers ────────────────────────────────────────────────────
    _handleServiceSelection(raw) {
        const selected = {
            vm: Boolean(raw.sel_vm),
            k8s: Boolean(raw.sel_k8s),
            storage: Boolean(raw.sel_storage),
        };
        const { valid, errors } = validateServiceSelection(selected);
        if (!valid) { this._showErrors(errors); return; }

        this._selected = selected;

        const labels = [];
        if (selected.vm) labels.push("🖥️ Virtual Machines");
        if (selected.k8s) labels.push("⎈ Kubernetes");
        if (selected.storage) labels.push("🗄️ Cloud Storage");
        this._user(`Selected: <strong>${labels.join(", ")}</strong>`);

        this._nextAfterSelection();
    }

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
        this._user(`VMs: <strong>${p.vm_count}</strong> × ${p.cpu_cores} vCPU / ${p.ram_gb} GB RAM / NVMe ${p.nvme_gb} GB / HDD ${p.hdd_gb} GB / IP: ${p.white_ip_enabled ? "yes" : "no"}`);
        this._data.vm = p;
        this._nextAfter("vm");
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
        this._user(`Masters: <strong>${p.master_count}</strong> × ${p.master_cpu_cores}vCPU/${p.master_ram_gb}GB/${p.master_disk_type.toUpperCase()} ${p.master_disk_gb}GB &nbsp;|&nbsp; Workers: <strong>${p.worker_count}</strong> × ${p.worker_cpu_cores}vCPU/${p.worker_ram_gb}GB/${p.worker_disk_type.toUpperCase()} ${p.worker_disk_gb}GB`);
        this._data.k8s = p;
        this._nextAfter("k8s");
    }

    _handleStorage(raw) {
        const p = {
            storage_gb: this._float(raw.storage_gb),
            write_requests: this._int(raw.write_requests),
            read_requests: this._int(raw.read_requests),
        };
        const { valid, errors } = validateStorage(p);
        if (!valid) { this._showErrors(errors); return; }
        this._user(`Storage: <strong>${p.storage_gb} GB</strong> / Writes: ${p.write_requests.toLocaleString()} / Reads: ${p.read_requests.toLocaleString()}`);
        this._data.storage = p;
        this._nextAfter("storage");
    }

    // ─── Navigation helpers ──────────────────────────────────────────────────
    /** After service selection, go to the first selected service form. */
    _nextAfterSelection() {
        if (this._selected.vm) { this._enter(STATES.ASK_VM); return; }
        if (this._selected.k8s) { this._enter(STATES.ASK_K8S); return; }
        if (this._selected.storage) { this._enter(STATES.ASK_STORAGE); return; }
    }

    /** After confirming a service section, go to the next selected one or calculate. */
    _nextAfter(completed) {
        const s = this._selected;
        if (completed === "vm") {
            if (s.k8s) { this._enter(STATES.ASK_K8S); return; }
            if (s.storage) { this._enter(STATES.ASK_STORAGE); return; }
        }
        if (completed === "k8s") {
            if (s.storage) { this._enter(STATES.ASK_STORAGE); return; }
        }
        // All selected services confirmed — calculate
        this._enter(STATES.CALCULATE);
    }

    // ─── Calculation ─────────────────────────────────────────────────────────
    _calculate() {
        // SSOT §8: unselected services contribute 0
        const vmResult = this._selected.vm ? calcVM(this._data.vm) : ZERO_VM;
        const k8sResult = this._selected.k8s ? calcKubernetes(this._data.k8s) : ZERO_K8S;
        const storageResult = this._selected.storage ? calcStorage(this._data.storage) : ZERO_STORAGE;
        const totals = calcGrandTotal(vmResult, k8sResult, storageResult);

        this._onRenderResults({ vmResult, k8sResult, storageResult, totals, selected: this._selected });
        this._enter(STATES.DONE);
    }

    // ─── UI helpers ──────────────────────────────────────────────────────────
    _bot(html) { this._onMessage(html, true); }
    _user(html) { this._onMessage(html, false); }
    _showErrors(errors) {
        this._bot("⚠️ Please fix the following:\n<ul>" + errors.map(e => `<li>${e}</li>`).join("") + "</ul>");
    }

    // ─── Type coercions ───────────────────────────────────────────────────────
    _int(v) { const n = parseInt(v, 10); return isNaN(n) ? NaN : n; }
    _float(v) { const n = parseFloat(v); return isNaN(n) ? NaN : n; }
}
