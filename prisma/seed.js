const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create Branch A with fixed ID
  const branchA = await prisma.branch.upsert({
    where: { id: 'branch_a' },
    update: {},
    create: {
      id: 'branch_a',
      name: 'Branch A',
      code: 'A',
      location: 'Back Carwash Location',
      isActive: true
    }
  });

  console.log(' Branch A created:', branchA);

  // Create Branch B with fixed ID
  const branchB = await prisma.branch.upsert({
    where: { id: 'branch_b' },
    update: {},
    create: {
      id: 'branch_b',
      name: 'Branch B',
      code: 'B',
      location: 'Front Carwash Location',
      isActive: true
    }
  });

  console.log(' Branch B created:', branchB);
  
  console.log('\n Seed completed successfully!');
  console.log(' Use these IDs in your registration:');
  console.log('   Branch A: branch_a');
  console.log('   Branch B: branch_b');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });