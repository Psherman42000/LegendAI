import { prisma } from './src/lib/db.js';

async function main() {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, title: true, status: true, errorMessage: true, processedUrl: true }
  });
  console.log(JSON.stringify(videos, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });