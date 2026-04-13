/**
 * CFO Bot — Pricing Engine
 * Single Source of Truth: cfo-bot-ssot-ps-cloud-inspired.md
 *
 * All rates and formulas are strictly derived from SSOT §2, §4, §5, §6, §7.
 * This module is pure: no DOM, no side effects, no external API calls.
 */

"use strict";

// ─── Rates (SSOT §2.1) ──────────────────────────────────────────────────────
const RATES = Object.freeze({
    CPU: 5500,  // KZT per core/month
    RAM: 1500,  // KZT per GB/month
    NVME: 140,  // KZT per GB/month
    HDD: 20,  // KZT per GB/month
    WHITE_IP: 2500,  // KZT per VM/month
    STORAGE_GB: 12,  // KZT per GB/month
    WRITE_PER_1K: 3,  // KZT per 1,000 write-class requests
    READ_PER_10K: 3,  // KZT per 10,000 read-class requests
});

// ─── Service 1: Virtual Machines (SSOT §4) ──────────────────────────────────

/**
 * @param {object} params
 * @param {number} params.vm_count
 * @param {number} params.cpu_cores
 * @param {number} params.ram_gb
 * @param {number} params.nvme_gb
 * @param {number} params.hdd_gb
 * @param {boolean} params.white_ip_enabled
 * @returns {{ unitCost: number, totalCost: number,
 *             breakdown: { cpu: number, ram: number, nvme: number,
 *                          hdd: number, whiteIp: number } }}
 */
export function calcVM({ vm_count, cpu_cores, ram_gb, nvme_gb, hdd_gb, white_ip_enabled }) {
    const cpu = cpu_cores * RATES.CPU;
    const ram = ram_gb * RATES.RAM;
    const nvme = nvme_gb * RATES.NVME;
    const hdd = hdd_gb * RATES.HDD;
    const whiteIp = white_ip_enabled ? RATES.WHITE_IP : 0;

    const unitCost = cpu + ram + nvme + hdd + whiteIp;   // SSOT §4.4
    const totalCost = vm_count * unitCost;                  // SSOT §4.4

    return { unitCost, totalCost, breakdown: { cpu, ram, nvme, hdd, whiteIp } };
}

// ─── Service 2: Virtual Kubernetes Clusters (SSOT §5) ───────────────────────

/**
 * Resolve disk rate from disk_type string. (SSOT §5.4)
 * @param {"nvme"|"hdd"} diskType
 * @returns {number}
 */
function diskRate(diskType) {
    return diskType === "nvme" ? RATES.NVME : RATES.HDD;
}

/**
 * @param {object} params
 * @param {number} params.master_count
 * @param {number} params.master_cpu_cores
 * @param {number} params.master_ram_gb
 * @param {"nvme"|"hdd"} params.master_disk_type
 * @param {number} params.master_disk_gb
 * @param {number} params.worker_count
 * @param {number} params.worker_cpu_cores
 * @param {number} params.worker_ram_gb
 * @param {"nvme"|"hdd"} params.worker_disk_type
 * @param {number} params.worker_disk_gb
 * @returns {{ masterUnitCost: number, masterTotal: number,
 *             workerUnitCost: number, workerTotal: number,
 *             totalCost: number,
 *             masterBreakdown: object, workerBreakdown: object }}
 */
export function calcKubernetes({
    master_count, master_cpu_cores, master_ram_gb, master_disk_type, master_disk_gb,
    worker_count, worker_cpu_cores, worker_ram_gb, worker_disk_type, worker_disk_gb,
}) {
    // Master node (SSOT §5.5)
    const mCpu = master_cpu_cores * RATES.CPU;
    const mRam = master_ram_gb * RATES.RAM;
    const mDisk = master_disk_gb * diskRate(master_disk_type);
    const masterUnitCost = mCpu + mRam + mDisk;
    const masterTotal = master_count * masterUnitCost;

    // Worker node (SSOT §5.5)
    const wCpu = worker_cpu_cores * RATES.CPU;
    const wRam = worker_ram_gb * RATES.RAM;
    const wDisk = worker_disk_gb * diskRate(worker_disk_type);
    const workerUnitCost = wCpu + wRam + wDisk;
    const workerTotal = worker_count * workerUnitCost;

    // No cluster management fee (SSOT §5.7)
    const totalCost = masterTotal + workerTotal;

    return {
        masterUnitCost, masterTotal,
        workerUnitCost, workerTotal,
        totalCost,
        masterBreakdown: { cpu: mCpu, ram: mRam, disk: mDisk, diskType: master_disk_type },
        workerBreakdown: { cpu: wCpu, ram: wRam, disk: wDisk, diskType: worker_disk_type },
    };
}

// ─── Service 3: Cloud Storage (SSOT §6) ─────────────────────────────────────

/**
 * @param {object} params
 * @param {number} params.storage_gb
 * @param {number} params.write_requests
 * @param {number} params.read_requests
 * @returns {{ volumeCost: number, writeCost: number,
 *             readCost: number, totalCost: number,
 *             writeBlocks: number, readBlocks: number }}
 */
export function calcStorage({ storage_gb, write_requests, read_requests }) {
    const volumeCost = storage_gb * RATES.STORAGE_GB;                 // SSOT §6.6

    const writeBlocks = Math.ceil(write_requests / 1000);             // SSOT §6.5
    const readBlocks = Math.ceil(read_requests / 10000);            // SSOT §6.5

    const writeCost = writeBlocks * RATES.WRITE_PER_1K;               // SSOT §6.6
    const readCost = readBlocks * RATES.READ_PER_10K;               // SSOT §6.6

    const totalCost = volumeCost + writeCost + readCost;              // SSOT §6.6

    return { volumeCost, writeCost, readCost, totalCost, writeBlocks, readBlocks };
}

// ─── Grand Total (SSOT §7) ──────────────────────────────────────────────────

/**
 * @param {object} vmResult     — from calcVM()
 * @param {object} k8sResult    — from calcKubernetes()
 * @param {object} storageResult — from calcStorage()
 * @returns {{ vmCost: number, k8sCost: number,
 *             storageCost: number, grandTotal: number }}
 */
export function calcGrandTotal(vmResult, k8sResult, storageResult) {
    const vmCost = vmResult.totalCost;
    const k8sCost = k8sResult.totalCost;
    const storageCost = storageResult.totalCost;
    const grandTotal = vmCost + k8sCost + storageCost;              // SSOT §7

    return { vmCost, k8sCost, storageCost, grandTotal };
}

// Export rates for reference (read-only)
export { RATES };
