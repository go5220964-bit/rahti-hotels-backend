"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogService = void 0;
const prisma_1 = __importDefault(require("./prisma"));
class ActivityLogService {
    static async log(userId, action, entity, entityId, details, ip) {
        try {
            await prisma_1.default.activityLog.create({
                data: {
                    userId: userId || 'system',
                    action,
                    entity,
                    entityId: entityId || '',
                    details: details ? JSON.stringify(details) : null,
                    ip: ip || null
                }
            });
        }
        catch (e) {
            console.error('Failed to write activity log:', e);
        }
    }
    static async getLogs(limit = 100, offset = 0) {
        const logs = await prisma_1.default.activityLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });
        // Fetch user details for each log to show user names
        const userIds = Array.from(new Set(logs.map(l => l.userId)));
        const users = await prisma_1.default.user.findMany({
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
exports.ActivityLogService = ActivityLogService;
