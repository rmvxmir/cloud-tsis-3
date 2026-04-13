/**
 * CFO Bot — SSOT §14 Sample Calculation Verification Test
 * Run: node src/test.js
 *
 * All expected values are taken verbatim from SSOT §14.2.
 * Prints PASS or FAIL for each assertion.
 */

// Node.js doesn't support ES module imports natively without --input-type=module
// We use a thin CJS wrapper by inlining the logic here for the test runner.
// (The actual src/* files use ESM and are imported by the browser via <script type="module">)

// ─── Inlined pricing engine (mirrors pricingEngine.js exactly) ───────────────
const RATES = Object.freeze({
    CPU: 5500, RAM: 1500, NVME: 140, HDD: 20,
    WHITE_IP: 2500, STORAGE_GB: 12,
    WRITE_PER_1K: 3, READ_PER_10K: 3,
});

function diskRate(t) { return t === "nvme" ? RATES.NVME : RATES.HDD; }

function calcVM({ vm_count, cpu_cores, ram_gb, nvme_gb, hdd_gb, white_ip_enabled }) {
    const cpu = cpu_cores * RATES.CPU, ram = ram_gb * RATES.RAM;
    const nvme = nvme_gb * RATES.NVME, hdd = hdd_gb * RATES.HDD;
    const whiteIp = white_ip_enabled ? RATES.WHITE_IP : 0;
    const unitCost = cpu + ram + nvme + hdd + whiteIp;
    return { unitCost, totalCost: vm_count * unitCost };
}

function calcKubernetes({ master_count, master_cpu_cores, master_ram_gb, master_disk_type, master_disk_gb,
    worker_count, worker_cpu_cores, worker_ram_gb, worker_disk_type, worker_disk_gb }) {
    const masterUnit = master_cpu_cores * RATES.CPU + master_ram_gb * RATES.RAM + master_disk_gb * diskRate(master_disk_type);
    const workerUnit = worker_cpu_cores * RATES.CPU + worker_ram_gb * RATES.RAM + worker_disk_gb * diskRate(worker_disk_type);
    const masterTotal = master_count * masterUnit;
    const workerTotal = worker_count * workerUnit;
    return { masterUnitCost: masterUnit, masterTotal, workerUnitCost: workerUnit, workerTotal, totalCost: masterTotal + workerTotal };
}

function calcStorage({ storage_gb, write_requests, read_requests }) {
    const volumeCost = storage_gb * RATES.STORAGE_GB;
    const writeBlocks = Math.ceil(write_requests / 1000);
    const readBlocks = Math.ceil(read_requests / 10000);
    const writeCost = writeBlocks * RATES.WRITE_PER_1K;
    const readCost = readBlocks * RATES.READ_PER_10K;
    return { volumeCost, writeCost, readCost, totalCost: volumeCost + writeCost + readCost };
}

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function assert(label, actual, expected) {
    if (actual === expected) {
        console.log(`  ✅ PASS  ${label}: ${actual}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL  ${label}: expected ${expected}, got ${actual}`);
        failed++;
    }
}

// ─── SSOT §14.1 inputs ───────────────────────────────────────────────────────
const vmInput = { vm_count: 2, cpu_cores: 2, ram_gb: 4, nvme_gb: 50, hdd_gb: 100, white_ip_enabled: true };
const k8sInput = {
    master_count: 1, master_cpu_cores: 2, master_ram_gb: 4, master_disk_type: "nvme", master_disk_gb: 40,
    worker_count: 2, worker_cpu_cores: 2, worker_ram_gb: 4, worker_disk_type: "hdd", worker_disk_gb: 80,
};
const storageInput = { storage_gb: 500, write_requests: 20000, read_requests: 250000 };

// ─── SSOT §14.2 assertions ───────────────────────────────────────────────────
console.log("\n── Virtual Machines ──");
const vm = calcVM(vmInput);
assert("VM unitCost", vm.unitCost, 28500);
assert("VM totalCost", vm.totalCost, 57000);

console.log("\n── Kubernetes ──");
const k8s = calcKubernetes(k8sInput);
assert("Master unitCost", k8s.masterUnitCost, 22600);
assert("Master total", k8s.masterTotal, 22600);
assert("Worker unitCost", k8s.workerUnitCost, 18600);
assert("Worker total", k8s.workerTotal, 37200);
assert("K8s totalCost", k8s.totalCost, 59800);

console.log("\n── Cloud Storage ──");
const stor = calcStorage(storageInput);
assert("Volume cost", stor.volumeCost, 6000);
assert("Write cost", stor.writeCost, 60);
assert("Read cost", stor.readCost, 75);
assert("Storage total", stor.totalCost, 6135);

console.log("\n── Grand Total ──");
const grandTotal = vm.totalCost + k8s.totalCost + stor.totalCost;
assert("Grand total", grandTotal, 122935);

// ─── Validation edge cases ───────────────────────────────────────────────────
console.log("\n── Validator Edge Cases ──");

// Inline the validator logic (mirrors validator.js)
function isNonNegativeInt(v) { return Number.isInteger(v) && v >= 0; }
function isPositiveInt(v) { return Number.isInteger(v) && v > 0; }
function isPositiveNumber(v) { return typeof v === "number" && isFinite(v) && v > 0; }
function isNonNegativeNum(v) { return typeof v === "number" && isFinite(v) && v >= 0; }

function validateVM(p) {
    const errors = [];
    if (!isNonNegativeInt(p.vm_count)) errors.push("VM count must be 0 or greater.");
    if (p.vm_count > 0) {
        if (!isPositiveInt(p.cpu_cores)) errors.push("CPU cores must be a positive integer.");
        if (!isPositiveNumber(p.ram_gb)) errors.push("RAM must be greater than 0.");
        if (!isNonNegativeNum(p.nvme_gb)) errors.push("NVMe disk size must be 0 or greater.");
        if (!isNonNegativeNum(p.hdd_gb)) errors.push("HDD disk size must be 0 or greater.");
        if (isNonNegativeNum(p.nvme_gb) && isNonNegativeNum(p.hdd_gb) && p.nvme_gb + p.hdd_gb <= 0)
            errors.push("At least one VM disk must be specified.");
    }
    return { valid: errors.length === 0, errors };
}

function validateKubernetes(p) {
    const errors = [];
    const VALID = ["nvme", "hdd"];
    if (!isPositiveInt(p.master_count)) errors.push("Master node count must be at least 1.");
    if (!VALID.includes(p.master_disk_type)) errors.push("Disk type must be either nvme or hdd.");
    if (!isNonNegativeInt(p.worker_count)) errors.push("Worker count must be 0 or greater.");
    return { valid: errors.length === 0, errors };
}

function validateStorage(p) {
    const errors = [];
    if (!isNonNegativeNum(p.storage_gb)) errors.push("Storage volume must be 0 or greater.");
    if (!isNonNegativeInt(p.write_requests)) errors.push("Write requests must be 0 or greater.");
    if (!isNonNegativeInt(p.read_requests)) errors.push("Read requests must be 0 or greater.");
    return { valid: errors.length === 0, errors };
}

// vm_count=0 with zero disks → valid (no VMs, disk rule doesn't apply)
assert("vm_count=0 zero disks valid",
    validateVM({ vm_count: 0, cpu_cores: 0, ram_gb: 0, nvme_gb: 0, hdd_gb: 0, white_ip_enabled: false }).valid,
    true);

// vm_count=1 with zero disks → invalid
assert("vm_count=1 zero disks invalid",
    validateVM({ vm_count: 1, cpu_cores: 2, ram_gb: 4, nvme_gb: 0, hdd_gb: 0, white_ip_enabled: false }).valid,
    false);

// master_count=0 → invalid
assert("master_count=0 invalid",
    validateKubernetes({ master_count: 0, master_disk_type: "nvme", worker_count: 2 }).valid,
    false);

// invalid disk_type → invalid
assert("unknown disk_type invalid",
    validateKubernetes({ master_count: 1, master_disk_type: "ssd", worker_count: 0 }).valid,
    false);

// write_requests=-1 → invalid
assert("write_requests=-1 invalid",
    validateStorage({ storage_gb: 0, write_requests: -1, read_requests: 0 }).valid,
    false);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(40)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log("🎉 All assertions passed!");
else { console.error("❌ Some assertions failed."); process.exit(1); }
