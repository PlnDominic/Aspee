# ASPEE PHARMACEUTICALS ERP SYSTEM
## Staff User Manual
### Version 2.0 | April 2026

---

> **Prepared for:** All Aspee Pharmaceuticals Staff
> **System:** Aspee Pharma Enterprise Resource Planning (ERP)
> **Currency:** Ghana Cedis (GH₵)
> **Support:** Contact your Super Admin or IT Administrator

---

## TABLE OF CONTENTS

1. [Getting Started — Login & Navigation](#1-getting-started)
2. [Role & Access Guide](#2-role--access-guide)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Procurement Department](#4-procurement-department)
5. [Quality Assurance (QA)](#5-quality-assurance)
6. [Stores Department](#6-stores-department)
7. [Production Department](#7-production-department)
8. [Sales Department](#8-sales-department)
9. [Accounting Department](#9-accounting-department)
10. [Human Resources (HR)](#10-human-resources)
11. [Internal Audit](#11-internal-audit)
12. [Compliance & Regulators](#12-compliance--regulators)
13. [Weekly Reports](#13-weekly-reports)
14. [Settings & Administration (Super Admin)](#14-settings--administration)
15. [Company-Wide Workflow Summary](#15-company-wide-workflow-summary)
16. [Common Tasks Quick Reference](#16-common-tasks-quick-reference)

---

## 1. GETTING STARTED

### 1.1 Accessing the System

1. Open your web browser (Chrome or Edge recommended).
2. Navigate to the Aspee Pharma ERP URL provided by your IT administrator.
3. You will land on the **Login Page**.

### 1.2 Logging In

- Enter your **company email address** and **password**.
- Click **Sign In**.
- If you forget your password, contact your Super Admin to reset it.

> **Note:** If your account does not yet exist in the system, contact the Super Admin to add you under **Settings → User Management**.

### 1.3 The Sidebar Navigation

After login, you will see the **left sidebar**. This is your main navigation panel.

- Click any section heading (e.g., **Procurement**, **Sales**) to expand its sub-menu.
- The active page is highlighted in **blue**.
- Click the **Collapse** button at the bottom of the sidebar to hide labels and save screen space.
- The sidebar only shows sections your **role** is permitted to access.

### 1.4 Common Page Actions

Every page in the system follows the same layout pattern:

| Element | Purpose |
|---------|---------|
| **Page Header** | Title, subtitle, and breadcrumb trail showing where you are |
| **Stat Cards** | Key metrics shown at the top of each section |
| **Data Table** | Searchable list of all records |
| **+ New / Create button** | Opens the form to add a new record |
| **Eye (View) icon** | Opens a read-only detail view |
| **Pencil (Edit) icon** | Opens the record for editing |
| **Trash (Delete) icon** | Deletes the record (with confirmation prompt) |
| **Export button** | Downloads the current data as a CSV file |
| **Send Weekly Report button** | Sends a departmental summary to the Managing Director |

---

## 2. ROLE & ACCESS GUIDE

Each staff member is assigned one role. Below is what each role can access:

| Role | Accessible Modules |
|------|-------------------|
| **Super Admin** | Everything — full system access |
| **Managing Director** | Dashboard, Weekly Reports Review |
| **Sales Manager** | Sales (all), Customers, Weekly Reports |
| **Van Sales Rep** | Sales (invoices, dispatch, receipts), Weekly Reports |
| **Purchasing Manager** | Procurement, Supplier Payments, GRN, Weekly Reports |
| **Store Manager** | Stores (all), Production, Weekly Reports |
| **Production Manager** | Production, Weekly Reports |
| **Quality Assurance** | QA (all), GRN, Compliance, Weekly Reports |
| **Accountant** | Accounting (all), Collections, Supplier Payments, Weekly Reports |
| **HR Manager** | HR (all), Weekly Reports |
| **Internal Auditor** | Internal Audit, Weekly Reports |

> **Important:** If you try to access a page outside your role, the system will automatically redirect you to the Dashboard.

---

## 3. DASHBOARD OVERVIEW

**Path:** Overview (Home Page after Login)

The dashboard gives every staff member a bird's-eye view of company performance at a glance.

### What You Will See

- **Company summary cards** showing key figures across departments.
- Quick links to common tasks.
- Notifications and alerts for low stock, pending approvals, or overdue invoices.

---

## 4. PROCUREMENT DEPARTMENT

**Accessible to:** Super Admin, Purchasing Manager

**Path in Sidebar:** Procurement

### 4.1 Suppliers

**Path:** Procurement → Suppliers

The Suppliers list is your master record of all vendors Aspee Pharmaceuticals does business with.

**To add a new supplier:**
1. Click **+ Add Supplier**.
2. Fill in: Supplier Name, Contact Person, Phone, Email, Address, and Payment Terms.
3. Click **Save**.

**Example Supplier Record:**
| Field | Example Value |
|-------|--------------|
| Supplier Name | Accra Chemicals Ltd |
| Contact Person | Mr. Kwame Asante |
| Phone | 0244 123 456 |
| Email | orders@accrachemicals.com |
| Payment Terms | Net 30 days |

### 4.2 Purchase Orders (POs)

**Path:** Procurement → Purchase Orders

A Purchase Order is a formal request sent to a supplier to purchase goods.

**Stat Cards on this page:**
- **Total POs** — number of all purchase orders
- **Pending Review** — POs awaiting approval
- **Completed** — POs that have been received
- **Total Value** — combined GH₵ value of all POs

**To create a new Purchase Order:**
1. Click **+ Create PO**.
2. Select the **Supplier** from the dropdown.
3. Enter the **PO Number** (e.g., PO-2026-001).
4. Add line items — select Product, enter Quantity, Unit Price, and Unit of measure.
5. Review the total amount.
6. Click **Save**.

**PO Status Lifecycle:**
```
Pending → Approved → Shipped → Received → (Closed)
                                        ↓
                              (Cancelled if rejected)
```

**Approval Rules:**
- POs **under GH₵ 10,000** → Approved at Manager level.
- POs **over GH₵ 10,000** → Require Finance (Accountant) approval.
- Click the **green checkmark** icon on a Pending PO to approve it.

**Example Purchase Order:**

| Field | Value |
|-------|-------|
| PO Number | PO-2026-047 |
| Supplier | Meridian Pharma Supplies, Tema |
| Date | 10 April 2026 |
| Item 1 | Paracetamol API — 500 kg @ GH₵ 120/kg = GH₵ 60,000 |
| Item 2 | Starch (Excipient) — 200 kg @ GH₵ 45/kg = GH₵ 9,000 |
| **Total** | **GH₵ 69,000** |
| Approval Level | Finance (>GH₵ 10,000) |

**To export POs:** Click the **Export** button to download a CSV file of all purchase orders.

**To send a weekly report to the MD:** Click **Send Weekly Report** and confirm.

### 4.3 Requisitions (Purchase Requests)

**Path:** Procurement → Requisitions

These are internal requests from other departments (e.g., Stores or Production) asking Procurement to buy something.

- Stores or Production staff submit a request.
- Purchasing Manager reviews and converts approved requests into formal Purchase Orders.

---

## 5. QUALITY ASSURANCE

**Accessible to:** Super Admin, Quality Assurance Officer

**Path in Sidebar:** Quality Assurance

QA is the gatekeeper of all materials and finished products. Nothing enters Stores without QA sign-off.

### 5.1 QA Overview

**Path:** Quality Assurance → Overview

A dashboard showing the status of all ongoing QA activities — incoming inspections, in-process checks, and finished product releases.

### 5.2 Incoming Materials Inspection

**Path:** Quality Assurance → Incoming Materials

When a supplier delivers goods against a Purchase Order, QA must inspect them before they are accepted into the warehouse.

**Process:**
1. Procurement receives goods and creates a **Goods Receipt Note (GRN)**.
2. QA Officer inspects the delivery.
3. QA Officer records the inspection result in **Incoming Materials**.
4. Status options: **Approved**, **Rejected**, **Quarantine**.

**Fields to record:**
- GRN reference number
- Supplier name
- Product name and batch number
- Quantity received vs. quantity ordered
- Test results (appearance, purity, moisture content, etc.)
- Final QA status

**Example Incoming Inspection:**

| Field | Value |
|-------|-------|
| GRN Number | GRN-2026-022 |
| Supplier | Meridian Pharma Supplies |
| Product | Paracetamol API |
| Batch No | BATCH-PAR-0041 |
| Qty Received | 498 kg (of 500 kg ordered) |
| Appearance | White crystalline powder — Pass |
| Assay | 99.2% — Pass |
| Result | **Approved** |

### 5.3 Goods Receipt Note (GRN)

**Path:** Quality Assurance → Goods Receipt (also accessible under Procurement)

GRN is the official record that goods have been received.

- Created when a supplier delivers goods against a PO.
- Must be linked to the original Purchase Order.
- After QA approval on the GRN items, the approved quantity is added to **Stock Inventory**.

> **Note:** The GRN page is accessible from both the Quality Assurance section and the Procurement area, since both teams interact with it.

### 5.4 In-Process Controls

**Path:** Quality Assurance → In Process Controls

During manufacturing, QA performs checks at defined stages of production to ensure the product is being made correctly.

**Example In-Process Check — Tablet Compression:**

| Check Point | Parameter | Acceptable Range | Result |
|-------------|-----------|-----------------|--------|
| Weight | Average tablet weight | 500 mg ± 5% | 502 mg — Pass |
| Hardness | Tablet hardness | 4–8 kp | 6.2 kp — Pass |
| Disintegration | Disintegration time | < 15 min | 8 min — Pass |
| Appearance | Visual | No defects | Pass |

### 5.5 Finished Products Analysis

**Path:** Quality Assurance → Finished Products

Before any manufactured batch can be released for sale, it must pass QA's final analysis.

**Status options:**
- **Passed** — Product released to Stores inventory.
- **Failed** — Product rejected and quarantined.
- **Quarantine** — Under investigation, awaiting decision.

**To add a Finished Products analysis record:**
1. Click **+ Add Analysis Record**.
2. Select the **Production Order (Job Order)** this batch belongs to.
3. Enter **Product Name**, **Batch Number**, **Analyst Name**, and **Analysis Date**.
4. Record all test results.
5. Set **Overall Status** (Passed / Failed / Quarantine).
6. If passed, set a **Release Date**.
7. Click **Save**.

**Quick Approve:** For batches in Quarantine that have subsequently passed review, click the **green "Approve & Release" button** directly from the table.

**Example Finished Product Record:**

| Field | Value |
|-------|-------|
| Product Name | Paracetamol 500mg Tablets |
| Batch No | BPC-2026-018 |
| Job Order | JO-2026-011 |
| Analyst | Abena Mensah |
| Analysis Date | 05 April 2026 |
| Dissolution | 85% at 30 min — Pass |
| Assay | 98.8% — Pass |
| Microbial | TAMC < 1000 cfu/g — Pass |
| Overall Status | **Passed** |
| Release Date | 07 April 2026 |

### 5.6 Internal Reports

**Path:** Quality Assurance → Internal Reports

QA internal deviation reports, non-conformance records, and corrective action summaries are stored here.

---

## 6. STORES DEPARTMENT

**Accessible to:** Super Admin, Store Manager

**Path in Sidebar:** Stores

The Stores department is the physical custodian of all raw materials, packaging, and finished goods.

### 6.1 Products (Product Master)

**Path:** Stores → Products

This is the master list of every product or material the company handles.

**To add a new product:**
1. Click **+ Add Product**.
2. Fill in all required fields.
3. Click **Save**.

**Key Fields:**

| Field | Description | Example |
|-------|-------------|---------|
| Product Name | Full name of the item | Paracetamol 500mg Tablets |
| SKU | Unique stock-keeping code | PAR-500-TAB |
| Unit | Unit of measurement | Bottles / Kg / Boxes |
| Material Type | Raw Material / Finished Product / Packaging | Finished Product |
| Reorder Level | Minimum stock level before alert triggers | 500 |

> **Tip:** The reorder level is critical. When stock drops to or below this number, the system automatically alerts staff with a low-stock warning.

### 6.2 Stock Inventory

**Path:** Stores → Stock Inventory

This is the real-time view of stock across **all locations** (main warehouse, production floor, sales vans, etc.).

**Stat Cards:**
- **Total Products** — number of distinct products
- **Total Units in Stock** — sum of all units across all locations
- **Low Stock Items** — products at or near their reorder level
- **Out of Stock** — products with zero quantity

**Stock Status Indicators:**
| Status | Meaning |
|--------|---------|
| Adequate | Stock is above reorder level |
| Warning | Stock is between 1× and 1.5× the reorder level |
| Low | Stock is at or below the reorder level |
| Out of Stock | Zero quantity |

**Filtering by Material Type:** Use the tab buttons (All / Raw Material / Finished Product / Packaging) to filter the view.

**Example Stock Inventory Table:**

| Product | SKU | Unit | Warehouse | Van 1 | Total | Reorder Lvl | Status |
|---------|-----|------|-----------|-------|-------|-------------|--------|
| Paracetamol 500mg | PAR-500-TAB | Bottles | 4,200 | 300 | 4,500 | 1,000 | Adequate |
| Amoxicillin 250mg | AMX-250-CAP | Bottles | 180 | 120 | 300 | 500 | Low |
| Vitamin C 200mg | VIT-C-200 | Bottles | 0 | 0 | 0 | 200 | Out of Stock |

> **Action Required:** Items marked **Low** or **Out of Stock** should be reviewed immediately and a Purchase Request raised if needed.

### 6.3 Internal Use

**Path:** Stores → Internal Use

**NEW in v2.0**

This page tracks stock that is consumed internally by the company — not sold to customers, but used for company operations. Recording internal use automatically deducts the quantity from stock and logs a stock movement.

**Purpose categories:**

| Purpose | Example |
|---------|---------|
| Office Use | Packaging materials used by admin |
| Testing / Sampling | Products used for QA samples |
| Staff Consumption | Medicines issued to factory floor workers |
| Company Promotion | Products given out as promotional samples |
| Research & Development | Materials used in R&D |
| Other | Any other internal use |

**To log an internal use:**
1. Click **+ Log Internal Use**.
2. Select the **Product** from the dropdown.
3. Select the **Location** (warehouse, van, etc.) from which stock is taken.
4. Enter the **Quantity**.
5. Select the **Purpose** from the dropdown.
6. Enter a **Reference Number** for traceability.
7. Add any **Notes** (optional).
8. Click **Save**.

> **Important:** Saving an internal use record immediately deducts the quantity from the selected location's stock. This action cannot be automatically reversed — deletion of the record does **not** restore the stock.

**Example Internal Use Record:**

| Field | Value |
|-------|-------|
| Reference | IU-2026-007 |
| Date | 12 April 2026 |
| Product | Paracetamol 500mg Tablets |
| Location | Main Warehouse |
| Quantity | 50 Bottles |
| Purpose | Staff Consumption |
| Notes | Issued to factory floor — health drive |

**Stat Cards:**
- **Total Records** — number of all internal use records
- **Total Units Used** — cumulative units consumed
- **Unique Products** — number of distinct products consumed internally

**To export:** Click the **Export** button to download a CSV of all records.

### 6.4 Material Defects

**Path:** Stores → Material Defects

**NEW in v2.0**

Records defective, broken, contaminated, or damaged materials. When a defect is logged, the affected quantity is automatically written off from stock.

**Defect types:**

| Defect Type | Severity |
|-------------|---------|
| Breakage | Warning |
| Leakage | Warning |
| Spillage | Danger |
| Contamination | Critical |
| Damaged Packaging | Warning |
| Manufacturing Defect | Critical |
| Other | Default |

**To log a material defect:**
1. Click **+ Log Defect**.
2. Select the **Product** affected.
3. Select the **Location** where the defect occurred.
4. Enter the **Quantity** written off.
5. Select the **Defect Type**.
6. Enter the **Batch Number** (important for traceability).
7. Enter a **Reference Number** and any **Notes**.
8. Click **Save**.

> **Important:** Saving a defect record automatically deducts the quantity from stock. Always record defects promptly so inventory figures remain accurate. Deletion of the record does **not** restore stock.

**Stat Cards:**
- **Total Records** — all defect entries
- **Total Units Written Off** — cumulative stock written off due to defects
- **Critical Defects** — count of Contamination or Manufacturing Defect entries (these require escalation)

**Example Material Defect Record:**

| Field | Value |
|-------|-------|
| Reference | DEF-2026-003 |
| Date | 15 April 2026 |
| Product | Amoxicillin 250mg Capsules |
| Location | Main Warehouse |
| Quantity | 30 Bottles |
| Defect Type | Contamination |
| Batch No | BATCH-AMX-0088 |
| Notes | Water ingress — packaging failure during transport |

> **Action:** Critical defects (Contamination / Manufacturing Defect) must be reported to the QA department immediately. File a Non-Conformance report in the Internal Audit module.

### 6.5 Material Expiry

**Path:** Stores → Material Expiry

**NEW in v2.0**

Records materials that have reached or passed their expiry date and must be disposed of. When an expiry record is saved, the quantity is automatically removed from stock.

**Disposal methods:**

| Disposal Method | Description |
|----------------|-------------|
| Destroyed / Incinerated | Completely destroyed on-site |
| Returned to Supplier | Sent back to the original supplier |
| Quarantined | Held pending regulatory decision |
| Donated | Donated to an approved charitable body |
| Disposed via Licensed Waste Handler | Handled by a certified waste contractor |

**To log an expiry write-off:**
1. Click **+ Log Expiry**.
2. Select the **Product**.
3. Select the **Location**.
4. Enter the **Quantity** to write off.
5. Enter the **Batch Number** and the **Expiry Date** shown on the packaging.
6. Select the **Disposal Method**.
7. Enter a **Reference Number** and optional **Notes**.
8. Click **Save**.

> **Important:** Stock is deducted immediately on save. Deletion of the record does **not** restore the stock. Ensure the disposal method is accurate — this is a regulatory record.

**Stat Cards:**
- **Total Records** — all expiry entries
- **Total Units Expired** — cumulative units written off
- **Unique Products Affected** — count of distinct products with expiry events

**Example Material Expiry Record:**

| Field | Value |
|-------|-------|
| Reference | EXP-2026-011 |
| Date | 20 April 2026 |
| Product | Vitamin C 200mg Tablets |
| Location | Main Warehouse |
| Quantity Written Off | 200 Bottles |
| Expiry Date | 31 March 2026 |
| Batch No | BATCH-VIT-C-0031 |
| Disposal | Destroyed / Incinerated |

### 6.6 Sales Movements (Stores View)

**Path:** Stores → Sales Movements

A read-only view of all stock movements caused by sales invoices — showing which products left which van location, when, and against which invoice.

### 6.7 Stock Transfers

**Path:** Stores → Stock Transfers

Used to move stock between locations (e.g., from the Warehouse to the Production Floor).

**To create a transfer:**
1. Click **+ New Transfer**.
2. Select **From Location** and **To Location**.
3. Add the products and quantities to transfer.
4. Click **Save**.

**Example Transfer:**

| Field | Value |
|-------|-------|
| Transfer No | TRF-2026-034 |
| From | Main Warehouse |
| To | Production Floor |
| Product | Paracetamol API — 50 kg |
| Date | 10 April 2026 |

### 6.8 Material Requests

**Path:** Stores → Material Requests

Production raises Material Requests when they need raw materials from Stores for a manufacturing job.

- Store Manager reviews the request.
- If stock is available, the store issues the materials and records the movement.
- If stock is insufficient, a **Purchase Request** is raised.

### 6.9 Purchase Requests

**Path:** Stores → Purchase Requests

When a material is needed but not in stock, the Store Manager raises a Purchase Request. This goes to the Purchasing Manager to create a formal Purchase Order.

### 6.10 QA Reports (Stores View)

**Path:** Stores → QA Reports

Stores staff can view all QA results relevant to received materials and released finished products, without needing full QA module access.

---

## 7. PRODUCTION DEPARTMENT

**Accessible to:** Super Admin, Production Manager, Store Manager

**Path in Sidebar:** Production

### 7.1 Bill of Materials (BOM)

**Path:** Production → Bill of Materials

The BOM defines the exact recipe for producing a finished product — which raw materials are needed, in what quantities, and in what units.

**To create a BOM:**
1. Click **+ New BOM**.
2. Select the **Finished Product** (e.g., Paracetamol 500mg Tablets).
3. Add each raw material component:
   - Material name
   - Quantity required per batch
   - Unit of measure
4. Save.

**Example BOM — Paracetamol 500mg Tablets (Batch of 10,000 tablets):**

| Component | Quantity | Unit |
|-----------|----------|------|
| Paracetamol API | 5.00 | kg |
| Maize Starch | 1.20 | kg |
| Microcrystalline Cellulose | 0.80 | kg |
| Magnesium Stearate | 0.05 | kg |
| Talc | 0.10 | kg |
| PVC Blister Foil | 200 | sheets |

### 7.2 Job Orders (Production Orders)

**Path:** Production → Job Orders

A Job Order (also called a Production Order or Work Order) is the formal instruction to manufacture a specific batch of a product.

**To create a Job Order:**
1. Click **+ New Job Order**.
2. Enter the **Order Number** (e.g., JO-2026-015).
3. Select the **Product** to manufacture.
4. Enter the **Batch Size** (quantity to produce).
5. Set the **Planned Start Date** and **Expected Completion Date**.
6. The system will display the BOM for that product automatically.
7. Save.

**Job Order Status:**
```
Planned → In Progress → Completed → Released (after QA Approval)
```

**Example Job Order:**

| Field | Value |
|-------|-------|
| Order No | JO-2026-015 |
| Product | Paracetamol 500mg Tablets |
| Batch Size | 50,000 tablets |
| Start Date | 08 April 2026 |
| Expected End | 12 April 2026 |
| Status | In Progress |

### 7.3 Production Material Requests

**Path:** Production → Material Requests

When Production starts a Job Order, they must request the required raw materials from Stores.

**Process:**
1. Production Manager creates a Material Request linked to the Job Order.
2. Store Manager reviews the request and checks stock availability.
3. If available, Stores issues the materials and records a stock outward movement.
4. Production uses the materials to manufacture the batch.
5. Completed batch goes to QA for Finished Products Analysis.

---

## 8. SALES DEPARTMENT

**Accessible to:** Super Admin, Sales Manager, Van Sales Rep

**Path in Sidebar:** Sales

### 8.1 Customers

**Path:** Sales → Customers

The customer master list. All customers must be registered here before an invoice can be raised for them.

**To add a new customer:**
1. Click **+ Add Customer**.
2. Fill in all required fields (see Key Fields below).
3. Save.

**Key Fields (Updated in v2.0):**

| Field | Description | Example |
|-------|-------------|---------|
| Customer Name | Full business name | Kumasi Central Pharmacy |
| Contact Person | Primary contact | Mrs. Abena Osei |
| Phone | Contact number | 0322 456 789 |
| Customer Category | Business type — see table below | Pharmacy |
| Customer Location | Town or area | Kumasi, Ashanti |
| Sales Person | The sales rep assigned to this customer | Kwaku Mensah |
| Route | The delivery route this customer belongs to | Route 2 — Kumasi |
| Credit Limit | Maximum credit allowed | GH₵ 15,000 |
| Payment Terms | How many days credit is extended | Net 14 days |

**Customer Categories:**

| Category | Description |
|----------|-------------|
| Wholesale | Large bulk buyers |
| Retail | Direct retail outlets |
| Hospital | Government or private hospitals |
| Pharmacy | Registered pharmacy shops |
| Institution | Schools, NGOs, etc. |

**Excel Import (NEW in v2.0):** Click the **Import** button to bulk-upload customers from an Excel file. Download the template provided on the import screen, fill it in, and upload.

**Statement of Account (SOA) (NEW in v2.0):** Click the **SOA** icon on any customer row to generate and download a printable Statement of Account showing all invoices, payments, and outstanding balance for that customer.

**Customer Documents (NEW in v2.0):** Click the **Documents** icon on any customer row to attach and manage compliance or contract documents for that customer (e.g., business registration certificate, credit agreement).

**Example Customer Record:**

| Field | Value |
|-------|-------|
| Customer Name | Kumasi Central Pharmacy |
| Contact Person | Mrs. Abena Osei |
| Phone | 0322 456 789 |
| Category | Pharmacy |
| Location | Kumasi, Ashanti |
| Sales Person | Kwaku Mensah |
| Credit Limit | GH₵ 15,000 |
| Payment Terms | Net 14 days |

### 8.2 Routes & Vans

**Path:** Sales → Routes & Vans

Each Sales Van is assigned to a specific delivery route (territory).

**To register a van:**
1. Click **+ New Van**.
2. Enter Van ID, Driver Name, Plate Number, and Route/Area covered.
3. Save.

**Example Van:**

| Field | Value |
|-------|-------|
| Van ID | VAN-001 |
| Driver | Kwaku Asante |
| Plate Number | GR 1234-23 |
| Route Area | Accra Central |

> **Note:** The Van's route determines which stock location is used when issuing invoices. Stock must be loaded to the van via **Sales → Stock Movements** before invoices can be issued.

### 8.3 Sales Invoices

**Path:** Sales → Invoices

This is where all sales transactions are recorded. An invoice represents a sale made to a customer.

**Stat Cards:**
- **Total Invoices** — count of all invoices
- **Revenue** — total GH₵ value of all issued/paid invoices
- **Outstanding** — total amount not yet collected
- **Paid** — total amount fully collected

**Invoice Types:**
- **Cash Sale** — Payment received immediately at point of sale.
- **Credit Sale** — Payment due on a future date (based on customer's credit terms).

**Invoice Status Lifecycle:**
```
Draft → Issued → Partially Paid → Paid
                              ↓
                           Overdue (if payment due date passes)
                              ↓
                         (Credit Note if returned)
```

> **Rule:** Only **Draft** invoices can be deleted. Once an invoice is Issued, it can only be cancelled via a Credit Note.

**To create a new Invoice (Updated in v2.0):**
1. Click **+ New Invoice**.
2. **Select the Customer** from the searchable dropdown. The system will auto-fill:
   - Customer location
   - Assigned route and salesperson
   - Credit limit and current outstanding balance
3. Select the **Route / Van** (determines which van's stock will be deducted).
4. Enter the **Invoice Date** and **Due Date**.
5. Select **Invoice Type** (Cash Sale or Credit Sale).
6. Add line items — for each product:
   - Select **Product** from the dropdown.
   - Enter **Quantity** and **Unit Price**.
   - Enter **Discount Amount** (per line, optional).
   - Enter **Batch Number** (required for controlled drugs).
   - Check **Damaged** if the product is defective (this item will not count towards revenue and a note will be recorded).
   - Check **Gifted** if the product is given free of charge (this item will not count towards revenue).
7. Review the totals (subtotal, any overall discount, grand total).
8. Set Status to **Issued** when ready (or **Draft** to save without committing stock).
9. Save.

> **Important:** When an invoice is saved as **Issued**, the system automatically:
> - Deducts the sold quantities from the van's stock.
> - Records a stock movement (OUT).
> - Posts an automatic journal entry to the accounts.
> - Checks for low-stock and alerts if a product falls below reorder level.
> - Damaged and Gifted items are excluded from revenue calculations but still recorded for traceability.

**Example Sales Invoice:**

| Field | Value |
|-------|-------|
| Invoice No | INV-2026-0247 |
| Customer | Kumasi Central Pharmacy |
| Location | Kumasi, Ashanti |
| Sales Person | Kwaku Mensah |
| Date | 10 April 2026 |
| Due Date | 24 April 2026 (Net 14) |
| Type | Credit Sale |
| Van/Route | VAN-001 (Accra Central) |
| Item 1 | Paracetamol 500mg Tablets — 50 bottles @ GH₵ 48.00, Discount GH₵ 0 = GH₵ 2,400.00 |
| Item 2 | Vitamin C 200mg Tablets — 20 bottles @ GH₵ 35.00, Discount GH₵ 50 = GH₵ 650.00 |
| **Total** | **GH₵ 3,050.00** |
| Status | Issued |

### 8.4 Sales Stock Movements

**Path:** Sales → Stock Movements

**NEW in v2.0**

This page provides a business-level view of all stock movements within the Sales department. It shows two types of activity:

| Movement Type | Description |
|--------------|-------------|
| **Van Load** | Stock transferred from the Sales Department store into a specific sales van |
| **Sales Invoice** | Stock deducted from a van when an invoice is issued to a customer |

**How Van Loading Works:**
Before a Van Sales Rep can issue invoices, stock must be loaded from the Sales Department store onto their van. The Store Manager or Sales Manager does this here.

**To load a van:**
1. Click **+ Load Van**.
2. Select **From Location** → must be the Sales Department store.
3. Select **To Location** → the specific van (e.g., Sales Van — VAN-001).
4. Add the products and quantities to load.
5. Click **Save**.

> **Rule:** The system enforces the direction of flow — you can only transfer FROM the Sales Department store TO an individual van. Reverse or warehouse-to-warehouse transfers are blocked in this view.

**Stat Cards:**
- **Total Units Moved** — all units that have moved (van loads + invoice deductions)
- **Products** — distinct products involved in movements
- **References** — unique transfer or invoice references

**Example Stock Movement Table:**

| Date | Type | Reference | Flow | Customer | Product | Qty |
|------|------|-----------|------|----------|---------|-----|
| 10 Apr 2026 | Van Load | TRF-2026-055 | Sales Dept → VAN-001 | Internal Transfer | Paracetamol 500mg | 500 Bottles |
| 10 Apr 2026 | Sales Invoice | INV-2026-0247 | VAN-001 → Customer | Kumasi Central Pharmacy | Paracetamol 500mg | 50 Bottles |

### 8.5 Dispatch Management

**Path:** Sales → Dispatch Management

Dispatch records track the physical delivery of goods to customers.

**Dispatch Status:**
```
Draft → Pending → In Transit → Completed
                             ↓
                         (Cancelled if aborted)
```

**To create a dispatch:**
1. Click **+ New Dispatch**.
2. Enter the Dispatch Number.
3. Select the Van and Driver.
4. Link the invoices being dispatched.
5. Set the dispatch date.
6. Update status to **In Transit** when goods leave the warehouse.
7. Mark as **Completed** upon confirmed delivery.

**Example Dispatch:**

| Field | Value |
|-------|-------|
| Dispatch No | DSP-2026-089 |
| Van | VAN-001 (GR 1234-23) |
| Driver | Kwaku Asante |
| Date | 10 April 2026 |
| Invoices Included | INV-2026-0247, INV-2026-0248, INV-2026-0249 |
| Status | In Transit |

### 8.6 Waybills

**Path:** Sales → Waybills

**NEW in v2.0**

A Waybill is a document that accompanies goods being loaded onto a sales van. It records the full value and contents of the van's stock load for a given route on a given day.

**To generate a waybill:**
1. Click **+ Generate Waybill**.
2. Select the **Van** and confirm the driver details.
3. Enter the **Date** and **Sales Person Name**.
4. The system calculates the **Grand Total Value** of the load.
5. Save.

The waybill can be viewed, printed, and used as a reference document during dispatch and delivery.

**Stat Cards:**
- **Total Waybills** — all waybills generated
- **Total Van Value** — cumulative GH₵ value of all waybill loads

**Example Waybill:**

| Field | Value |
|-------|-------|
| Waybill No | WB-2026-012 |
| Date | 10 April 2026 |
| Sales Person | Kwaku Asante |
| Van / Driver | VAN-001 — Kwaku Asante |
| Grand Total | GH₵ 48,600.00 |

### 8.7 Receipts (Payment Collection)

**Path:** Sales → Receipts

Receipts record payments collected from customers against their invoices.

**Receipt Status:**
- **Pending** — recorded but not yet banked
- **Confirmed** — payment verified
- **Cleared** — fully cleared in the bank

> **Rule:** Confirmed or Cleared receipts cannot be deleted — they can only be voided.

**To record a receipt:**
1. Click **+ New Receipt**.
2. Link to the **Invoice** being paid.
3. Enter the **Amount Collected**.
4. Select the **Payment Method** (Cash / Cheque / Mobile Money / Bank Transfer).
5. Enter the **Date Collected** and any reference (cheque number, MoMo ref, etc.).
6. Save.

**Example Receipt:**

| Field | Value |
|-------|-------|
| Receipt No | RCP-2026-0183 |
| Invoice | INV-2026-0247 |
| Customer | Kumasi Central Pharmacy |
| Amount Collected | GH₵ 3,050.00 |
| Payment Method | Mobile Money |
| MoMo Reference | GH-MM-739281 |
| Date | 17 April 2026 |
| Status | Confirmed |

### 8.8 Credit Notes

**Path:** Sales → Credit Notes

A Credit Note is issued when a customer returns goods or when an invoice needs to be fully or partially reversed.

**When to use a Credit Note:**
- Customer returns defective products.
- Over-billing error on an issued invoice.
- Agreed price adjustment after invoice issuance.

**To create a Credit Note:**
1. Click **+ New Credit Note**.
2. Link to the original **Invoice**.
3. Enter the reason for the credit.
4. Add the items being credited and quantities/amounts.
5. Save.

**Example Credit Note:**

| Field | Value |
|-------|-------|
| Credit Note No | CN-2026-0021 |
| Original Invoice | INV-2026-0247 |
| Customer | Kumasi Central Pharmacy |
| Reason | 5 bottles of Paracetamol returned (expired) |
| Credit Amount | GH₵ 240.00 |
| Date | 18 April 2026 |

### 8.9 Sales Reports

**Path:** Sales → Sales Reports

**Expanded in v2.0 — now contains 11 analytical reports**

This page provides comprehensive sales analytics across 11 report tabs. Use the tabs at the top of the page to switch between reports.

| Report Tab | What It Shows |
|-----------|--------------|
| **Distribution** | All invoices by customer — volume, revenue, route, category breakdown |
| **Stock by Salesperson** | Current van stock on hand per sales rep (what each rep is carrying) |
| **Stock by Route** | Current van stock on hand per delivery route |
| **Debtors by Staff** | Outstanding amounts owed, grouped by the salesperson responsible |
| **Debtors by Route** | Outstanding amounts owed, grouped by delivery route |
| **Debtors by Period** | Outstanding invoices bucketed into aging periods (0–30, 31–60, 61–90, 90+ days) |
| **Sales vs Cash** | Comparison of total sales value versus cash collected — identifies credit exposure |
| **Cheques Received** | All cheque payments received, with cheque number and bank details |
| **Shortage / Excess** | Reconciles stock given to each van versus what was sold — identifies missing stock |
| **Requisitions** | Stock requests raised by sales reps from Stores |
| **Product Distribution** | Which products are moving to which customers and routes |

**Date Range Filter:** Most reports allow you to filter by **From Date** and **To Date** to narrow the period under analysis.

**Export:** Click **Export** on any report to download the data as a CSV file.

**Key Reports for Management:**
- **Debtors by Staff** — holds each salesperson accountable for their collections.
- **Shortage / Excess** — the most important stock accountability tool for van sales.
- **Sales vs Cash** — shows total credit exposure at a glance.

---

## 9. ACCOUNTING DEPARTMENT

**Accessible to:** Super Admin, Accountant

**Path in Sidebar:** Accounting

### 9.1 Journal Entries

**Path:** Accounting → Journal Entries

Manual journal entries for transactions that are not automatically posted by the system.

> **Note:** Most sales transactions automatically post journal entries when invoices are issued. Manual journals are used for adjustments, corrections, or non-standard transactions.

**Standard Chart of Accounts Used:**

| Account | Type | Normal Balance |
|---------|------|---------------|
| Sales Revenue | Income | Credit |
| Accounts Receivable | Asset | Debit |
| Cash & Bank | Asset | Debit |
| Inventory/Stock | Asset | Debit |
| COGS | Expense | Debit |
| Accounts Payable | Liability | Credit |
| VAT Payable | Liability | Credit |

### 9.2 General Ledger

**Path:** Accounting → General Ledger

Shows all posted journal entries organised by account. Use this to trace any transaction back to its origin.

### 9.3 Trial Balance

**Path:** Accounting → Trial Balance

A summary of all account balances confirming that total debits equal total credits. Run this at the end of each month.

### 9.4 Expenses

**Path:** Accounting → Expenses

Record and categorise all company expenses — utilities, salaries, rent, vehicle costs, etc.

**Example Expense:**

| Field | Value |
|-------|-------|
| Expense Category | Fuel & Transport |
| Description | Fuel for Van 1 delivery route — April 2026 |
| Amount | GH₵ 850.00 |
| Date | 10 April 2026 |
| Payment Method | Cash (from Petty Cash) |

### 9.5 Payroll

**Path:** Accounting → Payroll

Monthly payroll processing for all staff. Works in conjunction with HR Payroll Preparation.

**Fields:**
- Employee name
- Basic salary
- Allowances (housing, transport, medical)
- Deductions (SSNIT, income tax, loans)
- Net pay

**Example Payroll Entry:**

| Employee | Basic | Transport | SSNIT (5.5%) | Tax | Net Pay |
|----------|-------|-----------|--------------|-----|---------|
| Abena Osei (QA Officer) | GH₵ 3,800 | GH₵ 400 | GH₵ 209 | GH₵ 312 | GH₵ 3,679 |
| Kwaku Asante (Van Driver) | GH₵ 2,500 | GH₵ 300 | GH₵ 137.50 | GH₵ 178 | GH₵ 2,484.50 |

### 9.6 Tax Periods

**Path:** Accounting → Tax Periods

Track VAT filing periods, corporate tax assessments, and PAYE submissions.

### 9.7 Petty Cash

**Path:** Accounting → Petty Cash

Track small cash disbursements for day-to-day operational expenses.

**Petty Cash Limit:** Consult your company's financial policy for the maximum per-transaction and monthly replenishment amount.

**Example Petty Cash Entry:**

| Date | Description | Amount | Balance Remaining |
|------|-------------|--------|------------------|
| 07 Apr 2026 | Office stationery — pens, paper | GH₵ 85.00 | GH₵ 415.00 |
| 08 Apr 2026 | Tea/coffee for factory floor | GH₵ 45.00 | GH₵ 370.00 |
| 10 Apr 2026 | Courier delivery fee | GH₵ 30.00 | GH₵ 340.00 |

### 9.8 Supplier Payments

**Path:** Accounting → Supplier Payments (also under Procurement)

Record payments made to suppliers against Purchase Orders.

**Example Supplier Payment:**

| Field | Value |
|-------|-------|
| Supplier | Meridian Pharma Supplies |
| PO Reference | PO-2026-047 |
| Invoice Amount | GH₵ 69,000.00 |
| Amount Paid | GH₵ 34,500.00 (50% deposit) |
| Balance | GH₵ 34,500.00 |
| Payment Method | Bank Transfer |
| Bank Reference | GCB-TRF-20260408 |
| Date Paid | 08 April 2026 |

### 9.9 Collections

**Path:** Accounting → Collections

The Accounting view of customer collections. Cross-references with Receipts recorded by the Sales team to confirm banking.

### 9.10 A/R Aging Report

**Path:** Accounting → A/R Aging

Shows all outstanding customer invoices grouped by how long they have been unpaid:

| Aging Bucket | Meaning |
|-------------|---------|
| 0–30 Days | Current — recently issued |
| 31–60 Days | Slightly overdue |
| 61–90 Days | Significantly overdue |
| 90+ Days | Seriously overdue — escalate immediately |

**Example A/R Aging:**

| Customer | Invoice | Date | Total | Paid | Outstanding | Bucket |
|----------|---------|------|-------|------|-------------|--------|
| Kumasi Central Pharmacy | INV-2026-0187 | 01 Mar 2026 | GH₵ 5,200 | GH₵ 2,000 | GH₵ 3,200 | 31–60 Days |
| Accra Medical Stores | INV-2026-0162 | 05 Feb 2026 | GH₵ 8,400 | GH₵ 0 | GH₵ 8,400 | 61–90 Days |

> **Action:** The Accountant should review this report weekly and escalate 61+ day outstanding amounts to the Sales Manager for follow-up.

### 9.11 Bank Reconciliation

**Path:** Accounting → Bank Reconciliation

**NEW in v2.0**

Bank Reconciliation allows the Accounting team to match bank statement transactions against journal entries recorded in the ERP, ensuring the company's cash book agrees with the bank's records.

**How it works:**
1. Select the **Bank Account** (Cash account from the Chart of Accounts).
2. **Upload a bank statement** (CSV format from your bank) using the upload button.
3. The system displays all imported bank statement transactions with a **match status**.
4. For unmatched transactions, click the **Match** button to link the bank line to the corresponding journal entry in the ERP.

**Match Statuses:**

| Status | Meaning |
|--------|---------|
| **Matched** | Bank transaction confirmed — linked to a journal entry |
| **Unmatched** | Bank transaction has no corresponding ERP record — investigate |
| **Partial** | Amounts do not fully agree — partial match recorded |
| **Disputed** | Transaction queried — under review |

**Stat Cards:**
- **Matched** — count of fully reconciled transactions
- **Unmatched** — transactions still requiring attention
- **Total Debits / Credits** — cumulative bank statement figures

> **Tip:** Run bank reconciliation at least once per week. All "Unmatched" items should be investigated before the month-end close.

**Example Bank Statement Import:**

| Date | Description | Reference | Debit | Credit | Status |
|------|-------------|-----------|-------|--------|--------|
| 08 Apr 2026 | Supplier Payment — Meridian Pharma | GCB-TRF-20260408 | GH₵ 34,500.00 | — | Matched |
| 10 Apr 2026 | Mobile Money Receipt — INV-0247 | GH-MM-739281 | — | GH₵ 3,050.00 | Matched |
| 12 Apr 2026 | Unknown debit | — | GH₵ 500.00 | — | Unmatched |

### 9.12 Financial Statements

**Path:** Accounting → (various)

The system auto-generates the following financial statements from posted journal entries:

| Statement | Path | Purpose |
|-----------|------|---------|
| Statement of Comprehensive Income | Accounting → Comprehensive Income | Shows revenues, costs, and profit/loss |
| Statement of Financial Position | Accounting → Financial Position | Balance sheet — assets, liabilities, equity |
| Equity Statement | Accounting → Equity Statement | Changes in owners' equity |
| Cash Flow Statement | Accounting → Cash Flow | Cash inflows and outflows |
| Accounting Notes | Accounting → Accounting Notes | Disclosure notes for the financial statements |

### 9.13 Financial Reports

**Path:** Accounting → Financial Reports

Pre-configured management reports — monthly P&L, budget vs. actual, expense breakdowns.

---

## 10. HUMAN RESOURCES

**Accessible to:** Super Admin, HR Manager

**Path in Sidebar:** HR Management

### 10.1 Employees

**Path:** HR → Employees

The official record of all Aspee Pharmaceuticals staff.

**To add an employee:**
1. Click **+ Add Employee**.
2. Enter: Full Name, Employee ID, Department, Job Title, Date of Employment, Phone, and Emergency Contact.
3. Save.

**Example Employee Record:**

| Field | Value |
|-------|-------|
| Employee ID | EMP-2024-018 |
| Full Name | Abena Mensah |
| Department | Quality Assurance |
| Job Title | QA Analyst |
| Date Employed | 15 June 2024 |
| Phone | 0244 987 654 |
| Emergency Contact | Mr. Kofi Mensah (Husband) — 0201 123 456 |

### 10.2 Attendance

**Path:** HR → Attendance

Daily attendance records for all staff.

**Entries include:**
- Employee name
- Date
- Check-in time
- Check-out time
- Hours worked
- Absent / Present / Late status

### 10.3 Leave Management

**Path:** HR → Leave Management

Track and approve staff leave requests.

**Leave Types (example):**
- Annual Leave
- Sick Leave
- Maternity / Paternity Leave
- Compassionate Leave

**Process:**
1. Employee (or HR on their behalf) submits a leave request.
2. HR Manager reviews and approves or rejects.
3. Approved leave updates the employee's leave balance.

### 10.4 Payroll Preparation

**Path:** HR → Payroll Preparation

HR prepares payroll data (attendance, leave deductions, overtime) which is then processed by Accounting.

---

## 11. INTERNAL AUDIT

**Accessible to:** Super Admin, Internal Auditor

**Path in Sidebar:** Internal Audit

### 11.1 Audit Plans

**Path:** Internal Audit → Audit Plans

Schedule and document internal audit activities across departments.

**Fields:**
- Audit title
- Department being audited
- Planned audit date
- Auditor assigned
- Scope/objectives

**Example Audit Plan:**

| Field | Value |
|-------|-------|
| Audit Title | Q2 2026 Stores Inventory Audit |
| Department | Stores |
| Planned Date | 30 April 2026 |
| Auditor | Emmanuel Darko (Internal Auditor) |
| Scope | Reconcile physical stock count against ERP inventory records |

### 11.2 Audit Reports

**Path:** Internal Audit → Audit Reports

Record and store the findings and recommendations from completed audits.

**Structure:**
- Findings (what was observed)
- Risk rating (High / Medium / Low)
- Recommendations (corrective actions)
- Management response
- Target resolution date

### 11.3 Non-Conformances

**Path:** Internal Audit → Non-Conformances

A non-conformance (NC) is any deviation from established procedures, standards, or regulations.

**NC Severity:**
- **Minor** — isolated, low-risk deviation
- **Major** — systematic or high-risk deviation
- **Critical** — immediate risk to product quality, patient safety, or regulatory compliance

---

## 12. COMPLIANCE & REGULATORS

**Accessible to:** Super Admin, Quality Assurance, Managing Director

**Path in Sidebar:** Compliance → Regulators & Renewals

Track all regulatory licences, certifications, and renewal dates to ensure Aspee Pharmaceuticals remains compliant with Ghana Food and Drugs Authority (FDA) and other regulatory bodies.

**Fields to track:**
- Regulator name (e.g., FDA Ghana, EPA, GSS)
- Licence/permit type
- Licence number
- Issue date
- Expiry date
- Renewal status

**Example Compliance Record:**

| Regulator | Licence Type | Licence No | Expiry | Status |
|-----------|-------------|-----------|--------|--------|
| FDA Ghana | Manufacturer's Licence | MFR-GH-2024-0089 | 31 Dec 2026 | Active |
| EPA | Factory Registration | EPA-2023-FAC-1102 | 30 Jun 2026 | Due for Renewal |
| Ghana Statistical Service | Business Registration | GSS-REG-20190 | Permanent | Active |

> **Action:** Set calendar reminders 90 days before any expiry date to initiate renewal.

---

## 13. WEEKLY REPORTS

**Accessible to:** All staff (submission); Super Admin and Managing Director (review)

### 13.1 Submitting a Weekly Report

Each department head submits a summary report to the Managing Director every week.

**How to submit:**
1. Go to the relevant module page (e.g., Stores → Stock Inventory).
2. Click the **teal "Send Weekly Report" button** in the top-right of the page.
3. Confirm the submission.
4. The report is sent to the MD's Weekly Reports Review inbox.

**Weekly report buttons are available on these pages:**
- Procurement → Purchase Orders
- Stores → Stock Inventory
- Sales → Invoices
- (and other major module pages)

### 13.2 Reviewing Weekly Reports (MD)

**Path:** Weekly Reports → Review

**Accessible to:** Super Admin and Managing Director only.

The Managing Director can review all submitted reports from all departments in one place.

---

## 14. SETTINGS & ADMINISTRATION

**Accessible to:** Super Admin only

**Path in Sidebar:** Settings

### 14.1 Profile

**Path:** Settings → Profile

All users can update their own profile (name, contact details, profile photo).

### 14.2 User Management

**Path:** Settings → User Management

**Super Admin only.**

This is where all system users are created and roles assigned.

**To create a new user:**
1. Go to Settings → User Management.
2. Click **+ Add User**.
3. Enter the staff member's **Email Address** (must match their login email).
4. Select their **Role** from the dropdown.
5. Save.

> **Important:** The user must also be registered in Supabase Auth (via the Auth dashboard or invitation email) before they can log in. Contact IT for this step.

**Available Roles:**

| Role | Description |
|------|-------------|
| Super Admin | Full access — IT Administrator only |
| Managing Director | Executive overview and report review |
| Sales Manager | Manages sales team and reviews all sales data |
| Van Sales Rep | Issues invoices and records deliveries on the road |
| Purchasing Manager | Manages procurement and supplier relationships |
| Store Manager | Controls inventory and stock movements |
| Production Manager | Oversees manufacturing job orders |
| Quality Assurance | Inspects materials and approves product releases |
| Accountant | Manages all financial records and reports |
| HR Manager | Manages staff records, attendance, and leave |
| Internal Auditor | Conducts internal audits across all departments |

### 14.3 Report Settings

**Path:** Settings → Report Settings

Configure the company name, address, logo, and other details that appear on printed reports and invoices.

### 14.4 Audit Trail

**Path:** Settings → Audit Trail

A complete log of every action performed in the system:
- Who did it (user)
- What they did (action type: Create / Update / Delete / Approve)
- Which module and record
- When (timestamp)

This is the system's security and accountability record. **Nothing can be hidden from the audit trail.**

---

## 15. COMPANY-WIDE WORKFLOW SUMMARY

The Aspee Pharmaceuticals ERP follows a linear, interconnected workflow across all departments:

```
┌──────────────────────────────────────────────────────────────────┐
│                  ASPEE PHARMACEUTICALS WORKFLOW                   │
└──────────────────────────────────────────────────────────────────┘

1. PROCUREMENT
   Store Manager raises Purchase Request (Stores → Purchase Requests)
          ↓
   Purchasing Manager creates Purchase Order
          ↓
   Supplier delivers goods
          ↓

2. QUALITY ASSURANCE (INCOMING)
   QA Officer inspects delivery & records GRN
          ↓
   QA approves, rejects, or quarantines materials
          ↓
   Approved materials → Stock added to Warehouse inventory

3. STORES (INBOUND)
   Stores Manager oversees physical stock
          ↓
   Any defective or expired materials are logged:
     • Defective → Stores → Material Defects (stock auto-deducted)
     • Expired  → Stores → Material Expiry (stock auto-deducted)
     • Internal consumption → Stores → Internal Use (stock auto-deducted)
          ↓
   Production raises Material Request
          ↓
   Stores issues materials → Stock decreases (production OUT)
          ↓

4. PRODUCTION
   Production Manager creates Job Order (linked to BOM)
          ↓
   Factory manufactures the batch
          ↓
   Finished goods sent to QA for final testing

5. QUALITY ASSURANCE (FINISHED PRODUCTS)
   QA Analyst records Finished Products Analysis
          ↓
   Batch either Passed, Failed, or Quarantined
          ↓
   PASSED → Product released to Finished Goods Stock

6. STORES (OUTBOUND TO SALES)
   Finished goods transferred into Sales Department store
          ↓
   Sales Manager loads vans using Sales → Stock Movements → Load Van
   (Sales Department store → Individual Van stock location)
   Waybill generated at Sales → Waybills
          ↓

7. SALES
   Van Sales Rep issues Sales Invoice (stock deducted from van)
          ↓
   Dispatch created and status updated (In Transit → Completed)
          ↓
   Customer pays → Receipt recorded
          ↓
   Credit Notes issued for any returns
          ↓
   Sales Reports reviewed by Sales Manager (all 11 report types)

8. ACCOUNTING
   All invoices auto-post journal entries
          ↓
   Accountant manages expenses, payroll, supplier payments
          ↓
   Weekly: Bank Reconciliation — bank statements matched to ERP
   Weekly: A/R Aging reviewed, outstanding debts followed up
          ↓
   Monthly: Trial Balance, Financial Statements generated

9. INTERNAL AUDIT & COMPLIANCE
   Regular audits across all departments
   Regulatory licences monitored and renewed
          ↓

10. MANAGING DIRECTOR
    Reviews Weekly Reports from all departments
    Approves high-value POs and strategic decisions
```

---

## 16. COMMON TASKS QUICK REFERENCE

| Task | Who | Path |
|------|-----|------|
| Add a new supplier | Purchasing Manager | Procurement → Suppliers → + Add Supplier |
| Create a Purchase Order | Purchasing Manager | Procurement → Purchase Orders → + Create PO |
| Approve a PO | Purchasing Manager / Accountant | Purchase Orders → Click ✓ icon |
| Inspect incoming goods | QA Officer | QA → Incoming Materials → + Add Record |
| Receive goods (GRN) | QA Officer | QA → Goods Receipt → + New GRN |
| Check stock levels | Store Manager | Stores → Stock Inventory |
| **Log internal use of stock** | Store Manager | **Stores → Internal Use → + Log Internal Use** |
| **Log a material defect** | Store Manager | **Stores → Material Defects → + Log Defect** |
| **Log an expired material write-off** | Store Manager | **Stores → Material Expiry → + Log Expiry** |
| Transfer stock (warehouse to production) | Store Manager | Stores → Stock Transfers → + New Transfer |
| **Load stock onto a sales van** | Store Manager / Sales Manager | **Sales → Stock Movements → + Load Van** |
| **Generate a van waybill** | Sales Manager | **Sales → Waybills → + Generate Waybill** |
| Create a Job Order | Production Manager | Production → Job Orders → + New Job Order |
| Request materials | Production Manager | Production → Material Requests → + New Request |
| Record QA finished test | QA Officer | QA → Finished Products → + Add Analysis Record |
| Release a QA batch | QA Officer | Finished Products → Click "Approve & Release" |
| Add a new customer | Sales Manager | Sales → Customers → + Add Customer |
| **Import customers from Excel** | Sales Manager | **Sales → Customers → Import** |
| **Export customer Statement of Account** | Sales Manager | **Sales → Customers → Click SOA icon on row** |
| Create a sales invoice | Van Sales Rep | Sales → Invoices → + New Invoice |
| Record a payment receipt | Sales Rep / Accountant | Sales → Receipts → + New Receipt |
| Issue a credit note | Sales Manager | Sales → Credit Notes → + New Credit Note |
| Create a dispatch record | Van Sales Rep | Sales → Dispatch Management → + New Dispatch |
| **View Sales Reports (all 11 types)** | Sales Manager | **Sales → Sales Reports → Select report tab** |
| Post a journal entry | Accountant | Accounting → Journal Entries → + New Entry |
| Record an expense | Accountant | Accounting → Expenses → + New Expense |
| View A/R aging | Accountant | Accounting → A/R Aging |
| **Upload bank statement & reconcile** | Accountant | **Accounting → Bank Reconciliation → Upload** |
| Process payroll | Accountant + HR | Accounting → Payroll / HR → Payroll Preparation |
| Record petty cash | Accountant | Accounting → Petty Cash → + New Entry |
| Add an employee | HR Manager | HR → Employees → + Add Employee |
| Approve leave | HR Manager | HR → Leave Management → Review Request |
| Submit weekly report | Department Head | Module page → Click "Send Weekly Report" |
| Review weekly reports | Managing Director | Weekly Reports → Review |
| Add a user | Super Admin | Settings → User Management → + Add User |
| View audit trail | Super Admin | Settings → Audit Trail |
| Export any data | Any authorised user | Module page → Click "Export" button |

> **Bold entries** are new features added in Version 2.0.

---

## IMPORTANT REMINDERS FOR ALL STAFF

1. **Never share your login credentials** with anyone. Each user has their own account.

2. **Always log out** when you leave your workstation unattended (Settings → Profile → Sign Out).

3. **Issued invoices cannot be deleted** — if a mistake is made, issue a Credit Note.

4. **Confirmed receipts cannot be deleted** — if recorded in error, contact your Super Admin to void it.

5. **Stock deductions are automatic** — when you save an invoice as "Issued", stock is immediately deducted from the van. Ensure the van is properly loaded before issuing invoices.

6. **Internal use, defects, and expiry records are one-way** — stock is deducted automatically on save. Deleting the record does NOT restore the stock. Always verify quantities before saving.

7. **All actions are logged** — every create, edit, and delete is recorded in the Audit Trail with your name and timestamp.

8. **Low stock alerts** — when you save an invoice and a product drops below its reorder level, the system will show a warning. Notify Stores and Purchasing immediately.

9. **Currency is Ghana Cedis (GH₵)** — all amounts in the system are in GH₵ unless otherwise specified.

10. **Batch numbers are critical** — always use the correct batch number when recording QA results, invoices, and defect/expiry records. This is your traceability record.

11. **Weekly reports matter** — submit your department's weekly report every week without fail. The MD relies on these for strategic decisions.

12. **Damaged and Gifted items on invoices** — marking a line item as Damaged or Gifted excludes it from revenue totals but still records it for traceability. Stock is still deducted.

13. **Bank reconciliation is mandatory** — the Accountant must reconcile bank statements at least weekly. Unmatched transactions must be investigated before month-end close.

14. **Van loading order matters** — a van cannot issue invoices for more stock than it carries. Always load the van (Sales → Stock Movements → Load Van) before the rep goes on route.

---

## WHAT'S NEW IN VERSION 2.0

| Feature | Module | Description |
|---------|--------|-------------|
| Internal Use tracking | Stores | Log stock consumed for office use, sampling, staff consumption, or R&D |
| Material Defects log | Stores | Record defective/damaged materials with automatic stock write-off |
| Material Expiry log | Stores | Record expired materials with disposal method and stock write-off |
| Sales Stock Movements | Sales | Business-level view of van loading and invoice deductions, with Load Van action |
| Waybills | Sales | Generate and print waybill documents for van route loading |
| Enhanced Invoices | Sales | Customer dropdown with auto-fill; batch numbers, discounts, and Damaged/Gifted flags per line item |
| Enhanced Customers | Sales | Customer Category, Location, Sales Person fields; Excel bulk import; SOA export; document attachments |
| Expanded Sales Reports | Sales | 11 analytical reports: Distribution, Stock by Salesperson/Route, Debtors by Staff/Route/Period, Sales vs Cash, Cheques, Shortage/Excess, Requisitions, Product Distribution |
| Bank Reconciliation | Accounting | Upload bank statements and match transactions against ERP journal entries |

---

*Aspee Pharmaceuticals ERP User Manual — Version 2.0*
*April 2026 | Confidential — For Internal Use Only*
