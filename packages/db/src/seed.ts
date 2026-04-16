import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedPermissions } from "./seeds/permissions.seed";

const prisma = new PrismaClient();

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
    console.log("Demo membership sync skipped: Project Manager test user not found");
    return;
  }

  const demoProject = await prisma.project.findFirst({
    where: {
      OR: [{ projectManagerId }, { status: "ACTIVE" }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, opportunityId: true },
  });

  if (!demoProject) {
    console.log("Demo membership sync skipped: no project fixture found");
    return;
  }

  const projectMembers = [
    ["projectengineer@pekatgroup.com", "ENGINEER"],
    ["designengineer@pekatgroup.com", "ENGINEER"],
    ["procurement@pekatgroup.com", "PROCUREMENT"],
    ["sitesupervisor@pekatgroup.com", "SITE_SUPERVISOR"],
    ["commissioneng@pekatgroup.com", "COMMISSIONING"],
    ["omengineer@pekatgroup.com", "OM"],
  ] as const;

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
  ] as const;

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

  console.log(`Demo memberships synced for project ${demoProject.id}`);
}

async function main() {
  console.log("Seeding database...");

  // ─── Roles ───────────────────────────────────────────────────────────────────
  const roles = [
    { name: "SUPER_ADMIN",             displayName: "Super Admin",            description: "CRM system administrator — user and role management only" },
    { name: "DIRECTOR",                displayName: "Director / Management",  description: "Business approvals, dashboards, full data visibility" },
    { name: "PMO_MANAGER",             displayName: "PMO Manager",            description: "Portfolio governance — gate review, milestone visibility, blocker tracking, exception reporting. View-only on commercial; no finance access." },
    { name: "SALES_MANAGER",           displayName: "Sales Manager" },
    { name: "SALES_ENGINEER",          displayName: "Sales Engineer" },
    { name: "PROJECT_MANAGER",         displayName: "Project Manager" },
    { name: "PROJECT_ENGINEER",        displayName: "Project Engineer",       description: "Execution coordinator under Project Manager — tracks deliverables, coordinates documents, logs issues/risks, supports gate submissions. No commercial or approval access." },
    { name: "DESIGN_LEAD",             displayName: "Design Lead",            description: "Head of Design department — leads technical review, approves DBDs and drawings" },
    { name: "DESIGN_ENGINEER",         displayName: "Design Engineer" },
    { name: "PROCUREMENT",             displayName: "Procurement" },
    { name: "SITE_SUPERVISOR",         displayName: "Site Supervisor" },
    { name: "COMMISSIONING_ENGINEER",  displayName: "Commissioning Engineer" },
    { name: "OM_ENGINEER",             displayName: "O&M Engineer" },
    { name: "FINANCE_ADMIN",           displayName: "Finance / Admin" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { displayName: role.displayName, description: role.description ?? null },
      create: role,
    });
  }
  console.log(`✓ ${roles.length} roles seeded`);

  // ─── Permissions ─────────────────────────────────────────────────────────────
  await seedPermissions(prisma);

  // ─── Super admin user (system maintenance) ───────────────────────────────────
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  const superAdminHash = await bcrypt.hash("Solaroo123!", 12);

  // Remove old admin@pekat.com.my if it exists
  await prisma.user.deleteMany({ where: { email: "admin@pekat.com.my" } });

  await prisma.user.upsert({
    where: { email: "see@pekatgroup.com" },
    update: { name: "See", passwordHash: superAdminHash, roleId: superAdminRole.id, isActive: true },
    create: { email: "see@pekatgroup.com", name: "See", passwordHash: superAdminHash, roleId: superAdminRole.id, isActive: true },
  });
  console.log("✓ Super admin seeded: see@pekatgroup.com / Solaroo123! (SUPER_ADMIN)");

  // ─── Test users (one per role) ────────────────────────────────────────────────
  const testPassword = await bcrypt.hash("Test@1234", 12);

  const testUsers = [
    { name: "Director (Test)",                 email: "director@pekatgroup.com",        roleName: "DIRECTOR" },
    { name: "PMO Manager (Test)",              email: "pmo@pekatgroup.com",             roleName: "PMO_MANAGER" },
    { name: "Sales Manager (Test)",            email: "salesmanager@pekatgroup.com",    roleName: "SALES_MANAGER" },
    { name: "Sales Engineer (Test)",           email: "salesengineer@pekatgroup.com",   roleName: "SALES_ENGINEER" },
    { name: "Project Manager (Test)",          email: "projectmanager@pekatgroup.com",  roleName: "PROJECT_MANAGER" },
    { name: "Project Engineer (Test)",         email: "projectengineer@pekatgroup.com", roleName: "PROJECT_ENGINEER" },
    { name: "Design Lead (Test)",              email: "designlead@pekatgroup.com",      roleName: "DESIGN_LEAD" },
    { name: "Design Engineer (Test)",          email: "designengineer@pekatgroup.com",  roleName: "DESIGN_ENGINEER" },
    { name: "Procurement (Test)",              email: "procurement@pekatgroup.com",     roleName: "PROCUREMENT" },
    { name: "Site Supervisor (Test)",          email: "sitesupervisor@pekatgroup.com",  roleName: "SITE_SUPERVISOR" },
    { name: "Commissioning Engineer (Test)",   email: "commissioneng@pekatgroup.com",   roleName: "COMMISSIONING_ENGINEER" },
    { name: "O&M Engineer (Test)",             email: "omengineer@pekatgroup.com",      roleName: "OM_ENGINEER" },
    { name: "Finance Admin (Test)",            email: "financeadmin@pekatgroup.com",    roleName: "FINANCE_ADMIN" },
  ];

  for (const tu of testUsers) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: tu.roleName } });
    await prisma.user.upsert({
      where: { email: tu.email },
      update: { name: tu.name, passwordHash: testPassword, roleId: role.id, isActive: true },
      create: { email: tu.email, name: tu.name, passwordHash: testPassword, roleId: role.id, isActive: true },
    });
  }
  console.log(`✓ ${testUsers.length} test users seeded (password: Test@1234)`);

  await syncDemoMemberships();

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
