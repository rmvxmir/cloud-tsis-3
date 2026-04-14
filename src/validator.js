/**
 * CFO Bot — Validator (v2)
 * SSOT: cfo-bot-ssot-cloud.md §4.5, §5.6, §6.7, §7, §14
 *
 * v2 change: validation applies only to SELECTED services (SSOT §7).
 * Unselected services must not trigger validation errors.
 */

"use strict";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isNonNegativeInt(v) { return Number.isInteger(v) && v >= 0; }
function isPositiveInt(v) { return Number.isInteger(v) && v > 0; }
function isPositiveNumber(v) { return typeof v === "number" && isFinite(v) && v > 0; }
function isNonNegativeNum(v) { return typeof v === "number" && isFinite(v) && v >= 0; }

// ─── Service Selection (SSOT §7) ─────────────────────────────────────────────

/**
 * At least one service must be selected.
 * @param {{ vm: boolean, k8s: boolean, storage: boolean }} selected
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateServiceSelection(selected) {
    if (!selected.vm && !selected.k8s && !selected.storage) {
        return { valid: false, errors: ["At least one service category must be selected."] };
    }
    return { valid: true, errors: [] };
}

// ─── Service 1: Virtual Machines (SSOT §4.5) ─────────────────────────────────

/**
 * Only called when VM service is selected.
 * @param {object} p
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateVM(p) {
    const errors = [];

    if (!isNonNegativeInt(p.vm_count)) {
        errors.push("VM count must be 0 or greater.");
    }

    if (p.vm_count > 0) {
        if (!isPositiveInt(p.cpu_cores)) errors.push("CPU cores must be a positive integer.");
        if (!isPositiveNumber(p.ram_gb)) errors.push("RAM must be greater than 0.");
        if (!isNonNegativeNum(p.nvme_gb)) errors.push("NVMe disk size must be 0 or greater.");
        if (!isNonNegativeNum(p.hdd_gb)) errors.push("HDD disk size must be 0 or greater.");
        if (isNonNegativeNum(p.nvme_gb) && isNonNegativeNum(p.hdd_gb)) {
            if (p.nvme_gb + p.hdd_gb <= 0) errors.push("At least one VM disk must be specified.");
        }
    } else {
        if (p.nvme_gb !== undefined && !isNonNegativeNum(p.nvme_gb)) errors.push("NVMe disk size must be 0 or greater.");
        if (p.hdd_gb !== undefined && !isNonNegativeNum(p.hdd_gb)) errors.push("HDD disk size must be 0 or greater.");
    }

    return { valid: errors.length === 0, errors };
}

// ─── Service 2: Virtual Kubernetes Clusters (SSOT §5.6) ──────────────────────

/**
 * Only called when K8s service is selected.
 * @param {object} p
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateKubernetes(p) {
    const errors = [];
    const VALID_DISK_TYPES = ["nvme", "hdd"];

    if (!isPositiveInt(p.master_count)) errors.push("Master node count must be at least 1.");
    if (!isPositiveInt(p.master_cpu_cores)) errors.push("Master CPU cores must be a positive integer.");
    if (!isPositiveNumber(p.master_ram_gb)) errors.push("Master RAM must be greater than 0.");
    if (!isPositiveNumber(p.master_disk_gb)) errors.push("Master disk size must be greater than 0.");
    if (!VALID_DISK_TYPES.includes(p.master_disk_type)) errors.push("Disk type must be either nvme or hdd.");

    if (!isNonNegativeInt(p.worker_count)) errors.push("Worker count must be 0 or greater.");
    if (!isPositiveInt(p.worker_cpu_cores)) errors.push("Worker CPU cores must be a positive integer.");
    if (!isPositiveNumber(p.worker_ram_gb)) errors.push("Worker RAM must be greater than 0.");
    if (!isPositiveNumber(p.worker_disk_gb)) errors.push("Worker disk size must be greater than 0.");
    if (!VALID_DISK_TYPES.includes(p.worker_disk_type)) errors.push("Worker disk type must be either nvme or hdd.");

    return { valid: errors.length === 0, errors };
}

// ─── Service 3: Cloud Storage (SSOT §6.7) ────────────────────────────────────

/**
 * Only called when Storage service is selected.
 * @param {object} p
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStorage(p) {
    const errors = [];
    if (!isNonNegativeNum(p.storage_gb)) errors.push("Storage volume must be 0 or greater.");
    if (!isNonNegativeInt(p.write_requests)) errors.push("Write requests must be 0 or greater.");
    if (!isNonNegativeInt(p.read_requests)) errors.push("Read requests must be 0 or greater.");
    return { valid: errors.length === 0, errors };
}
