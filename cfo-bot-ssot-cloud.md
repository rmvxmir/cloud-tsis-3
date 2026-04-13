# CFO Bot — System Specification (SSOT)

## 1. Document Purpose

This document defines the **Single Source of Truth (SSOT)** for the CFO Bot web application.

The CFO Bot estimates **monthly cloud costs** for a simplified PS Cloud–inspired infrastructure model. The calculator supports three service categories only:

1. Virtual Machines
2. Virtual Kubernetes Clusters
3. Cloud Storage

This document is a specification, not a brainstorming prompt. If implementation, tests, UI behavior, or AI-generated artifacts conflict with this document, this document takes priority.

---

## 2. Pricing Philosophy

The calculator is **inspired by real public cloud pricing** published by PS Cloud Services, but prices are intentionally **rounded** to keep the model simple, deterministic, and testable.

### 2.1 Source-Inspired Baseline

The simplified monthly rates used in this specification are derived from publicly published PS Cloud resource prices:

- CPU: **5,440 KZT / core / month** → rounded to **5,500 KZT**
- RAM: **1,450 KZT / GB / month** → rounded to **1,500 KZT**
- NVMe disk: **142 KZT / GB / month** → rounded to **140 KZT**
- HDD disk: **21 KZT / GB / month** → rounded to **20 KZT**
- Floating / white IP: **2,500 KZT / month** → kept as **2,500 KZT**
- Universal Object Storage volume: **12.10 KZT / GB / month** → rounded to **12 KZT**
- Universal Object Storage PUT/LIST/COPY: **2.95 KZT / 1,000 requests** → rounded to **3 KZT / 1,000 requests**
- Universal Object Storage GET: **2.95 KZT / 10,000 requests** → rounded to **3 KZT / 10,000 requests**

All prices in this specification are in **KZT per month**.

---

## 3. System Scope

### 3.1 In Scope

The system must support cost estimation for:

- standalone virtual machines,
- Kubernetes clusters with separately configurable master and worker node groups,
- cloud object storage.

### 3.2 Out of Scope

The system must **not** calculate or estimate:

- managed databases,
- load balancers,
- CDN,
- outbound bandwidth for VMs or Kubernetes,
- backup services,
- snapshot pricing,
- discounts, reserved capacity, promos, taxes by legal entity,
- region-based pricing differences,
- autoscaling simulation,
- support plan pricing.

---

## 4. Service 1 — Virtual Machines

### 4.1 Description

A Virtual Machine (VM) is a standalone cloud server.

### 4.2 Supported User Inputs

For Virtual Machines, the user must be able to specify:

- `vm_count` — number of virtual machines
- `cpu_cores` — CPU cores per VM
- `ram_gb` — RAM in GB per VM
- `nvme_gb` — NVMe disk size in GB per VM
- `hdd_gb` — HDD disk size in GB per VM
- `white_ip_enabled` — whether a white/floating IP is attached to each VM

### 4.3 Pricing Rates

- CPU: **5,500 KZT per core per month**
- RAM: **1,500 KZT per GB per month**
- NVMe disk: **140 KZT per GB per month**
- HDD disk: **20 KZT per GB per month**
- White IP: **2,500 KZT per VM per month**

### 4.4 Calculation Formula

Per VM:

```text
vm_unit_cost =
  (cpu_cores × 5500)
  + (ram_gb × 1500)
  + (nvme_gb × 140)
  + (hdd_gb × 20)
  + (white_ip_enabled ? 2500 : 0)
```

Total VM cost:

```text
vm_total_cost = vm_count × vm_unit_cost
```

### 4.5 Validation Rules

- `vm_count` must be an integer greater than or equal to 0
- `cpu_cores` must be an integer greater than 0 when `vm_count > 0`
- `ram_gb` must be a number greater than 0 when `vm_count > 0`
- `nvme_gb` must be a number greater than or equal to 0
- `hdd_gb` must be a number greater than or equal to 0
- At least one disk must be present when `vm_count > 0`:

```text
nvme_gb + hdd_gb > 0
```

---

## 5. Service 2 — Virtual Kubernetes Clusters

### 5.1 Description

A Virtual Kubernetes Cluster consists of:

- one master node group,
- one worker node group.

The user must configure the size of each node type and the number of nodes in each group.

### 5.2 Supported User Inputs

For Kubernetes, the user must be able to specify:

#### Master group

- `master_count`
- `master_cpu_cores`
- `master_ram_gb`
- `master_disk_type` — `nvme` or `hdd`
- `master_disk_gb`

#### Worker group

- `worker_count`
- `worker_cpu_cores`
- `worker_ram_gb`
- `worker_disk_type` — `nvme` or `hdd`
- `worker_disk_gb`

### 5.3 Pricing Rates

Node pricing uses the same rounded infrastructure unit rates as Virtual Machines:

- CPU: **5,500 KZT per core per month**
- RAM: **1,500 KZT per GB per month**
- NVMe disk: **140 KZT per GB per month**
- HDD disk: **20 KZT per GB per month**

### 5.4 Disk Rate Resolution

For any Kubernetes node:

```text
if disk_type = nvme -> disk_rate = 140
if disk_type = hdd  -> disk_rate = 20
```

### 5.5 Calculation Formula

Master node unit cost:

```text
master_unit_cost =
  (master_cpu_cores × 5500)
  + (master_ram_gb × 1500)
  + (master_disk_gb × master_disk_rate)
```

Master group cost:

```text
master_total_cost = master_count × master_unit_cost
```

Worker node unit cost:

```text
worker_unit_cost =
  (worker_cpu_cores × 5500)
  + (worker_ram_gb × 1500)
  + (worker_disk_gb × worker_disk_rate)
```

Worker group cost:

```text
worker_total_cost = worker_count × worker_unit_cost
```

Kubernetes total cost:

```text
kubernetes_total_cost = master_total_cost + worker_total_cost
```

### 5.6 Validation Rules

- `master_count` must be an integer greater than or equal to 1
- `worker_count` must be an integer greater than or equal to 0
- all CPU core values must be integers greater than 0
- all RAM values must be numbers greater than 0
- all disk values must be numbers greater than 0
- `master_disk_type` and `worker_disk_type` must be either `nvme` or `hdd`

### 5.7 Pricing Interpretation Rule

This version of the calculator assumes Kubernetes cost is driven by the configured node resources only.

There is **no separate cluster management fee** in this version.

---

## 6. Service 3 — Cloud Storage

### 6.1 Description

Cloud Storage represents universal object storage.

### 6.2 Supported User Inputs

To keep the calculator close to real public object-storage billing, the system must support:

- `storage_gb` — stored data volume in GB
- `write_requests` — number of write-class requests per month
- `read_requests` — number of read-class requests per month

### 6.3 Request Classes

The pricing model distinguishes request types as follows:

- **write-class requests**: PUT, LIST, COPY and similar
- **read-class requests**: GET and similar

### 6.4 Pricing Rates

- Stored volume: **12 KZT per GB per month**
- Write-class requests: **3 KZT per 1,000 requests**
- Read-class requests: **3 KZT per 10,000 requests**

### 6.5 Billing Block Rule

Requests are billed in blocks:

```text
write_request_blocks = ceil(write_requests / 1000)
read_request_blocks  = ceil(read_requests / 10000)
```

### 6.6 Calculation Formula

```text
storage_volume_cost = storage_gb × 12
write_request_cost  = write_request_blocks × 3
read_request_cost   = read_request_blocks × 3
```

Cloud Storage total cost:

```text
cloud_storage_total_cost =
  storage_volume_cost
  + write_request_cost
  + read_request_cost
```

### 6.7 Validation Rules

- `storage_gb` must be a number greater than or equal to 0
- `write_requests` must be an integer greater than or equal to 0
- `read_requests` must be an integer greater than or equal to 0

---

## 7. Final Monthly Total

The final estimated monthly cost must be calculated as:

```text
grand_total =
  vm_total_cost
  + kubernetes_total_cost
  + cloud_storage_total_cost
```

---

## 8. Output Requirements

For every successful calculation, the system must return:

1. VM monthly cost
2. Kubernetes monthly cost
3. Cloud Storage monthly cost
4. Final monthly total

The result must be itemized and human-readable.

### 8.1 Minimum Output Structure

```text
Virtual Machines: <amount> KZT/month
Kubernetes Cluster: <amount> KZT/month
Cloud Storage: <amount> KZT/month
Total: <amount> KZT/month
```

### 8.2 Recommended Detailed Output Structure

The UI should also show sub-breakdowns, for example:

- VM: CPU, RAM, NVMe, HDD, white IP
- Kubernetes: master group, worker group
- Cloud Storage: storage volume, write requests, read requests

---

## 9. Chatbot Behavior

### 9.1 Required Behavior

The bot must:

- accept structured inputs through UI controls and/or conversational prompts,
- ask follow-up questions when required values are missing,
- reject invalid values,
- return deterministic cost calculations,
- never invent unsupported services or pricing rules.

### 9.2 Prohibited Behavior

The bot must not:

- guess hidden discounts,
- hallucinate unsupported service options,
- use external live APIs during the calculation step,
- change prices dynamically.

---

## 10. UI / UX Requirements

The final web app must include:

- a chat-style interaction area,
- a visible form or structured input flow,
- a results panel with cost breakdown,
- a reset button,
- clear KZT labels on all outputs.

### 10.1 UX Goals

The UI must be:

- simple,
- readable,
- mobile-friendly,
- fast enough for repeated recalculation.

---

## 11. Technical Constraints

- The frontend must be deployed to **Firebase Hosting**.
- Any backend logic, if required, must use **serverless Firebase Functions**.
- The pricing engine must be deterministic.
- The same inputs must always produce the same outputs.

---

## 12. Non-Functional Requirements

- Response time for a completed calculation should be below **3 seconds**.
- Validation errors must be readable and specific.
- Monetary calculations must be rounded to whole KZT in the final displayed result.

---

## 13. Suggested Validation Messages

Examples:

- `VM count must be 0 or greater.`
- `CPU cores must be a positive integer.`
- `At least one VM disk must be specified.`
- `Master node count must be at least 1.`
- `Disk type must be either nvme or hdd.`
- `Read requests must be 0 or greater.`

---

## 14. Sample Calculation

### 14.1 Example Input

#### Virtual Machines

- `vm_count = 2`
- `cpu_cores = 2`
- `ram_gb = 4`
- `nvme_gb = 50`
- `hdd_gb = 100`
- `white_ip_enabled = true`

#### Kubernetes

- `master_count = 1`
- `master_cpu_cores = 2`
- `master_ram_gb = 4`
- `master_disk_type = nvme`
- `master_disk_gb = 40`
- `worker_count = 2`
- `worker_cpu_cores = 2`
- `worker_ram_gb = 4`
- `worker_disk_type = hdd`
- `worker_disk_gb = 80`

#### Cloud Storage

- `storage_gb = 500`
- `write_requests = 20000`
- `read_requests = 250000`

### 14.2 Example Output

VM unit cost:

```text
(2 × 5500) + (4 × 1500) + (50 × 140) + (100 × 20) + 2500
= 11000 + 6000 + 7000 + 2000 + 2500
= 28500
```

VM total cost:

```text
2 × 28500 = 57000
```

Master unit cost:

```text
(2 × 5500) + (4 × 1500) + (40 × 140)
= 11000 + 6000 + 5600
= 22600
```

Master total cost:

```text
1 × 22600 = 22600
```

Worker unit cost:

```text
(2 × 5500) + (4 × 1500) + (80 × 20)
= 11000 + 6000 + 1600
= 18600
```

Worker total cost:

```text
2 × 18600 = 37200
```

Kubernetes total cost:

```text
22600 + 37200 = 59800
```

Cloud Storage volume cost:

```text
500 × 12 = 6000
```

Write request cost:

```text
ceil(20000 / 1000) × 3 = 20 × 3 = 60
```

Read request cost:

```text
ceil(250000 / 10000) × 3 = 25 × 3 = 75
```

Cloud Storage total cost:

```text
6000 + 60 + 75 = 6135
```

Grand total:

```text
57000 + 59800 + 6135 = 122935 KZT/month
```

---

## 15. Optional Simplification for Cloud Storage UI

If the team insists on **one request input field only**, the UI may expose a single field called `requests_total`, but this must be documented as a **simplified mode** and not the default.

In simplified mode:

- all requests are treated as read-class requests,
- billing becomes:

```text
request_cost = ceil(requests_total / 10000) × 3
```

This mode is easier for users but less faithful to real pricing.

---

## 16. Final Rule

Implementation plans, test cases, generated code, and deployment outputs must follow this document exactly unless the team explicitly revises this SSOT and records the change.
