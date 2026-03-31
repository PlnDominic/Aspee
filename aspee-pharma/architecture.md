# Aspee Pharma ERP — System Architecture

> A full-featured pharmaceutical Enterprise Resource Planning system for Aspee Pharmaceuticals Ltd.

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 15.1.9 |
| **Language** | TypeScript | 5.x |
| **UI** | React | 19.0.0 |
| **Styling** | Vanilla CSS + CSS Variables | — |
| **Icons** | Lucide React | 0.577.0 |
| **Charts** | Recharts | 3.8.0 |
| **State** | TanStack React Query | 5.90.21 |
| **Forms** | React Hook Form + Zod | 7.x + 4.x |
| **Backend/DB** | Supabase (PostgreSQL + Auth + Realtime) | 2.99.0 |
| **Email** | Nodemailer | 8.x |
| **PDF** | jsPDF + html2canvas | 4.x + 1.x |
| **Hosting** | Vercel | — |

---

## 2. High-Level Architecture

```mermaid
graph TB
    subgraph Client["Browser (React 19 + Next.js 15)"]
        LP["Landing Page"]
        Auth["Login / Signup"]
        Dash["Dashboard Shell"]
        Pages["Module Pages (39)"]
        Modals["Modal Components (24)"]
        Print["Printable Documents (8)"]
    end

    subgraph Middleware["Next.js Middleware"]
        RBAC["RBAC Route Guard"]
    end

    subgraph API["API Routes"]
        CreateUser["POST /api/create-user"]
        SendEmail["POST /api/send-email"]
        WeeklyReport["POST /api/weekly-report"]
    end

    subgraph Supabase["Supabase Cloud"]
        SupaAuth["Auth (JWT)"]
        DB["PostgreSQL"]
        RLS["Row Level Security"]
        RT["Realtime Subscriptions"]
        Storage["File Storage"]
    end

    Client -->|HTTP| Middleware
    Middleware -->|Authenticated| Dash
    Middleware -->|Unauthenticated| Auth
    Auth -->|Sign In| SupaAuth
    Dash --> Pages
    Pages --> Modals
    Pages -->|Supabase JS Client| DB
    Pages -->|Subscribe| RT
    API -->|Server-side| SupaAuth
    API -->|SMTP| Email["Nodemailer → SMTP"]
    DB --> RLS
```

---

## 3. Business Modules

```mermaid
graph LR
    subgraph Core["Core Modules"]
        OV["📊 Overview Dashboard"]
        SET["⚙️ Settings"]
    end

    subgraph Supply["Supply Chain"]
        PUR["🛒 Purchasing"]
        STR["📦 Stores"]
        PRD["🏭 Production"]
    end

    subgraph Revenue["Revenue"]
        SAL["💰 Sales"]
        CUS["👥 Customers"]
        RTE["🚐 Routes & Vans"]
    end

    subgraph Quality["Quality & Compliance"]
        QA["🔬 Quality Assurance"]
        AUD["📋 Internal Audit"]
    end

    subgraph Finance["Finance & HR"]
        ACC["💼 Accounting"]
        HR["👤 Human Resources"]
    end

    PUR --> STR
    STR --> PRD
    PRD --> QA
    QA --> STR
    STR --> RTE
    RTE --> SAL
    SAL --> ACC
    HR --> ACC
```

### Module Details

| Module | Pages | Key Features |
|---|---|---|
| **Overview** | 1 | KPI cards, sales chart, revenue trend, low stock, expiry alerts, van status |
| **Purchasing** | 4 | Suppliers, Purchase Orders (approval workflow), GRN, Supplier Payments |
| **Stores** | 4 | Products, Stock Levels, Transfers, Material Requests |
| **Production** | 3 | Production Orders, BOM Management, Material Requests |
| **QA** | 3 | QA Dashboard, In-Process Controls, Finished Products Analysis |
| **Sales** | 4 | Invoices, Credit Notes, Receipts, Dispatch |
| **Customers** | 1 | Customer accounts, credit management, SOA |
| **Routes** | 1 | Van inventory, route management, daily loading |
| **Accounting** | 6 | Journal, Expenses, Payroll, Tax, Petty Cash, Financial Reports |
| **HR** | 4 | Employees, Attendance, Leave, Payroll Preparation |
| **Internal Audit** | 3 | Audit Plans, Reports, Non-Conformances |
| **Settings** | 4 | Profile, Users, Report Config, Audit Log |

---

## 4. Database Schema (ERD)

```mermaid
erDiagram
    system_users {
        uuid id PK
        text name
        text email
        text role
        text department
        uuid auth_user_id
    }

    products {
        uuid id PK
        text name
        text sku
        decimal unit_price
        int reorder_level
        text category
    }

    suppliers {
        uuid id PK
        text name
        text contact_person
        text email
        text phone
    }

    purchase_orders {
        uuid id PK
        text po_number
        uuid supplier_id FK
        text status
        decimal total_amount
        date date
    }

    po_items {
        uuid id PK
        uuid po_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
    }

    goods_receipt_notes {
        uuid id PK
        text grn_number
        uuid po_id FK
        text batch_number
        date date
    }

    grn_items {
        uuid id PK
        uuid grn_id FK
        uuid product_id FK
        int quantity
        date expiry_date
    }

    stock_levels {
        uuid id PK
        uuid product_id FK
        int qty_on_hand
        text location
    }

    stock_movements {
        uuid id PK
        uuid product_id FK
        int quantity
        text movement_type
        text reference_type
    }

    sales_invoices {
        uuid id PK
        text invoice_number
        uuid customer_id FK
        text status
        decimal total_amount
        date date
    }

    invoice_items {
        uuid id PK
        uuid invoice_id FK
        uuid product_id FK
        int quantity
        decimal unit_price
    }

    customers {
        uuid id PK
        text name
        text contact_person
        decimal credit_limit
    }

    vans {
        uuid id PK
        text name
        text driver_name
        text status
    }

    journal_entries {
        uuid id PK
        text entry_number
        date date
        text description
    }

    chart_of_accounts {
        uuid id PK
        text code
        text name
        text type
        text subtype
    }

    expenses {
        uuid id PK
        text description
        decimal amount
        date date
        text category
    }

    notifications {
        uuid id PK
        text title
        text message
        text type
        text target_role
        boolean is_read
    }

    suppliers ||--o{ purchase_orders : "supplies"
    purchase_orders ||--o{ po_items : "contains"
    products ||--o{ po_items : "ordered in"
    purchase_orders ||--o{ goods_receipt_notes : "received as"
    goods_receipt_notes ||--o{ grn_items : "contains"
    products ||--o{ grn_items : "received"
    products ||--o{ stock_levels : "tracked in"
    products ||--o{ stock_movements : "moves as"
    customers ||--o{ sales_invoices : "billed to"
    sales_invoices ||--o{ invoice_items : "contains"
    products ||--o{ invoice_items : "sold in"
```

---

## 5. Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant MW as Middleware
    participant P as Page Component
    participant RQ as React Query
    participant SB as Supabase
    participant DB as PostgreSQL

    U->>MW: Navigate to /purchasing/purchase-orders
    MW->>MW: Check JWT + RBAC
    alt Unauthorized
        MW-->>U: Redirect → /login
    end
    MW->>P: Render Page
    P->>RQ: useFetch(['purchase_orders'])
    RQ->>SB: supabase.from('purchase_orders').select()
    SB->>DB: SQL Query (with RLS)
    DB-->>SB: Rows
    SB-->>RQ: JSON Response
    RQ-->>P: data, isLoading
    P-->>U: Render Table + Cards

    U->>P: Click "New PO"
    P->>P: Open PurchaseOrderModal
    U->>P: Fill form + Submit
    P->>RQ: useSave('purchase_orders')
    RQ->>SB: INSERT
    SB->>DB: INSERT (with RLS)
    DB-->>SB: New Row
    SB-->>RQ: Success
    RQ->>RQ: invalidateQueries
    RQ-->>P: Auto-refetch
    P-->>U: Updated Table + Toast
```

---

## 6. Component Architecture

```mermaid
graph TB
    subgraph Layout["Dashboard Layout"]
        Sidebar["Sidebar.tsx (22KB)"]
        Header["Header.tsx (16KB)"]
        Content["Page Content"]
    end

    subgraph Shared["Shared Components"]
        DT["DataTable.tsx"]
        PH["PageHeader.tsx"]
        SC["StatCard.tsx"]
        SB["StatusBadge.tsx"]
        EL["EntityLink.tsx"]
        GS["GlobalSearch.tsx"]
        M["Modal.tsx"]
        QP["QueryProvider.tsx"]
        TP["ThemeProvider.tsx"]
    end

    subgraph Modals["Domain Modals (24)"]
        POM["PurchaseOrderModal"]
        GRN["GRNModal"]
        INV["InvoiceModal"]
        PM["ProductModal"]
        CM["CustomerModal"]
        SM["SupplierModal"]
        SPM["SupplierPaymentModal"]
        etc1["...15 more"]
    end

    subgraph Printables["Print Documents (8)"]
        PPO["PrintablePO"]
        PGRN["PrintableGRN"]
        PINV["PrintableInvoice"]
        PCN["PrintableCreditNote"]
        PDN["PrintableDeliveryNote"]
        PPS["PrintablePayslip"]
        PRC["PrintableReceipt"]
        PSOA["PrintableSOA"]
    end

    Layout --> Content
    Content --> PH
    Content --> SC
    Content --> DT
    DT --> SB
    DT --> EL
    Content --> Modals
    Modals --> M
    Modals --> Printables
```

### Library Utilities

| File | Purpose |
|---|---|
| [hooks.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts) | [useFetch](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#20-42), [useSave](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#69-117), [useAction](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#118-143), [useTableData](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#144-217), [useCurrentUser](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#344-373), [useNotifications](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#374-466) |
| [supabase.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/supabase.ts) | Supabase client initialization |
| [schemas.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/schemas.ts) | Zod validation schemas |
| [auditLog.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/auditLog.ts) | Action audit trail logging |
| [notifications.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/notifications.ts) | Overdue invoice + expiry stock alerts |
| [csvExport.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/csvExport.ts) | CSV file download utility |
| [pdfGenerator.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/pdfGenerator.ts) | PDF generation wrapper |
| [formatCurrency.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/formatCurrency.ts) | Currency formatting (GH₵) |
| [currency.ts](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/currency.ts) | Currency constants |

---

## 7. Authentication & Authorization

```mermaid
flowchart TD
    A[User visits URL] --> B{Authenticated?}
    B -->|No| C[Redirect to /login]
    C --> D[Supabase Auth signIn]
    D --> E{Success?}
    E -->|No| C
    E -->|Yes| F[JWT Cookie Set]
    F --> G[Middleware intercepts]

    B -->|Yes| G
    G --> H{Route in routePermissions?}
    H -->|No| I[Allow access]
    H -->|Yes| J{User role allowed?}
    J -->|No| K[Redirect to /overview]
    J -->|Yes| I
```

### Role-Based Access

| Role | Accessible Modules |
|---|---|
| **Super Admin** | Everything |
| **Sales Manager / Van Sales Rep** | Sales, Customers |
| **Purchasing Manager** | Purchasing, Suppliers |
| **Store Manager** | Stores, Production |
| **Production Manager** | Production, Stores |
| **Quality Assurance** | QA |
| **Accountant** | Accounting |
| **Internal Auditor** | Internal Audit |
| **HR Manager** | HR |
| **Managing Director** | Weekly Reports Review |

---

## 8. Deployment Pipeline

```mermaid
flowchart LR
    A["Local Dev\n(npm run dev)"] --> B["Git Commit"]
    B --> C["vercel --prod"]
    C --> D["Vercel Build\n(Next.js)"]
    D --> E{"Build\nSuccess?"}
    E -->|Yes| F["Deploy to\nEdge Network"]
    E -->|No| G["Fix Errors"]
    G --> A
    F --> H["aspee-pharma.vercel.app"]
    H --> I["Supabase Cloud\n(PostgreSQL)"]
```

---

## 9. Key Design Patterns

| Pattern | Implementation |
|---|---|
| **Generic CRUD Hooks** | `useSave<T>`, `useCreate<T>`, `useUpdate<T>`, [useDelete](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#287-317) — reusable for any table |
| **Modal-per-Entity** | Each entity has a dedicated modal (e.g., `InvoiceModal`, `GRNModal`) |
| **Printable Documents** | Separate `Printable*` components for A4 PDF generation |
| **Realtime Notifications** | Supabase Realtime channel subscriptions in [useNotifications](file:///c:/Users/hp/Desktop/Developments/Aspee%20Pharmaceuticals/aspee-pharma/src/lib/hooks.ts#374-466) |
| **CSS Variables** | Theme tokens (colors, spacing) in `:root` + `.dark` — instant dark mode |
| **Middleware RBAC** | Role check before page render via `routePermissions` map |
| **Staggered Animations** | `.animate-stagger > *` CSS with incremental delays |

---

## 10. Feature Roadmap

```mermaid
gantt
    title Aspee Pharma — Feature Roadmap
    dateFormat YYYY-MM
    axisFormat %b %Y

    section Phase 1 — Foundation ✅
    Auth + RBAC Middleware           :done, p1a, 2025-01, 2025-02
    Purchasing (Suppliers, PO, GRN)  :done, p1b, 2025-02, 2025-03
    Stores (Products, Stock)         :done, p1c, 2025-02, 2025-03
    Sales (Invoices, Receipts)       :done, p1d, 2025-03, 2025-04

    section Phase 2 — Operations ✅
    Production Orders + BOM          :done, p2a, 2025-04, 2025-05
    QA (In-Process, Finished)        :done, p2b, 2025-05, 2025-06
    Routes & Van Management          :done, p2c, 2025-05, 2025-06
    Dispatch Module                  :done, p2d, 2025-06, 2025-07

    section Phase 3 — Finance & HR ✅
    Accounting (Journal, Expenses)   :done, p3a, 2025-07, 2025-08
    Payroll + Tax                    :done, p3b, 2025-08, 2025-09
    HR (Employees, Leave, Attendance):done, p3c, 2025-09, 2025-10
    Internal Audit                   :done, p3d, 2025-10, 2025-11

    section Phase 4 — Intelligence 🔄
    Financial Reports & Ledgers      :done, p4a, 2025-11, 2026-01
    Notification System              :done, p4b, 2026-01, 2026-02
    Dashboard Redesign               :done, p4c, 2026-02, 2026-03
    Global Search                    :done, p4d, 2026-02, 2026-03

    section Phase 5 — Future 🚀
    Mobile Responsive Overhaul       :active, p5a, 2026-04, 2026-06
    Advanced Analytics Dashboard     :p5b, 2026-06, 2026-08
    Supplier Portal                  :p5c, 2026-08, 2026-10
    Customer Self-Service Portal     :p5d, 2026-10, 2026-12
    Barcode / QR Scanning            :p5e, 2026-06, 2026-08
    Offline Mode (PWA)               :p5f, 2026-10, 2027-01
```

---

## 11. File Structure

```
aspee-pharma/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Authenticated layout
│   │   │   ├── layout.tsx        # Sidebar + Header shell
│   │   │   ├── overview/         # Dashboard home
│   │   │   ├── purchasing/       # Suppliers, POs, GRN, Payments
│   │   │   ├── stores/           # Products, Stock, Transfers, Mat. Requests
│   │   │   ├── production/       # Orders, BOM, Material Requests
│   │   │   ├── qa/               # Dashboard, In-Process, Finished
│   │   │   ├── sales/            # Invoices, Credit Notes, Receipts, Dispatch
│   │   │   ├── customers/        # Customer management
│   │   │   ├── routes/           # Van & route management
│   │   │   ├── accounting/       # Journal, Expenses, Payroll, Tax, Petty Cash, Reports
│   │   │   ├── hr/               # Employees, Attendance, Leave, Payroll
│   │   │   ├── internal-audit/   # Plans, Reports, Non-Conformances
│   │   │   └── settings/         # Profile, Users, Reports, Audit Log
│   │   ├── api/                  # Server-side routes
│   │   │   ├── create-user/      # Admin user creation
│   │   │   ├── send-email/       # Transactional emails
│   │   │   └── weekly-report/    # Automated reports
│   │   ├── login/                # Auth page
│   │   ├── signup/               # Registration
│   │   ├── globals.css           # Design system tokens
│   │   └── page.tsx              # Landing page
│   ├── components/               # 44 shared components
│   │   ├── DataTable.tsx         # Generic sortable table
│   │   ├── Modal.tsx             # Base modal wrapper
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   ├── Header.tsx            # Top bar with search/notifications
│   │   ├── (24 domain modals)    # Entity-specific CRUD modals
│   │   └── (8 printables)        # A4 document generators
│   ├── lib/                      # 9 utility modules
│   │   ├── hooks.ts              # React Query hooks
│   │   ├── supabase.ts           # Client setup
│   │   └── schemas.ts            # Zod schemas
│   └── middleware.ts             # Auth + RBAC guard
├── *.sql                         # 30 migration scripts
├── package.json
└── vercel.json
```

---

## 12. Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server API routes) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email configuration |

---

> **Last updated:** 20 March 2026
