# CFO Bot — Test Specification (v2)

**Version**: 2.0 | **SSOT**: `cfo-bot-ssot-cloud.md`

> [!IMPORTANT]
> **v2 addition**: Sections 5 and 6 cover the new optional service selection rules (SSOT §7) and the zero-cost rule for unselected services (SSOT §8).

Run all automated assertions: `node src/test.js` → **32 assertions, 0 failures expected.**

---

## 1. Pricing Engine — Virtual Machines (SSOT §4)

#### TC-VM-01 — SSOT §15 canonical sample

| Input | vm_count=2, cpu=2, ram=4, nvme=50, hdd=100, white_ip=true |
|---|---|
| unitCost | **28,500 KZT** |
| totalCost | **57,000 KZT** |

Derivation: `(2×5500)+(4×1500)+(50×140)+(100×20)+2500 = 28500` → `×2 = 57000`

#### TC-VM-02 — Zero VMs → totalCost = 0

| vm_count=0 | totalCost = **0 KZT** (regardless of per-VM fields) |
|---|---|

#### TC-VM-03 — HDD-only disk

| Input | vm_count=3, cpu=1, ram=2, nvme=0, hdd=500, white_ip=false |
|---|---|
| unitCost | **18,500 KZT** |
| totalCost | **55,500 KZT** |

Derivation: `5500+3000+0+10000+0 = 18500` → `×3 = 55500`

#### TC-VM-04 — No white IP

| Input | vm_count=1, cpu=4, ram=8, nvme=100, hdd=0, white_ip=**false** |
|---|---|
| unitCost | **48,000 KZT** |

Derivation: `22000+12000+14000+0+0 = 48000`

---

## 2. Pricing Engine — Kubernetes (SSOT §5)

#### TC-K8S-01 — SSOT §15 canonical sample

| Input | master: 1×(2cpu/4ram/nvme/40) · worker: 2×(2cpu/4ram/hdd/80) |
|---|---|
| masterUnitCost | **22,600 KZT** |
| masterTotal | **22,600 KZT** |
| workerUnitCost | **18,600 KZT** |
| workerTotal | **37,200 KZT** |
| totalCost | **59,800 KZT** |

#### TC-K8S-02 — Zero workers

| worker_count=0 | workerTotal = **0 KZT** · k8sTotalCost = masterTotal only |
|---|---|

#### TC-K8S-03 — NVMe vs HDD disk rate (SSOT §5.4)

100 GB NVMe: `100×140 = 14,000` · 100 GB HDD: `100×20 = 2,000` → difference = **12,000 KZT/node**

#### TC-K8S-04 — No cluster fee (SSOT §5.7)

`k8s_total = master_total + worker_total` — no surcharge. Any additional value is a bug.

---

## 3. Pricing Engine — Cloud Storage (SSOT §6)

#### TC-ST-01 — SSOT §15 canonical sample

| Input | storage_gb=500, write=20000, read=250000 |
|---|---|
| volumeCost | **6,000 KZT** |
| writeCost | **60 KZT** (ceil(20000/1000)×3) |
| readCost | **75 KZT** (ceil(250000/10000)×3) |
| totalCost | **6,135 KZT** |

#### TC-ST-02 — Ceiling (write block boundary)

| write_requests=1 | writeCost = **3 KZT** (1 block minimum) |
|---|---|
| write_requests=1000 | writeCost = **3 KZT** (exactly 1 block) |
| write_requests=1001 | writeCost = **6 KZT** (2 blocks) |

#### TC-ST-03 — Ceiling (read block boundary)

| read_requests=1 | readCost = **3 KZT** (1 block minimum) |
|---|---|
| read_requests=10000 | readCost = **3 KZT** (exactly 1 block) |
| read_requests=10001 | readCost = **6 KZT** (2 blocks) |

#### TC-ST-04 — Zero everything

| storage_gb=0, write=0, read=0 | totalCost = **0 KZT** |
|---|---|

---

## 4. Grand Total (SSOT §8)

#### TC-GT-01 — All three services selected (SSOT §15)

| VM | K8s | Storage | Grand Total |
|---|---|---|---|
| 57,000 | 59,800 | 6,135 | **122,935 KZT** |

---

## 5. Service Selection Validation (SSOT §7)  ← NEW in v2

| TC | Input | Expected |
|---|---|---|
| SEL-01 | No service selected | ❌ `At least one service category must be selected.` |
| SEL-02 | VM only | ✅ valid |
| SEL-03 | K8s only | ✅ valid |
| SEL-04 | Storage only | ✅ valid |
| SEL-05 | VM + K8s | ✅ valid |
| SEL-06 | VM + Storage | ✅ valid |
| SEL-07 | All three | ✅ valid |

> [!IMPORTANT]
> The system must block calculation and display an error when no service is selected. It must not perform a grand total of 0 — it must reject the request entirely.

---

## 6. Unselected Service = 0 Cost (SSOT §8)  ← NEW in v2

When a service is not selected, its cost must be exactly 0 in the grand total calculation.

| Scenario | Expected grand total |
|---|---|
| Storage only (§15 inputs) | **6,135 KZT** (VM=0, K8s=0, Storage=6135) |
| VM only (§15 inputs) | **57,000 KZT** (VM=57000, K8s=0, Storage=0) |
| K8s only (§15 inputs) | **59,800 KZT** (VM=0, K8s=59800, Storage=0) |

The result cards for unselected services must be hidden in the UI (SSOT §11.1).

---

## 7. Validator — Virtual Machines (SSOT §4.5)

| TC | Input | Expected |
|---|---|---|
| VAL-VM-01 | vm_count=-1 | ❌ `VM count must be 0 or greater.` |
| VAL-VM-02 | vm_count=0 | ✅ valid |
| VAL-VM-03 | vm_count=1, cpu=0 | ❌ `CPU cores must be a positive integer.` |
| VAL-VM-04 | vm_count=1, nvme=0, hdd=0 | ❌ `At least one VM disk must be specified.` |
| VAL-VM-05 | vm_count=0, nvme=0, hdd=0 | ✅ valid (disk rule only when vm_count > 0) |

---

## 8. Validator — Kubernetes (SSOT §5.6)

| TC | Input | Expected |
|---|---|---|
| VAL-K8S-01 | master_count=0 | ❌ `Master node count must be at least 1.` |
| VAL-K8S-02 | disk_type="ssd" | ❌ `Disk type must be either nvme or hdd.` |
| VAL-K8S-03 | disk_type="NVMe" | ❌ (case-sensitive; must be lowercase `nvme`) |
| VAL-K8S-04 | worker_count=0 | ✅ valid |
| VAL-K8S-05 | master_disk_type="nvme" | ✅ valid |

---

## 9. Validator — Cloud Storage (SSOT §6.7)

| TC | Input | Expected |
|---|---|---|
| VAL-ST-01 | storage_gb=-1 | ❌ `Storage volume must be 0 or greater.` |
| VAL-ST-02 | write_requests=-1 | ❌ `Write requests must be 0 or greater.` |
| VAL-ST-03 | read_requests=0 | ✅ valid |

---

## 10. Output Format (SSOT §9)

| TC | Requirement | Test |
|---|---|---|
| OUT-01 | KZT label on all outputs | Every amount ends in "KZT" |
| OUT-02 | Whole KZT | No decimal points displayed |
| OUT-03 | Sub-breakdowns per service | CPU/RAM/disk/IP listed under VMs, etc. |
| OUT-04 | Unselected service cards hidden | Cards absent from results panel when not selected |

---

## 11. Chatbot Behavior (SSOT §10)

| TC | Scenario | Expected |
|---|---|---|
| BOT-01 | No service checked → Confirm | Error: `At least one service category must be selected.` |
| BOT-02 | Storage only selected | VM and K8s forms are never shown |
| BOT-03 | Same inputs twice | Same output (determinism, SSOT §10.2) |
| BOT-04 | Reset button | Chat and results clear; service selection resets |
| BOT-05 | Invalid value in form | Specific SSOT §14 error message shown inline |

---

## Automated Test Summary

| Section | Count |
|---|---|
| Pricing engine (VM, K8s, Storage, Grand Total) | 12 |
| Service selection validation (SSOT §7) | 6 |
| Unselected service = 0 (SSOT §8) | 3 |
| Validator edge cases (VM, K8s, Storage) | 5 |
| Ceiling division edge cases (SSOT §6.5) | 6 |
| **Total** | **32** |
