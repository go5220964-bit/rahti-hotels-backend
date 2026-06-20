export enum Role {
  Admin = 'Admin',
  FinanceManager = 'FinanceManager',
  CEO = 'CEO',
  Technician = 'Technician',
  Receptionist = 'Receptionist',
  WarehouseManager = 'WarehouseManager',
  Accountant = 'Accountant',
  BranchManager = 'BranchManager',
  MaintenanceSupervisor = 'MaintenanceSupervisor',
  ProcurementOfficer = 'ProcurementOfficer',
  HousekeepingStaff = 'HousekeepingStaff',
}

export enum RequestType {
  Maintenance = 'Maintenance',
  Warehouse = 'Warehouse',
  Procurement = 'Procurement',
}

export enum RequestStatus {
  Pending = 'Pending',
  In_Progress = 'In_Progress',
  Awaiting_Confirmation = 'Awaiting_Confirmation',
  Completed = 'Completed',
  Rejected = 'Rejected',
  Reopened = 'Reopened',
}

export enum ApprovalStatus {
  Pending_Finance = 'Pending_Finance',
  Pending_CEO = 'Pending_CEO',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// WhatsApp Webhook Payload Types matching Meta Cloud API structure
export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppProfile {
  name: string;
}

export interface WhatsAppContact {
  profile: WhatsAppProfile;
  wa_id: string;
}

export interface WhatsAppTextMessage {
  body: string;
}

export interface WhatsAppButtonReply {
  id: string;
  title: string;
}

export interface WhatsAppListReply {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppInteractive {
  type: 'button_reply' | 'list_reply';
  button_reply?: WhatsAppButtonReply;
  list_reply?: WhatsAppListReply;
}

export interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
}

export interface WhatsAppLocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'image' | 'document' | 'location' | 'unsupported';
  text?: WhatsAppTextMessage;
  interactive?: WhatsAppInteractive;
  image?: WhatsAppMedia;
  document?: WhatsAppMedia;
  location?: WhatsAppLocationMessage;
}

export interface WhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: 'messages';
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

// Custom Parsed Message Structure for internal application handling
export interface ParsedWhatsAppMessage {
  senderNumber: string;
  senderName: string;
  messageId: string;
  timestamp: number;
  messageType: 'text' | 'button_reply' | 'media' | 'location';
  text?: string;
  buttonId?: string;
  buttonTitle?: string;
  mediaId?: string;
  mimeType?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
}
