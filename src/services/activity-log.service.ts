import prisma from './prisma';

export class ActivityLogService {
  public static async log(userId: string, action: string, entity: string, entityId: string, details: any, ip?: string) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: userId || 'system',
          action,
          entity,
          entityId: entityId || '',
          details: details ? JSON.stringify(details) : null,
          ip: ip || null
        }
      });
    } catch (e) {
      console.error('Failed to write activity log:', e);
    }
  }

  public static async getLogs(limit: number = 100, offset: number = 0) {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Fetch user details for each log to show user names
    const userIds = Array.from(new Set(logs.map(l => l.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, role: true }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return logs.map(l => ({
      ...l,
      user: userMap.get(l.userId) || { name: 'نظام تلقائي', role: 'System' }
    }));
  }
}
