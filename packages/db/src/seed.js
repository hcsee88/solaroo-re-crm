"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("Seeding database...");
    // ─── Roles ───────────────────────────────────────────────────────────────────
    const roles = [
        { name: "DIRECTOR", displayName: "Director / Management" },
        { name: "SALES_MANAGER", displayName: "Sales Manager" },
        { name: "SALES_ENGINEER", displayName: "Sales Engineer" },
        { name: "PROJECT_MANAGER", displayName: "Project Manager" },
        { name: "DESIGN_ENGINEER", displayName: "Design Engineer" },
        { name: "PROCUREMENT", displayName: "Procurement" },
        { name: "SITE_SUPERVISOR", displayName: "Site Supervisor" },
        { name: "COMMISSIONING_ENGINEER", displayName: "Commissioning Engineer" },
        { name: "OM_ENGINEER", displayName: "O&M Engineer" },
        { name: "FINANCE_ADMIN", displayName: "Finance / Admin" },
    ];
    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: role,
        });
    }
    console.log(`✓ ${roles.length} roles seeded`);
    // ─── Admin user ──────────────────────────────────────────────────────────────
    const directorRole = await prisma.role.findUniqueOrThrow({
        where: { name: "DIRECTOR" },
    });
    const passwordHash = await bcryptjs_1.default.hash("Solaroo123!", 12);
    await prisma.user.upsert({
        where: { email: "admin@pekat.com.my" },
        update: {},
        create: {
            email: "admin@pekat.com.my",
            name: "System Admin",
            passwordHash,
            roleId: directorRole.id,
            isActive: true,
        },
    });
    console.log("✓ Admin user seeded: admin@pekat.com.my / Solaroo123!");
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
