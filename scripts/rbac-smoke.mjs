import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../packages/db/node_modules/@prisma/client");

const BASE_URL = process.env.RBAC_BASE_URL ?? "http://localhost:4000";
const prisma = new PrismaClient();

const USERS = [
  ["SUPER_ADMIN", "see@pekatgroup.com", "Solaroo123!", 200, 403],
  ["DIRECTOR", "director@pekatgroup.com", "Test@1234", 403, 200],
  ["PMO_MANAGER", "pmo@pekatgroup.com", "Test@1234", 403, 200],
  ["SALES_MANAGER", "salesmanager@pekatgroup.com", "Test@1234", 403, 200],
  ["SALES_ENGINEER", "salesengineer@pekatgroup.com", "Test@1234", 403, 200],
  ["PROJECT_MANAGER", "projectmanager@pekatgroup.com", "Test@1234", 403, 200],
  ["PROJECT_ENGINEER", "projectengineer@pekatgroup.com", "Test@1234", 403, 200],
  ["DESIGN_LEAD", "designlead@pekatgroup.com", "Test@1234", 403, 200],
  ["DESIGN_ENGINEER", "designengineer@pekatgroup.com", "Test@1234", 403, 200],
  ["PROCUREMENT", "procurement@pekatgroup.com", "Test@1234", 403, 200],
  ["SITE_SUPERVISOR", "sitesupervisor@pekatgroup.com", "Test@1234", 403, 200],
  ["COMMISSIONING_ENGINEER", "commissioneng@pekatgroup.com", "Test@1234", 403, 200],
  ["OM_ENGINEER", "omengineer@pekatgroup.com", "Test@1234", 403, 200],
  ["FINANCE_ADMIN", "financeadmin@pekatgroup.com", "Test@1234", 403, 200],
];

function unwrapData(body) {
  return body?.data ?? body;
}

async function apiFetch(path, init = {}) {
  return fetch(`${BASE_URL}${path}`, init);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function login(email, password) {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return {
    response,
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    body: await readJson(response),
  };
}

async function request(path, cookie, init = {}) {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(cookie ? { cookie } : {}),
    },
  });

  return { response, body: await readJson(response) };
}

async function syncDemoMemberships() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "projectmanager@pekatgroup.com",
          "projectengineer@pekatgroup.com",
          "designengineer@pekatgroup.com",
          "procurement@pekatgroup.com",
          "sitesupervisor@pekatgroup.com",
          "commissioneng@pekatgroup.com",
          "omengineer@pekatgroup.com",
        ],
      },
    },
    select: { id: true, email: true },
  });

  const userByEmail = new Map(users.map((user) => [user.email, user.id]));
  const projectManagerId = userByEmail.get("projectmanager@pekatgroup.com");
  if (!projectManagerId) {
    return null;
  }

  const demoProject = await prisma.project.findFirst({
    where: {
      OR: [{ projectManagerId }, { status: "ACTIVE" }],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      accountId: true,
      siteId: true,
      opportunityId: true,
      currentGateNo: true,
    },
  });

  if (!demoProject) {
    return null;
  }

  const projectMembers = [
    ["projectengineer@pekatgroup.com", "ENGINEER"],
    ["designengineer@pekatgroup.com", "ENGINEER"],
    ["procurement@pekatgroup.com", "PROCUREMENT"],
    ["sitesupervisor@pekatgroup.com", "SITE_SUPERVISOR"],
    ["commissioneng@pekatgroup.com", "COMMISSIONING"],
    ["omengineer@pekatgroup.com", "OM"],
  ];

  for (const [email, memberRole] of projectMembers) {
    const userId = userByEmail.get(email);
    if (!userId) continue;

    await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: demoProject.id,
          userId,
        },
      },
      update: { memberRole },
      create: {
        projectId: demoProject.id,
        userId,
        memberRole,
      },
    });
  }

  const opportunityMembers = [
    ["projectmanager@pekatgroup.com", "PM"],
    ["projectengineer@pekatgroup.com", "ENGINEER"],
    ["designengineer@pekatgroup.com", "ENGINEER"],
  ];

  for (const [email, memberRole] of opportunityMembers) {
    const userId = userByEmail.get(email);
    if (!userId) continue;

    await prisma.opportunityMember.upsert({
      where: {
        opportunityId_userId: {
          opportunityId: demoProject.opportunityId,
          userId,
        },
      },
      update: { memberRole },
      create: {
        opportunityId: demoProject.opportunityId,
        userId,
        memberRole,
      },
    });
  }

  const relatedContact = await prisma.contact.findFirst({
    where: {
      accounts: {
        some: {
          accountId: demoProject.accountId,
        },
      },
    },
    select: { id: true },
  });

  const unrelatedContact = await prisma.contact.findFirst({
    where: {
      accounts: {
        some: {
          accountId: { not: demoProject.accountId },
        },
      },
    },
    select: { id: true },
  });

  const unrelatedSite = await prisma.site.findFirst({
    where: { id: { not: demoProject.siteId } },
    select: { id: true },
  });

  const gateWithPendingDeliverables = await prisma.projectGate.findFirst({
    where: {
      projectId: demoProject.id,
      deliverables: {
        some: {
          isRequired: true,
          status: "PENDING",
        },
      },
    },
    orderBy: { gateNo: "asc" },
    select: { gateNo: true },
  });

  const totalAccounts = await prisma.account.count({ where: { isActive: true } });
  const totalContacts = await prisma.contact.count({ where: { isActive: true } });
  const totalSites = await prisma.site.count({ where: { isActive: true } });

  return {
    ...demoProject,
    relatedContactId: relatedContact?.id ?? null,
    unrelatedContactId: unrelatedContact?.id ?? null,
    unrelatedSiteId: unrelatedSite?.id ?? null,
    gateNo: gateWithPendingDeliverables?.gateNo ?? demoProject.currentGateNo,
    totalAccounts,
    totalContacts,
    totalSites,
  };
}

function countItems(body) {
  const data = unwrapData(body);
  return data?.items?.length ?? data?.items?.total ?? data?.total ?? 0;
}

let failures = 0;

function assertCheck(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${message}`);
  } else {
    console.log(`OK   ${message}`);
  }
}

const fixture = await syncDemoMemberships();

for (const [label, email, password, expectedAdminStatus, expectedDashboardStatus] of USERS) {
  const loginResult = await login(email, password);
  if (loginResult.response.status !== 200 || !loginResult.cookie) {
    failures += 1;
    console.error(`${label}: login failed (${loginResult.response.status})`);
    continue;
  }

  const me = await request("/api/auth/me", loginResult.cookie);
  const admin = await request("/api/admin/roles", loginResult.cookie);
  const dashboard = await request("/api/reporting/dashboard", loginResult.cookie);
  const actualRole = unwrapData(me.body)?.role?.name ?? "";

  assertCheck(actualRole === label, `${label} role resolves correctly`);
  assertCheck(admin.response.status === expectedAdminStatus, `${label} admin status ${admin.response.status}`);
  assertCheck(dashboard.response.status === expectedDashboardStatus, `${label} dashboard status ${dashboard.response.status}`);
}

if (fixture) {
  const peLogin = await login("projectengineer@pekatgroup.com", "Test@1234");
  const pmLogin = await login("projectmanager@pekatgroup.com", "Test@1234");
  const seLogin = await login("salesengineer@pekatgroup.com", "Test@1234");

  const peProjects = await request("/api/projects?page=1&pageSize=20", peLogin.cookie);
  const peOpps = await request("/api/opportunities?page=1&pageSize=20", peLogin.cookie);
  const peProposals = await request("/api/proposals?page=1&pageSize=20", peLogin.cookie);
  const peAccounts = await request("/api/accounts?page=1&pageSize=20", peLogin.cookie);
  const peContacts = await request("/api/contacts?page=1&pageSize=20", peLogin.cookie);
  const peSites = await request("/api/sites?page=1&pageSize=20", peLogin.cookie);
  const peSearchGreen = await request("/api/search?q=Green", peLogin.cookie);
  const peSearchMy = await request("/api/search?q=MY", peLogin.cookie);

  assertCheck(peProjects.response.status === 200 && unwrapData(peProjects.body)?.total >= 1, "PROJECT_ENGINEER sees assigned project list");
  assertCheck(peOpps.response.status === 200 && unwrapData(peOpps.body)?.total >= 1, "PROJECT_ENGINEER sees assigned opportunity list");
  assertCheck(peProposals.response.status === 200, "PROJECT_ENGINEER proposal endpoint respects assigned scope");
  assertCheck(peAccounts.response.status === 403, "PROJECT_ENGINEER cannot open accounts list");
  assertCheck(peContacts.response.status === 200 && unwrapData(peContacts.body)?.total > 0, "PROJECT_ENGINEER sees scoped contacts");
  assertCheck(peSites.response.status === 200 && unwrapData(peSites.body)?.total > 0, "PROJECT_ENGINEER sees scoped sites");
  assertCheck(unwrapData(peSearchGreen.body)?.total > 0, "PROJECT_ENGINEER search returns assigned records");
  assertCheck(unwrapData(peSearchMy.body)?.total === 0, "PROJECT_ENGINEER search hides unrelated records");

  if (fixture.relatedContactId) {
    const relatedContact = await request(`/api/contacts/${fixture.relatedContactId}`, peLogin.cookie);
    assertCheck(relatedContact.response.status === 200, "PROJECT_ENGINEER can open related contact");
  }

  if (fixture.unrelatedContactId) {
    const unrelatedContact = await request(`/api/contacts/${fixture.unrelatedContactId}`, peLogin.cookie);
    assertCheck(unrelatedContact.response.status === 404, "PROJECT_ENGINEER cannot open unrelated contact");
  }

  if (fixture.unrelatedSiteId) {
    const unrelatedSite = await request(`/api/sites/${fixture.unrelatedSiteId}`, peLogin.cookie);
    assertCheck(unrelatedSite.response.status === 404, "PROJECT_ENGINEER cannot open unrelated site");
  }

  const peApproveGate = await request(
    `/api/projects/${fixture.id}/gates/${fixture.gateNo}/status`,
    peLogin.cookie,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED", remarks: "smoke" }),
    },
  );
  const pmApproveGate = await request(
    `/api/projects/${fixture.id}/gates/${fixture.gateNo}/status`,
    pmLogin.cookie,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED", remarks: "smoke" }),
    },
  );

  assertCheck(peApproveGate.response.status === 403, "PROJECT_ENGINEER cannot approve gates");
  assertCheck(pmApproveGate.response.status !== 403, "PROJECT_MANAGER passes approve permission gate");

  const seAccounts = await request("/api/accounts?page=1&pageSize=20", seLogin.cookie);
  const seContacts = await request("/api/contacts?page=1&pageSize=20", seLogin.cookie);
  const seSites = await request("/api/sites?page=1&pageSize=20", seLogin.cookie);

  assertCheck(
    seAccounts.response.status === 200 && unwrapData(seAccounts.body)?.total > 0 && unwrapData(seAccounts.body)?.total < fixture.totalAccounts,
    "SALES_ENGINEER account scope is narrower than global",
  );
  assertCheck(
    seContacts.response.status === 200 && unwrapData(seContacts.body)?.total > 0 && unwrapData(seContacts.body)?.total < fixture.totalContacts,
    "SALES_ENGINEER contact scope is narrower than global",
  );
  assertCheck(
    seSites.response.status === 200 && unwrapData(seSites.body)?.total > 0 && unwrapData(seSites.body)?.total < fixture.totalSites,
    "SALES_ENGINEER site scope is narrower than global",
  );
}

await prisma.$disconnect();

if (failures > 0) {
  process.exitCode = 1;
}
