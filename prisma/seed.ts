import "dotenv/config";

import bcrypt from "bcryptjs";

import {
  prisma,
} from "../src/lib/prisma.js";

async function main() {
 
  const email ="baraafr08@gmail.com"

  const passwordHash =
    await bcrypt.hash(
      "password",
      12
    );

  const superAdmin =
    await prisma.user.upsert({
      where: {
        email,
      },

      update: {
        name:
          "Super Admin",

        passwordHash,

        role:
          "SUPER_ADMIN",

        status:
          "ACTIVE",
      },

      create: {
        name:
          "Super Admin",

        email,

        passwordHash,

        role:
          "SUPER_ADMIN",

        status:
          "ACTIVE",
      },

      select: {
        id:
          true,

        name:
          true,

        email:
          true,

        role:
          true,

        status:
          true,
      },
    });

  console.log(
    "✅ SuperAdmin seeded successfully:"
  );

  console.table(
    superAdmin
  );
}

main()
  .catch(
    (
      error
    ) => {
      console.error(
        "❌ SuperAdmin seed failed:",
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );