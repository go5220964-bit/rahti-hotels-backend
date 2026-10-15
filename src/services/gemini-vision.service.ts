import axios from 'axios';

export interface MadaReceiptAuditResult {
  extractedTotalSAR: number;
  madaAmountSAR: number;
  visaMasterAmountSAR: number;
  transactionsCount: number;
  terminalId: string | null;
  receiptDate: string | null;
  expectedAmountSAR: number;
  varianceSAR: number;
  isMatched: boolean;
  summaryAr: string;
}

export interface RoomInspectionAIResult {
  scoreOutOf100: number;
  status: 'READY_FOR_CHECKIN' | 'NEEDS_RECLEANING';
  bedStatus: string;
  cleanlinessStatus: string;
  amenitiesStatus: string;
  issuesDetected: string[];
  summaryAr: string;
}

export class GeminiVisionService {
  private static getApiKey(): string {
    return process.env.GEMINI_API_KEY || '';
  }

  /**
   * 1. قراءة ومطابقة إيصال موازنة جهاز مدى (Z-Report) مع المبلغ المدخل في تقفيلة الوردية
   */
  public static async auditMadaReceiptImage(
    imageBase64OrUrl: string,
    reportedNetworkAmountSAR: number
  ): Promise<MadaReceiptAuditResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        extractedTotalSAR: reportedNetworkAmountSAR,
        madaAmountSAR: reportedNetworkAmountSAR,
        visaMasterAmountSAR: 0,
        transactionsCount: 0,
        terminalId: null,
        receiptDate: new Date().toISOString().split('T')[0],
        expectedAmountSAR: reportedNetworkAmountSAR,
        varianceSAR: 0,
        isMatched: true,
        summaryAr: 'تم قبول المبلغ مبدئياً (يرجى تفعيل GEMINI_API_KEY للفحص البصري الآلي للإيصال)',
      };
    }

    const prompt = `
أنت مدقق مالي لفنادق راحتي. قم بقراءة صورة إيصال موازنة جهاز الشبكة (مدى / POS Z-Report) واستخرج الأرقام بدقة بصيغة JSON فقط بدون أي نص إضافي:
{
  "extractedTotalSAR": رقم إجمالي المبيعات بالريال,
  "madaAmountSAR": رقم مبيعات مدى,
  "visaMasterAmountSAR": رقم مبيعات فيزا وماستركارد,
  "transactionsCount": عدد العمليات,
  "terminalId": "رقم الجهاز إن وجد",
  "receiptDate": "تاريخ الموازنة YYYY-MM-DD"
}`;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                imageBase64OrUrl.startsWith('http')
                  ? { text: `رابط صورة الإيصال: ${imageBase64OrUrl}` }
                  : {
                      inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBase64OrUrl.replace(/^data:image\/\w+;base64,/, ''),
                      },
                    },
              ],
            },
          ],
        }
      );

      const rawText =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanedJson = rawText.replace(/
