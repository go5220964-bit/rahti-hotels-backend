"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = exports.uploadMiddleware = void 0;
exports.extractDocumentMetadata = extractDocumentMetadata;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const prisma_1 = __importDefault(require("../services/prisma"));
const error_middleware_1 = require("../middleware/error.middleware");
const cloudinary_service_1 = require("../services/cloudinary.service");
// Multer memory storage configuration
const storage = multer_1.default.memoryStorage();
// Configure file size and mime types
exports.uploadMiddleware = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp'
        ];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('MIME_TYPE_NOT_ALLOWED'));
        }
    }
}).single('file');
/**
 * Robust mock extractor using regex when Gemini API key is missing or fails
 */
function extractMetadataFromFilename(filename) {
    const cleanName = path_1.default.basename(filename, path_1.default.extname(filename))
        .replace(/[-_]/g, ' ')
        .trim();
    let type = 'OTHER';
    let department = 'BRANCH';
    let issuer = 'جهة غير معروفة';
    let expiryDate = null;
    let issueDate = new Date();
    // Extract type
    if (cleanName.includes('رخصة') || cleanName.includes('تصريح') || cleanName.includes('permit') || cleanName.includes('license')) {
        if (cleanName.includes('دفاع') || cleanName.includes('حريق') || cleanName.includes('fire')) {
            type = 'FIRE_PERMIT';
            issuer = 'الدفاع المدني السعودي';
        }
        else if (cleanName.includes('صحي') || cleanName.includes('health')) {
            type = 'HEALTH_PERMIT';
            issuer = 'وزارة الصحة / البلدية';
        }
        else {
            type = 'LICENSE';
            issuer = 'الأمانة / البلدية';
        }
    }
    else if (cleanName.includes('عقد') || cleanName.includes('contract')) {
        type = 'CONTRACT';
        issuer = 'عقد تجاري';
    }
    else if (cleanName.includes('هوية') || cleanName.includes('بطاقة') || cleanName.includes('id card')) {
        type = 'ID_CARD';
        issuer = 'الأحوال المدنية';
    }
    else if (cleanName.includes('شهادة') || cleanName.includes('certificate')) {
        type = 'CERTIFICATE';
        issuer = 'جهة رسمية';
    }
    else if (cleanName.includes('تأمين') || cleanName.includes('insurance')) {
        type = 'INSURANCE';
        issuer = 'شركة التأمين';
    }
    // Extract department
    if (cleanName.toLowerCase().includes('hr') || cleanName.includes('موارد') || cleanName.includes('موظف')) {
        department = 'HR';
    }
    else if (cleanName.includes('صيانة') || cleanName.includes('مصعد') || cleanName.includes('تكييف') || cleanName.includes('كهرباء')) {
        department = 'MAINTENANCE';
    }
    // Look for dates like 2026-07-19 or similar
    const dateRegex = /(\d{4})[-/](\d{2})[-/](\d{2})/;
    const match = cleanName.match(dateRegex);
    if (match) {
        expiryDate = new Date(`${match[1]}-${match[2]}-${match[3]}`);
    }
    else {
        // If no date in name, default expiry date to 30 days from now for testing alerts, or 1 year
        expiryDate = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    }
    return {
        title: cleanName,
        type,
        department,
        issuer,
        issueDate,
        expiryDate
    };
}
/**
 * Calls Gemini API to extract details or falls back to filename-based regex extraction
 */
async function extractDocumentMetadata(fileBuffer, filename, mimeType) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('⚠️ Gemini API key is missing. Using filename regex parser fallback.');
        const meta = extractMetadataFromFilename(filename);
        return { ...meta, aiExtracted: false };
    }
    try {
        const base64Data = fileBuffer.toString('base64');
        const promptText = `
Analyze the attached document and extract its metadata.
Provide the output strictly as a single JSON object with these fields, and nothing else (no markdown blocks, no code blocks):
{
  "title": "Arabic descriptive title of the document",
  "type": "LICENSE" | "CONTRACT" | "ID_CARD" | "CERTIFICATE" | "INSURANCE" | "HEALTH_PERMIT" | "FIRE_PERMIT" | "OTHER",
  "department": "BRANCH" | "HR" | "MAINTENANCE",
  "issuer": "Arabic name of the issuer authority",
  "issueDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "notes": "Any other relevant brief notes in Arabic"
}
If a field is not clear, guess standard values or return null.
`;
        const requestBody = {
            contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data
                            }
                        },
                        {
                            text: promptText
                        }
                    ]
                }]
        };
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            throw new Error(`Gemini API responded with status ${response.status}`);
        }
        const json = await response.json();
        const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Clean up potential markdown formatting in response
        const cleanJsonText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJsonText);
        return {
            title: result.title || filename,
            type: result.type || 'OTHER',
            department: result.department || 'BRANCH',
            issuer: result.issuer || 'غير محدد',
            issueDate: result.issueDate ? new Date(result.issueDate) : null,
            expiryDate: result.expiryDate ? new Date(result.expiryDate) : null,
            notes: result.notes || '',
            aiExtracted: true
        };
    }
    catch (error) {
        console.error('🔴 Gemini AI extraction failed. Falling back to filename regex parser:', error);
        const meta = extractMetadataFromFilename(filename);
        return { ...meta, aiExtracted: false };
    }
}
class DocumentController {
    /**
     * POST /api/documents/upload
     * Handles document upload, metadata extraction, and database persistence.
     */
    static upload = async (req, res, next) => {
        (0, exports.uploadMiddleware)(req, res, async (err) => {
            try {
                if (err) {
                    if (err.message === 'MIME_TYPE_NOT_ALLOWED') {
                        throw new error_middleware_1.AppError(400, 'INVALID_FILE_TYPE', 'صيغة الملف غير مدعومة. يسمح فقط بملفات PDF والصور (PNG, JPG, WEBP).');
                    }
                    throw new error_middleware_1.AppError(400, 'UPLOAD_ERROR', err.message);
                }
                const file = req.file;
                if (!file) {
                    throw new error_middleware_1.AppError(400, 'MISSING_FILE', 'لم يتم رفع أي ملف.');
                }
                const user = req.user;
                const branchIdOverride = req.body.branchId;
                const departmentOverride = req.body.department;
                const typeOverride = req.body.type;
                const titleOverride = req.body.title;
                const issuerOverride = req.body.issuer;
                const issueDateOverride = req.body.issueDate;
                const expiryDateOverride = req.body.expiryDate;
                const notesOverride = req.body.notes;
                const employeeIdOverride = req.body.employeeId;
                // Extract metadata using AI or Fallback
                // Extract metadata using AI or Fallback
                const extracted = await extractDocumentMetadata(file.buffer, file.originalname, file.mimetype);
                // Upload to Cloudinary
                const cloudinaryUrl = await cloudinary_service_1.CloudinaryService.uploadFile(file.buffer, 'documents', file.originalname);
                // Map final data combining AI extraction and explicit UI overrides
                const finalBranchId = branchIdOverride || user.branchId || '';
                if (!finalBranchId) {
                    throw new error_middleware_1.AppError(400, 'MISSING_BRANCH', 'يجب تحديد الفرع التابع للوثيقة.');
                }
                const finalTitle = titleOverride || extracted.title;
                const finalType = typeOverride || extracted.type;
                const finalDepartment = departmentOverride || extracted.department;
                const finalIssuer = issuerOverride || extracted.issuer;
                const finalIssueDate = issueDateOverride ? new Date(issueDateOverride) : extracted.issueDate;
                const finalExpiryDate = expiryDateOverride ? new Date(expiryDateOverride) : extracted.expiryDate;
                const finalNotes = notesOverride || extracted.notes;
                // Calculate isExpired
                const isExpired = finalExpiryDate ? new Date(finalExpiryDate) < new Date() : false;
                let doc;
                try {
                    doc = await prisma_1.default.document.create({
                        data: {
                            title: finalTitle,
                            type: finalType,
                            department: finalDepartment,
                            branchId: finalBranchId,
                            fileUrl: cloudinaryUrl,
                            fileName: file.originalname,
                            fileSize: file.size,
                            mimeType: file.mimetype,
                            issuer: finalIssuer,
                            issueDate: finalIssueDate,
                            expiryDate: finalExpiryDate,
                            isExpired,
                            aiExtracted: extracted.aiExtracted,
                            notes: finalNotes,
                            uploadedById: user.userId,
                            employeeId: employeeIdOverride || null
                        },
                        include: {
                            branch: true,
                            uploadedBy: {
                                select: {
                                    id: true,
                                    name: true,
                                    role: true
                                }
                            }
                        }
                    });
                }
                catch (dbError) {
                    // Cleanup uploaded file from Cloudinary on db creation error
                    const publicId = cloudinary_service_1.CloudinaryService.getPublicIdFromUrl(cloudinaryUrl);
                    if (publicId) {
                        await cloudinary_service_1.CloudinaryService.deleteFile(publicId).catch(err => console.error('Failed to cleanup Cloudinary file after DB error:', err));
                    }
                    throw dbError;
                }
                const response = {
                    success: true,
                    data: doc
                };
                res.status(201).json(response);
            }
            catch (error) {
                next(error);
            }
        });
    };
    /**
     * GET /api/documents
     * Query all documents with filters.
     */
    static getAll = async (req, res, next) => {
        try {
            const user = req.user;
            const { branchId, department, type, status, search, employeeId } = req.query;
            // Build filters
            const where = {};
            // Role-based visibility scoping: Non-admins can only see their own branch, unless CEO/Central
            const isCentral = ['Admin', 'CEO', 'FinanceManager', 'MaintenanceSupervisor', 'Accountant', 'ProcurementOfficer'].includes(user.role);
            if (!isCentral) {
                where.branchId = user.branchId;
            }
            else if (branchId) {
                where.branchId = branchId;
            }
            if (employeeId) {
                where.employeeId = employeeId;
            }
            if (department) {
                where.department = department;
            }
            if (type) {
                where.type = type;
            }
            if (status) {
                const now = new Date();
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(now.getDate() + 30);
                if (status === 'expired') {
                    where.OR = [
                        { isExpired: true },
                        { expiryDate: { lt: now } }
                    ];
                }
                else if (status === 'expiring_soon') {
                    where.isExpired = false;
                    where.expiryDate = {
                        gte: now,
                        lte: thirtyDaysFromNow
                    };
                }
                else if (status === 'valid') {
                    where.isExpired = false;
                    where.OR = [
                        { expiryDate: null },
                        { expiryDate: { gt: thirtyDaysFromNow } }
                    ];
                }
            }
            if (search) {
                where.OR = [
                    { title: { contains: search } },
                    { issuer: { contains: search } },
                    { notes: { contains: search } }
                ];
            }
            const documents = await prisma_1.default.document.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    branch: true,
                    uploadedBy: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });
            const response = {
                success: true,
                data: documents
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * DELETE /api/documents/:id
     * Restrict to Admin role as per spec.
     */
    static delete = async (req, res, next) => {
        try {
            const { id } = req.params;
            const user = req.user;
            // Access control: Only Admin can delete documents
            if (user.role !== 'Admin') {
                throw new error_middleware_1.AppError(403, 'FORBIDDEN', '🔒 غير مصرح لك بحذف الوثائق. هذه الصلاحية للمسؤول المالي أو مدير النظام فقط.');
            }
            const doc = await prisma_1.default.document.findUnique({
                where: { id }
            });
            if (!doc) {
                throw new error_middleware_1.AppError(404, 'DOCUMENT_NOT_FOUND', 'الوثيقة المطلوبة غير موجودة.');
            }
            // Try deleting the actual file from Cloudinary
            if (doc.fileUrl) {
                const publicId = cloudinary_service_1.CloudinaryService.getPublicIdFromUrl(doc.fileUrl);
                if (publicId) {
                    await cloudinary_service_1.CloudinaryService.deleteFile(publicId).catch(err => console.error(`Failed to delete Cloudinary asset with publicId: ${publicId}`, err));
                }
            }
            // Delete database entry
            await prisma_1.default.document.delete({
                where: { id }
            });
            const response = {
                success: true,
                data: { message: 'تم حذف الوثيقة وملفها بنجاح.' }
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
    };
}
exports.DocumentController = DocumentController;
