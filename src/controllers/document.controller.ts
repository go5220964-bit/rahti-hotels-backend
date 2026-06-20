import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import prisma from '../services/prisma';
import { ApiResponse } from '../types';
import { AppError } from '../middleware/error.middleware';
import { CloudinaryService } from '../services/cloudinary.service';

// Multer memory storage configuration
const storage = multer.memoryStorage();

// Configure file size and mime types
export const uploadMiddleware = multer({
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
    } else {
      cb(new Error('MIME_TYPE_NOT_ALLOWED'));
    }
  }
}).single('file');

/**
 * Robust mock extractor using regex when Gemini API key is missing or fails
 */
function extractMetadataFromFilename(filename: string): {
  title: string;
  type: string;
  department: string;
  issuer: string;
  expiryDate: Date | null;
  issueDate: Date | null;
} {
  const cleanName = path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, ' ')
    .trim();

  let type = 'OTHER';
  let department = 'BRANCH';
  let issuer = 'جهة غير معروفة';
  let expiryDate: Date | null = null;
  let issueDate: Date | null = new Date();

  // Extract type
  if (cleanName.includes('رخصة') || cleanName.includes('تصريح') || cleanName.includes('permit') || cleanName.includes('license')) {
    if (cleanName.includes('دفاع') || cleanName.includes('حريق') || cleanName.includes('fire')) {
      type = 'FIRE_PERMIT';
      issuer = 'الدفاع المدني السعودي';
    } else if (cleanName.includes('صحي') || cleanName.includes('health')) {
      type = 'HEALTH_PERMIT';
      issuer = 'وزارة الصحة / البلدية';
    } else {
      type = 'LICENSE';
      issuer = 'الأمانة / البلدية';
    }
  } else if (cleanName.includes('عقد') || cleanName.includes('contract')) {
    type = 'CONTRACT';
    issuer = 'عقد تجاري';
  } else if (cleanName.includes('هوية') || cleanName.includes('بطاقة') || cleanName.includes('id card')) {
    type = 'ID_CARD';
    issuer = 'الأحوال المدنية';
  } else if (cleanName.includes('شهادة') || cleanName.includes('certificate')) {
    type = 'CERTIFICATE';
    issuer = 'جهة رسمية';
  } else if (cleanName.includes('تأمين') || cleanName.includes('insurance')) {
    type = 'INSURANCE';
    issuer = 'شركة التأمين';
  }

  // Extract department
  if (cleanName.toLowerCase().includes('hr') || cleanName.includes('موارد') || cleanName.includes('موظف')) {
    department = 'HR';
  } else if (cleanName.includes('صيانة') || cleanName.includes('مصعد') || cleanName.includes('تكييف') || cleanName.includes('كهرباء')) {
    department = 'MAINTENANCE';
  }

  // Look for dates like 2026-07-19 or similar
  const dateRegex = /(\d{4})[-/](\d{2})[-/](\d{2})/;
  const match = cleanName.match(dateRegex);
  if (match) {
    expiryDate = new Date(`${match[1]}-${match[2]}-${match[3]}`);
  } else {
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
export async function extractDocumentMetadata(fileBuffer: Buffer, filename: string, mimeType: string): Promise<{
  title: string;
  type: string;
  department: string;
  issuer: string;
  expiryDate: Date | null;
  issueDate: Date | null;
  notes?: string;
  aiExtracted: boolean;
}> {
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

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
  } catch (error) {
    console.error('🔴 Gemini AI extraction failed. Falling back to filename regex parser:', error);
    const meta = extractMetadataFromFilename(filename);
    return { ...meta, aiExtracted: false };
  }
}

export class DocumentController {
  /**
   * POST /api/documents/upload
   * Handles document upload, metadata extraction, and database persistence.
   */
  public static upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    uploadMiddleware(req, res, async (err) => {
      try {
        if (err) {
          if (err.message === 'MIME_TYPE_NOT_ALLOWED') {
            throw new AppError(400, 'INVALID_FILE_TYPE', 'صيغة الملف غير مدعومة. يسمح فقط بملفات PDF والصور (PNG, JPG, WEBP).');
          }
          throw new AppError(400, 'UPLOAD_ERROR', err.message);
        }

        const file = req.file;
        if (!file) {
          throw new AppError(400, 'MISSING_FILE', 'لم يتم رفع أي ملف.');
        }

        const user = (req as any).user;
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
        const cloudinaryUrl = await CloudinaryService.uploadFile(file.buffer, 'documents', file.originalname);

        // Map final data combining AI extraction and explicit UI overrides
        const finalBranchId = branchIdOverride || user.branchId || '';
        if (!finalBranchId) {
          throw new AppError(400, 'MISSING_BRANCH', 'يجب تحديد الفرع التابع للوثيقة.');
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
          doc = await prisma.document.create({
            data: {
              title: finalTitle,
              type: finalType as any,
              department: finalDepartment as any,
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
        } catch (dbError) {
          // Cleanup uploaded file from Cloudinary on db creation error
          const publicId = CloudinaryService.getPublicIdFromUrl(cloudinaryUrl);
          if (publicId) {
            await CloudinaryService.deleteFile(publicId).catch(err =>
              console.error('Failed to cleanup Cloudinary file after DB error:', err)
            );
          }
          throw dbError;
        }

        const response: ApiResponse = {
          success: true,
          data: doc
        };
        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    });
  };

  /**
   * GET /api/documents
   * Query all documents with filters.
   */
  public static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { branchId, department, type, status, search, employeeId } = req.query;

      // Build filters
      const where: any = {};

      // Role-based visibility scoping: Non-admins can only see their own branch, unless CEO/Central
      const isCentral = ['Admin', 'CEO', 'FinanceManager', 'MaintenanceSupervisor', 'Accountant', 'ProcurementOfficer'].includes(user.role);
      if (!isCentral) {
        where.branchId = user.branchId;
      } else if (branchId) {
        where.branchId = branchId as string;
      }

      if (employeeId) {
        where.employeeId = employeeId as string;
      }

      if (department) {
        where.department = department as string;
      }

      if (type) {
        where.type = type as string;
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
        } else if (status === 'expiring_soon') {
          where.isExpired = false;
          where.expiryDate = {
            gte: now,
            lte: thirtyDaysFromNow
          };
        } else if (status === 'valid') {
          where.isExpired = false;
          where.OR = [
            { expiryDate: null },
            { expiryDate: { gt: thirtyDaysFromNow } }
          ];
        }
      }

      if (search) {
        where.OR = [
          { title: { contains: search as string } },
          { issuer: { contains: search as string } },
          { notes: { contains: search as string } }
        ];
      }

      const documents = await prisma.document.findMany({
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

      const response: ApiResponse = {
        success: true,
        data: documents
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/documents/:id
   * Restrict to Admin role as per spec.
   */
  public static delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Access control: Only Admin can delete documents
      if (user.role !== 'Admin') {
        throw new AppError(403, 'FORBIDDEN', '🔒 غير مصرح لك بحذف الوثائق. هذه الصلاحية للمسؤول المالي أو مدير النظام فقط.');
      }

      const doc = await prisma.document.findUnique({
        where: { id }
      });

      if (!doc) {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'الوثيقة المطلوبة غير موجودة.');
      }

      // Try deleting the actual file from Cloudinary
      if (doc.fileUrl) {
        const publicId = CloudinaryService.getPublicIdFromUrl(doc.fileUrl);
        if (publicId) {
          await CloudinaryService.deleteFile(publicId).catch(err =>
            console.error(`Failed to delete Cloudinary asset with publicId: ${publicId}`, err)
          );
        }
      }

      // Delete database entry
      await prisma.document.delete({
        where: { id }
      });

      const response: ApiResponse = {
        success: true,
        data: { message: 'تم حذف الوثيقة وملفها بنجاح.' }
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
