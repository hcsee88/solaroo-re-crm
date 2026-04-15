-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'SIGNED', 'ACTIVE', 'CLOSED', 'DISPUTED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_RAISED', 'RAISED', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CLIENT', 'PROSPECT', 'PARTNER', 'CONSULTANT', 'VENDOR');

-- CreateEnum
CREATE TYPE "SiteGridCategory" AS ENUM ('OFF_GRID', 'WEAK_GRID', 'GRID_CONNECTED', 'HYBRID');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('LEAD', 'QUALIFIED', 'DATA_COLLECTION', 'SITE_ASSESSMENT_PENDING', 'CONCEPT_DESIGN', 'BUDGETARY_PROPOSAL', 'FIRM_PROPOSAL', 'NEGOTIATION', 'CONTRACTING', 'WON', 'LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "CommercialModel" AS ENUM ('CAPEX_SALE', 'LEASE', 'PPA', 'HYBRID_CAPEX_PPA', 'EPC_ONLY', 'DESIGN_AND_SUPPLY');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'SITE_VISIT', 'TASK');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'SUPERSEDED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "DocumentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'FAULTED', 'DECOMMISSIONED', 'UNDER_MAINTENANCE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_PARTS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'IN_PRODUCTION', 'DISPATCHED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RfiStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmittalStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('IDENTIFIED', 'UNDER_ASSESSMENT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ProposalApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "metadata" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "linkUrl" TEXT,
    "resourceId" TEXT,
    "resource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "columns" JSONB,
    "sortBy" TEXT,
    "sortDir" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("userId","teamId")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "opportunityId" TEXT,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "scopeSummary" TEXT,
    "paymentTerms" TEXT,
    "retentionPercent" DECIMAL(5,2),
    "contractValue" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "signedDate" TIMESTAMP(3),
    "commencementDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "defectsLiabilityMonths" INTEGER,
    "notes" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_milestones" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "percentValue" DECIMAL(5,2),
    "amount" DECIMAL(15,2),
    "triggerCondition" TEXT,
    "targetDate" TIMESTAMP(3),
    "achievedDate" TIMESTAMP(3),
    "invoiceId" TEXT,
    "isAchieved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2),
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'NOT_RAISED',
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "projectId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "budgetedAmount" DECIMAL(15,2) NOT NULL,
    "committedAmount" DECIMAL(15,2),
    "actualAmount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "industry" TEXT,
    "registrationNo" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Malaysia',
    "region" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_contacts" (
    "accountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "relationship" TEXT,

    CONSTRAINT "account_contacts_pkey" PRIMARY KEY ("accountId","contactId")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "gridCategory" "SiteGridCategory" NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Malaysia',
    "region" TEXT,
    "operatingSchedule" TEXT,
    "accessConstraints" TEXT,
    "safetyConstraints" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_photos" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "opportunityCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'LEAD',
    "commercialModel" "CommercialModel",
    "estimatedValue" DECIMAL(15,2),
    "estimatedPvKwp" DECIMAL(10,2),
    "estimatedBessKw" DECIMAL(10,2),
    "estimatedBessKwh" DECIMAL(10,2),
    "probabilityPercent" INTEGER,
    "expectedAwardDate" TIMESTAMP(3),
    "competitors" TEXT,
    "risks" TEXT,
    "summary" TEXT,
    "lostReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_history" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStage" "OpportunityStage",
    "toStage" "OpportunityStage" NOT NULL,
    "changedByUserId" TEXT,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "docCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "module" TEXT,
    "currentRevision" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "linkedGateNo" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerUserId" TEXT,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "proposalVersionId" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_revisions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "approvalStatus" "DocumentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmittals" (
    "id" TEXT NOT NULL,
    "transmittalNo" TEXT NOT NULL,
    "projectId" TEXT,
    "subject" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT,
    "notes" TEXT,

    CONSTRAINT "transmittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transmittal_items" (
    "id" TEXT NOT NULL,
    "transmittalId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "revision" TEXT,

    CONSTRAINT "transmittal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "projectId" TEXT,
    "siteId" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialId" TEXT,
    "capacityKw" DECIMAL(10,2),
    "capacityKwh" DECIMAL(10,2),
    "capacityKwp" DECIMAL(10,2),
    "commissioningDate" TIMESTAMP(3),
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_plans" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frequencyDays" INTEGER NOT NULL,
    "lastPerformedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "planId" TEXT,
    "performedDate" TIMESTAMP(3) NOT NULL,
    "performedBy" TEXT,
    "description" TEXT,
    "findings" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_tickets" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "siteId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "reportedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "reportedBy" TEXT,
    "assignedTo" TEXT,
    "resolution" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "claimNo" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "claimStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "submittedToVendor" TIMESTAMP(3),
    "vendorRefNo" TEXT,
    "resolution" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spare_parts" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "productCode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_logs" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "energyKwh" DECIMAL(12,3),
    "peakKw" DECIMAL(10,2),
    "stateOfChargePercent" DECIMAL(5,2),
    "availabilityPercent" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNo" TEXT,
    "country" TEXT,
    "region" TEXT,
    "website" TEXT,
    "paymentTerms" TEXT,
    "leadTimeDays" INTEGER,
    "rating" INTEGER,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_contacts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT,

    CONSTRAINT "vendor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "vendorId" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "specifications" TEXT,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'unit',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfqs" (
    "id" TEXT NOT NULL,
    "rfqNo" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3),
    "responseDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_line_items" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,

    CONSTRAINT "rfq_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_quotes" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quoteNo" TEXT,
    "totalAmount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "leadTimeDays" INTEGER,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "fileUrl" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vendor_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "projectId" TEXT,
    "vendorId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedDate" TIMESTAMP(3),
    "expectedDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "paymentTerms" TEXT,
    "deliveryAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_line_items" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT,
    "unitPrice" DECIMAL(15,4),
    "totalPrice" DECIMAL(15,2),

    CONSTRAINT "po_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "deliveryNoteNo" TEXT,
    "receivedDate" TIMESTAMP(3),
    "deliveredDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_serials" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "serialNo" TEXT NOT NULL,
    "batchNo" TEXT,
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "contractId" TEXT,
    "accountId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentGateNo" INTEGER NOT NULL DEFAULT 1,
    "budgetBaseline" DECIMAL(15,2),
    "marginBaseline" DECIMAL(15,2),
    "startDate" TIMESTAMP(3),
    "targetCod" TIMESTAMP(3),
    "actualCod" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectManagerId" TEXT NOT NULL,
    "designLeadId" TEXT,
    "procurementLeadId" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_team_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_team_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_gates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gateNo" INTEGER NOT NULL,
    "gateName" TEXT NOT NULL,
    "status" "GateStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "targetDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerUserId" TEXT NOT NULL,

    CONSTRAINT "project_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_checklist_items" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "gate_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "priority" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "raisedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "raisedById" TEXT,
    "assignedToId" TEXT,
    "resolution" TEXT,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "riskNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "likelihood" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "impact" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "overallRisk" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "mitigationPlan" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDate" TIMESTAMP(3),

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rfiNo" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "raisedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDate" TIMESTAMP(3),
    "responseDate" TIMESTAMP(3),
    "status" "RfiStatus" NOT NULL DEFAULT 'OPEN',
    "raisedById" TEXT,
    "answeredById" TEXT,
    "response" TEXT,

    CONSTRAINT "rfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "submittalNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "SubmittalStatus" NOT NULL DEFAULT 'PENDING',
    "submittedDate" TIMESTAMP(3),
    "reviewDeadline" TIMESTAMP(3),
    "reviewedDate" TIMESTAMP(3),
    "reviewedById" TEXT,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "variationNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedValue" DECIMAL(15,2),
    "approvedValue" DECIMAL(15,2),
    "status" "VariationStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "raisedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedDate" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissioning_tests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "testDate" TIMESTAMP(3),
    "result" TEXT,
    "testedByUserId" TEXT,
    "witnessName" TEXT,
    "remarks" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commissioning_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punchlist_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "raisedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3),
    "closedDate" TIMESTAMP(3),
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "punchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_surveys" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "surveyDate" TIMESTAMP(3),
    "conductedByUserId" TEXT,
    "dailyEnergyKwh" DECIMAL(10,2),
    "peakDemandKw" DECIMAL(10,2),
    "criticalLoadList" TEXT,
    "generatorDutyCycle" TEXT,
    "fuelConsumptionLPerDay" DECIMAL(10,2),
    "distributionTopology" TEXT,
    "earthingStatus" TEXT,
    "spaceAvailabilitySqm" DECIMAL(10,2),
    "fireSafetyObservations" TEXT,
    "interfacingRequirements" TEXT,
    "technicalRisks" TEXT,
    "dataCompletenessScore" INTEGER,
    "surveyNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_profiles" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "dataStartAt" TIMESTAMP(3) NOT NULL,
    "dataEndAt" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "load_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solution_options" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pvSizeKwp" DECIMAL(10,2),
    "bessKw" DECIMAL(10,2),
    "bessKwh" DECIMAL(10,2),
    "generatorKw" DECIMAL(10,2),
    "description" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solution_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "proposalCode" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "solutionId" TEXT,
    "title" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "approvalStatus" "ProposalApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "technicalSummary" TEXT,
    "commercialSummary" TEXT,
    "estimatedCapex" DECIMAL(15,2),
    "estimatedMargin" DECIMAL(15,2),
    "marginPercent" DECIMAL(5,2),
    "estimatedSavings" DECIMAL(15,2),
    "paybackYears" DECIMAL(5,2),
    "issuedToClientAt" TIMESTAMP(3),
    "submittedForApprovalAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_assumption_sets" (
    "id" TEXT NOT NULL,
    "proposalVersionId" TEXT NOT NULL,
    "loadSourceDescription" TEXT,
    "dieselPricePerLiter" DECIMAL(8,4),
    "batteryUsableDodPercent" DECIMAL(5,2),
    "batteryRtEfficiency" DECIMAL(5,2),
    "pcsPowerLimitKw" DECIMAL(10,2),
    "pvYieldKwhPerKwp" DECIMAL(8,2),
    "omAssumption" TEXT,
    "targetSavingsStrategy" TEXT,
    "otherAssumptions" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_assumption_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_approvals" (
    "id" TEXT NOT NULL,
    "proposalVersionId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approvalOrder" INTEGER NOT NULL,
    "decision" "ApprovalDecision",
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_performedAt_idx" ON "audit_logs"("performedAt");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNo_key" ON "contracts"("contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNo_key" ON "invoices"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_accountCode_key" ON "accounts"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "sites_siteCode_key" ON "sites"("siteCode");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_opportunityCode_key" ON "opportunities"("opportunityCode");

-- CreateIndex
CREATE UNIQUE INDEX "documents_docCode_projectId_key" ON "documents"("docCode", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "document_revisions_documentId_revision_key" ON "document_revisions"("documentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "transmittals_transmittalNo_key" ON "transmittals"("transmittalNo");

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetTag_key" ON "assets"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "assets_serialId_key" ON "assets"("serialId");

-- CreateIndex
CREATE UNIQUE INDEX "service_tickets_ticketNo_key" ON "service_tickets"("ticketNo");

-- CreateIndex
CREATE UNIQUE INDEX "warranty_claims_claimNo_key" ON "warranty_claims"("claimNo");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_vendorCode_key" ON "vendors"("vendorCode");

-- CreateIndex
CREATE UNIQUE INDEX "products_productCode_key" ON "products"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "rfqs_rfqNo_key" ON "rfqs"("rfqNo");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNo_key" ON "purchase_orders"("poNo");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_serials_productId_serialNo_key" ON "equipment_serials"("productId", "serialNo");

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectCode_key" ON "projects"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "projects_opportunityId_key" ON "projects"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_contractId_key" ON "projects"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "project_team_assignments_projectId_userId_key" ON "project_team_assignments"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_gates_projectId_gateNo_key" ON "project_gates"("projectId", "gateNo");

-- CreateIndex
CREATE UNIQUE INDEX "rfis_projectId_rfiNo_key" ON "rfis"("projectId", "rfiNo");

-- CreateIndex
CREATE UNIQUE INDEX "submittals_projectId_submittalNo_key" ON "submittals"("projectId", "submittalNo");

-- CreateIndex
CREATE UNIQUE INDEX "variations_projectId_variationNo_key" ON "variations"("projectId", "variationNo");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_proposalCode_key" ON "proposals"("proposalCode");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_proposalId_versionNo_key" ON "proposal_versions"("proposalId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_assumption_sets_proposalVersionId_key" ON "proposal_assumption_sets"("proposalVersionId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_contacts" ADD CONSTRAINT "account_contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_contacts" ADD CONSTRAINT "account_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_photos" ADD CONSTRAINT "site_photos_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_proposalVersionId_fkey" FOREIGN KEY ("proposalVersionId") REFERENCES "proposal_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_revisions" ADD CONSTRAINT "document_revisions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmittal_items" ADD CONSTRAINT "transmittal_items_transmittalId_fkey" FOREIGN KEY ("transmittalId") REFERENCES "transmittals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transmittal_items" ADD CONSTRAINT "transmittal_items_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "equipment_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_planId_fkey" FOREIGN KEY ("planId") REFERENCES "maintenance_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_logs" ADD CONSTRAINT "performance_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_contacts" ADD CONSTRAINT "vendor_contacts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_line_items" ADD CONSTRAINT "rfq_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_quotes" ADD CONSTRAINT "vendor_quotes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_line_items" ADD CONSTRAINT "po_line_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_serials" ADD CONSTRAINT "equipment_serials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_serials" ADD CONSTRAINT "equipment_serials_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_team_assignments" ADD CONSTRAINT "project_team_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_team_assignments" ADD CONSTRAINT "project_team_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_checklist_items" ADD CONSTRAINT "gate_checklist_items_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "project_gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variations" ADD CONSTRAINT "variations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissioning_tests" ADD CONSTRAINT "commissioning_tests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punchlist_items" ADD CONSTRAINT "punchlist_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_surveys" ADD CONSTRAINT "site_surveys_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solution_options" ADD CONSTRAINT "solution_options_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "solution_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_assumption_sets" ADD CONSTRAINT "proposal_assumption_sets_proposalVersionId_fkey" FOREIGN KEY ("proposalVersionId") REFERENCES "proposal_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_proposalVersionId_fkey" FOREIGN KEY ("proposalVersionId") REFERENCES "proposal_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_approvals" ADD CONSTRAINT "proposal_approvals_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
