# CFO Bot — Test Specification

**Version**: 1.0 | **SSOT Reference**: `cfo-bot-ssot-ps-cloud-inspired.md`

All test cases are derived exclusively from the SSOT. Expected values are computed from the formulas in §4–§7. Where the SSOT provides an explicit expected value (§14), those values are used verbatim, and any deviation in the implementation is a bug.

---

## Test Runner

```bash
node src/test.js
```

The test script uses `console.assert()` with descriptive labels. It exits with code `1` if any assertion fails.

---

## 1. Pricing Engine — Virtual Machines (SSOT §4)

### Formula under test (§4.4)
```
vm_unit_cost = (cpu × 5500) + (ram × 1500) + (nvme × 140) + (hdd × 20) + (white_ip ? 2500 : 0)
vm_total_cost = vm_count × vm_unit_cost
```

---

#### TC-VM-01 — SSOT §14 sample (canonical)

| Input | Value |
|---|---|
| vm_count | 2 |
| cpu_cores | 2 |
| ram_gb | 4 |
| nvme_gb | 50 |
| hdd_gb | 100 |
| white_ip_enabled | true |

| Expected Output | Value |
|---|---|
| unitCost | **28,500 KZT** |
| totalCost | **57,000 KZT** |

**Derivation**:
```
(2×5500) + (4×1500) + (50×140) + (100×20) + 2500
= 11000 + 6000 + 7000 + 2000 + 2500 = 28500
28500 × 2 = 57000
```

---

#### TC-VM-02 — No white IP

| Input | Value |
|---|---|
| vm_count | 1 |
| cpu_cores | 4 |
| ram_gb | 8 |
| nvme_gb | 100 |
| hdd_gb | 0 |
| white_ip_enabled | **false** |

| Expected | Value |
|---|---|
| unitCost | **38,000 KZT** |
| totalCost | **38,000 KZT** |

**Derivation**:
```
(4×5500) + (8×1500) + (100×140) + (0×20) + 0
= 22000 + 12000 + 14000 + 0 + 0 = 48000
```
> **Correction**: `48,000 KZT` — 4×5500=22000, 8×1500=12000, 100×140=14000 → **unitCost = 48,000**

---

#### TC-VM-03 — HDD-only disk

| Input | Value |
|---|---|
| vm_count | 3 |
| cpu_cores | 1 |
| ram_gb | 2 |
| nvme_gb | **0** |
| hdd_gb | 500 |
| white_ip_enabled | false |

**Derivation**:
```
(1×5500) + (2×1500) + (0×140) + (500×20) + 0
= 5500 + 3000 + 0 + 10000 + 0 = 18500
18500 × 3 = 55500
```

| Expected | Value |
|---|---|
| unitCost | **18,500 KZT** |
| totalCost | **55,500 KZT** |

---

#### TC-VM-04 — Zero VMs

| Input | Value |
|---|---|
| vm_count | **0** |
| (other fields) | any |

| Expected | Value |
|---|---|
| unitCost | any |
| totalCost | **0 KZT** |

**Rule**: `0 × anything = 0`. vm_count=0 is valid (SSOT §4.5).

---

#### TC-VM-05 — White IP contribution only

Set all disk/cpu/ram to minimum, white_ip_enabled = true, vm_count = 1:

| Input | Value |
|---|---|
| vm_count | 1 |
| cpu_cores | 1 |
| ram_gb | 1 |
| nvme_gb | 1 |
| hdd_gb | 0 |
| white_ip_enabled | true |

**Derivation**: `5500 + 1500 + 140 + 0 + 2500 = 9640`

| Expected | Value |
|---|---|
| unitCost | **9,640 KZT** |
| totalCost | **9,640 KZT** |

---

## 2. Pricing Engine — Kubernetes (SSOT §5)

### Formula under test (§5.5)
```
master_unit = (master_cpu × 5500) + (master_ram × 1500) + (master_disk × disk_rate)
worker_unit = (worker_cpu × 5500) + (worker_ram × 1500) + (worker_disk × disk_rate)
disk_rate: nvme=140, hdd=20
k8s_total = master_count × master_unit + worker_count × worker_unit
```

---

#### TC-K8S-01 — SSOT §14 sample (canonical)

| Input | Value |
|---|---|
| master_count | 1 |
| master_cpu_cores | 2 |
| master_ram_gb | 4 |
| master_disk_type | **nvme** |
| master_disk_gb | 40 |
| worker_count | 2 |
| worker_cpu_cores | 2 |
| worker_ram_gb | 4 |
| worker_disk_type | **hdd** |
| worker_disk_gb | 80 |

**Derivation**:
```
master_unit = (2×5500) + (4×1500) + (40×140) = 11000 + 6000 + 5600 = 22600
master_total = 1 × 22600 = 22600

worker_unit = (2×5500) + (4×1500) + (80×20) = 11000 + 6000 + 1600 = 18600
worker_total = 2 × 18600 = 37200

k8s_total = 22600 + 37200 = 59800
```

| Expected | Value |
|---|---|
| masterUnitCost | **22,600 KZT** |
| masterTotal | **22,600 KZT** |
| workerUnitCost | **18,600 KZT** |
| workerTotal | **37,200 KZT** |
| totalCost | **59,800 KZT** |

---

#### TC-K8S-02 — NVMe workers

| Input | Value |
|---|---|
| master_count | 3 |
| master_cpu_cores | 4 |
| master_ram_gb | 8 |
| master_disk_type | nvme |
| master_disk_gb | 100 |
| worker_count | 5 |
| worker_cpu_cores | 8 |
| worker_ram_gb | 16 |
| worker_disk_type | **nvme** |
| worker_disk_gb | 200 |

**Derivation**:
```
master_unit = (4×5500)+(8×1500)+(100×140) = 22000+12000+14000 = 48000
master_total = 3 × 48000 = 144000

worker_unit = (8×5500)+(16×1500)+(200×140) = 44000+24000+28000 = 96000
worker_total = 5 × 96000 = 480000

k8s_total = 144000 + 480000 = 624000
```

| Expected | Value |
|---|---|
| masterUnitCost | **48,000 KZT** |
| masterTotal | **144,000 KZT** |
| workerUnitCost | **96,000 KZT** |
| workerTotal | **480,000 KZT** |
| totalCost | **624,000 KZT** |

---

#### TC-K8S-03 — Zero workers (masters only)

| Input | Value |
|---|---|
| master_count | 1 |
| master_cpu_cores | 2 |
| master_ram_gb | 4 |
| master_disk_type | hdd |
| master_disk_gb | 50 |
| **worker_count** | **0** |

**Derivation**:
```
master_unit = (2×5500)+(4×1500)+(50×20) = 11000+6000+1000 = 18000
master_total = 1 × 18000 = 18000
worker_total = 0 × anything = 0
k8s_total = 18000
```

| Expected | Value |
|---|---|
| masterTotal | **18,000 KZT** |
| workerTotal | **0 KZT** |
| totalCost | **18,000 KZT** |

---

#### TC-K8S-04 — HDD disk rate vs NVMe disk rate correctness

Same config, only disk type differs:

**Config A** (NVMe, 100 GB): `100 × 140 = 14,000`
**Config B** (HDD, 100 GB): `100 × 20 = 2,000`

Difference must be exactly `12,000 KZT` per node.

---

#### TC-K8S-05 — No cluster management fee (SSOT §5.7)

Verify: `k8s_total = master_total + worker_total` — no additional surcharge.
Any value beyond `master_total + worker_total` in totalCost is a bug.

---

## 3. Pricing Engine — Cloud Storage (SSOT §6)

### Formula under test (§6.5–§6.6)
```
write_blocks = ceil(write_requests / 1000)
read_blocks  = ceil(read_requests  / 10000)
storage_cost = storage_gb × 12
write_cost   = write_blocks × 3
read_cost    = read_blocks  × 3
total        = storage_cost + write_cost + read_cost
```

---

#### TC-ST-01 — SSOT §14 sample (canonical)

| Input | Value |
|---|---|
| storage_gb | 500 |
| write_requests | 20,000 |
| read_requests | 250,000 |

**Derivation**:
```
storage_cost = 500 × 12 = 6000
write_blocks = ceil(20000/1000) = 20 → write_cost = 20 × 3 = 60
read_blocks  = ceil(250000/10000) = 25 → read_cost = 25 × 3 = 75
total = 6000 + 60 + 75 = 6135
```

| Expected | Value |
|---|---|
| volumeCost | **6,000 KZT** |
| writeCost | **60 KZT** |
| readCost | **75 KZT** |
| totalCost | **6,135 KZT** |

---

#### TC-ST-02 — Ceiling division (partial write block)

| Input | Value |
|---|---|
| storage_gb | 0 |
| write_requests | **1** |
| read_requests | 0 |

**Derivation**: `ceil(1/1000) = 1 → 1 × 3 = 3 KZT`

| Expected | Value |
|---|---|
| writeCost | **3 KZT** (minimum 1 block) |

> [!IMPORTANT]
> Even 1 write request incurs 3 KZT (SSOT §6.5 — billing in blocks).

---

#### TC-ST-03 — Ceiling division (partial read block)

| Input | Value |
|---|---|
| storage_gb | 0 |
| write_requests | 0 |
| read_requests | **1** |

**Derivation**: `ceil(1/10000) = 1 → 1 × 3 = 3 KZT`

| Expected | Value |
|---|---|
| readCost | **3 KZT** (minimum 1 block) |

---

#### TC-ST-04 — Exactly on block boundary (write)

| Input | write_requests = 1,000 |
|---|---|
| Expected | `ceil(1000/1000) = 1` → **3 KZT** |

| Input | write_requests = 1,001 |
|---|---|
| Expected | `ceil(1001/1000) = 2` → **6 KZT** |

---

#### TC-ST-05 — Exactly on block boundary (read)

| Input | read_requests = 10,000 |
|---|---|
| Expected | `ceil(10000/10000) = 1` → **3 KZT** |

| Input | read_requests = 10,001 |
|---|---|
| Expected | `ceil(10001/10000) = 2` → **6 KZT** |

---

#### TC-ST-06 — Zero everything

| Input | storage_gb=0, write_requests=0, read_requests=0 |
|---|---|
| Expected | **0 KZT** total |

---

#### TC-ST-07 — Large volume, no requests

| Input | Value |
|---|---|
| storage_gb | 10,000 |
| write_requests | 0 |
| read_requests | 0 |

**Expected**: `10000 × 12 = 120,000 KZT`

---

## 4. Grand Total (SSOT §7)

### TC-GT-01 — SSOT §14 full sample

| Service | Expected |
|---|---|
| VM total | 57,000 KZT |
| Kubernetes total | 59,800 KZT |
| Cloud Storage total | 6,135 KZT |
| **Grand Total** | **122,935 KZT** |

Formula: `57000 + 59800 + 6135 = 122935`

---

#### TC-GT-02 — Zero VMs, zero workers, zero storage

All three services at minimum:

| Input | vm_count=0, master_count=1 (minimum), master 1vCPU/1GB/1GB HDD, worker_count=0, storage=0 |
|---|---|
| VM total | 0 KZT |
| K8s total | (1×5500)+(1×1500)+(1×20) = **7,020 KZT** |
| Storage total | 0 KZT |
| **Grand Total** | **7,020 KZT** |

---

## 5. Validator — Virtual Machines (SSOT §4.5)

| TC | Input | Expected result |
|---|---|---|
| VAL-VM-01 | vm_count=-1 | ❌ `VM count must be 0 or greater.` |
| VAL-VM-02 | vm_count=0.5 | ❌ `VM count must be 0 or greater.` (not integer) |
| VAL-VM-03 | vm_count=0 | ✅ valid (zero VMs allowed) |
| VAL-VM-04 | vm_count=1, cpu_cores=0 | ❌ `CPU cores must be a positive integer.` |
| VAL-VM-05 | vm_count=1, cpu_cores=-2 | ❌ `CPU cores must be a positive integer.` |
| VAL-VM-06 | vm_count=1, cpu_cores=2.5 | ❌ `CPU cores must be a positive integer.` |
| VAL-VM-07 | vm_count=1, ram_gb=0 | ❌ `RAM must be greater than 0.` |
| VAL-VM-08 | vm_count=1, nvme_gb=0, hdd_gb=0 | ❌ `At least one VM disk must be specified.` |
| VAL-VM-09 | vm_count=1, nvme_gb=10, hdd_gb=0 | ✅ valid |
| VAL-VM-10 | vm_count=1, nvme_gb=0, hdd_gb=100 | ✅ valid |
| VAL-VM-11 | vm_count=0, nvme_gb=0, hdd_gb=0 | ✅ valid (disk rule only when vm_count > 0) |

---

## 6. Validator — Kubernetes (SSOT §5.6)

| TC | Input | Expected result |
|---|---|---|
| VAL-K8S-01 | master_count=0 | ❌ `Master node count must be at least 1.` |
| VAL-K8S-02 | master_count=1 | ✅ valid |
| VAL-K8S-03 | worker_count=-1 | ❌ `Worker count must be 0 or greater.` |
| VAL-K8S-04 | worker_count=0 | ✅ valid |
| VAL-K8S-05 | master_disk_type="ssd" | ❌ `Disk type must be either nvme or hdd.` |
| VAL-K8S-06 | master_disk_type="NVMe" | ❌ (case-sensitive; must be lowercase `nvme`) |
| VAL-K8S-07 | master_disk_type="nvme" | ✅ valid |
| VAL-K8S-08 | master_disk_type="hdd" | ✅ valid |
| VAL-K8S-09 | master_cpu_cores=0 | ❌ `Master CPU cores must be a positive integer.` |
| VAL-K8S-10 | master_disk_gb=0 | ❌ `Master disk size must be greater than 0.` |
| VAL-K8S-11 | worker_cpu_cores=1.5 | ❌ `Worker CPU cores must be a positive integer.` |

---

## 7. Validator — Cloud Storage (SSOT §6.7)

| TC | Input | Expected result |
|---|---|---|
| VAL-ST-01 | storage_gb=-1 | ❌ `Storage volume must be 0 or greater.` |
| VAL-ST-02 | storage_gb=0 | ✅ valid |
| VAL-ST-03 | storage_gb=0.5 | ✅ valid (float allowed for storage) |
| VAL-ST-04 | write_requests=-1 | ❌ `Write requests must be 0 or greater.` |
| VAL-ST-05 | write_requests=0 | ✅ valid |
| VAL-ST-06 | write_requests=1.5 | ❌ (not integer) |
| VAL-ST-07 | read_requests=-100 | ❌ `Read requests must be 0 or greater.` |
| VAL-ST-08 | read_requests=0 | ✅ valid |

---

## 8. Output Format (SSOT §8)

| TC | Requirement | Test |
|---|---|---|
| OUT-01 | All four line items displayed | Results panel shows VM / K8s / Storage / Total |
| OUT-02 | Sub-breakdowns shown | CPU, RAM, NVMe, HDD, White IP listed under VMs |
| OUT-03 | KZT label on all outputs | Every amount ends in "KZT" |
| OUT-04 | Whole KZT (Math.round) | No decimal points in displayed amounts |
| OUT-05 | Thousands separator | 122935 displayed as `122 935` or `122,935` |

---

## 9. Chatbot Behavior (SSOT §9)

| TC | Scenario | Expected behavior |
|---|---|---|
| BOT-01 | Missing required field | Bot shows specific SSOT §13 error message |
| BOT-02 | Invalid disk type entered | Bot shows `Disk type must be either nvme or hdd.` |
| BOT-03 | Same inputs twice | Same output both times (determinism) |
| BOT-04 | Reset button | Chat clears, results panel resets, FSM returns to GREETING |
| BOT-05 | VM count = 0 + confirm | Proceeds to K8s step without error |

---

## 10. Performance (SSOT §12)

| TC | Requirement | Test |
|---|---|---|
| PERF-01 | Calculation < 3 seconds | Measure time from Confirm → to results rendered |
| PERF-02 | No external API calls | Network tab in DevTools shows zero XHR/fetch on confirm |

---

## Summary — Automated Assertions (node src/test.js)

The test script verifies these values directly:

| Assertion | Expected |
|---|---|
| TC-VM-01 unitCost | 28,500 |
| TC-VM-01 totalCost | 57,000 |
| TC-K8S-01 masterUnitCost | 22,600 |
| TC-K8S-01 masterTotal | 22,600 |
| TC-K8S-01 workerUnitCost | 18,600 |
| TC-K8S-01 workerTotal | 37,200 |
| TC-K8S-01 totalCost | 59,800 |
| TC-ST-01 volumeCost | 6,000 |
| TC-ST-01 writeCost | 60 |
| TC-ST-01 readCost | 75 |
| TC-ST-01 totalCost | 6,135 |
| TC-GT-01 grandTotal | **122,935** |
| VAL-VM-11 vm_count=0 | valid=true |
| VAL-VM-08 no disks | valid=false |
| VAL-K8S-01 master_count=0 | valid=false |
| VAL-K8S-05 ssd type | valid=false |
| VAL-ST-04 negative writes | valid=false |

**All 17 assertions currently pass.**
