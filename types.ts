
// Types for Meeza POS System - Upgraded v4.0 (Security Focus)

export type UserRole = 
  | 'admin' 
  | 'it_support' 
  | 'general_manager' 
  | 'branch_manager' 
  | 'supervisor' 
  | 'sales_manager' 
  | 'sales_supervisor' 
  | 'warehouse_manager' 
  | 'warehouse_supervisor' 
  | 'cashier' 
  | 'worker' 
  | 'employee' 
  | string;

export type StaffPaymentType = 'راتب' | 'حافز' | 'سلفة' | 'خصم' | string;

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  wholesalePriceAtSale: number;
}

export interface ReturnItem {
  productId: string;
  name: string;
  quantity: number;
  refundAmount: number;
  wholesalePriceAtSale: number;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  salary: number;
  branchId?: string;
  daysWorkedAccumulated?: number;
  lastLoginDate?: string;
  isDeleted?: boolean;
  hasPerformanceTracking?: boolean;
  phoneNumber?: string;
  imageUrl?: string;
  hiringDate?: string;
  totalDaysWorked?: number;
  discountsAccumulated?: number;
  createdAt?: number;
  isPasswordChanged?: boolean; 
  birthDate?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  wholesalePrice: number; 
  retailPrice: number;
  stock: number;
  lowStockThreshold: number;
  isDeleted?: boolean;
  deletionReason?: string;
  deletionTimestamp?: number;
  deletedBy?: string;
  branchId?: string;
}

export interface Invoice {
  id: string;
  items: SaleItem[];
  totalBeforeDiscount: number;
  discountValue: number;
  netTotal: number;
  date: string;
  time: string;
  timestamp: number;
  customerName?: string;
  customerPhone?: string;
  status: 'completed' | 'pending' | 'cancelled';
  createdBy: string;
  creatorUsername?: string;
  branchId?: string;
  shiftId?: string;
  isDeleted?: boolean;
  discountType?: 'percentage' | 'fixed';
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  time: string;
  timestamp: number;
  createdBy: string;
  branchId?: string;
  notes?: string;
}

export interface ReturnRecord {
  id: string;
  invoiceId: string;
  items: ReturnItem[];
  totalRefund: number;
  date: string;
  time: string;
  timestamp: number;
  createdBy: string;
  branchId?: string;
  isDeleted?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  operationalNumber: string;
  taxNumber?: string;
  commercialRegister?: string;
  status: 'active' | 'closed_temp';
  createdAt: number;
  isDeleted?: boolean;
}

export interface ArchiveRecord {
  id: string;
  itemType: string;
  itemId: string;
  originalData: any;
  deletedBy: string;
  deleterName: string;
  reason: string;
  timestamp: number;
}

export interface ActivityLog {
  id: string;
  type: string;
  user: string;
  details: string;
  amount: number;
  timestamp: number;
  time: string;
  date: string;
}

export type ViewType = 
  | 'dashboard' | 'sales' | 'inventory' | 'returns' | 'expenses' | 'reports' | 'archive' 
  | 'recycleBin' | 'customers' | 'purchases' | 'staff' | 'settings' | 'userProfile' | 'treasury' | 'itControl' | 'dailyLogs' | 'correspondence';

export interface SystemSettings {
  appName: string;
  logoUrl: string;
  currency: string;
  allowInvoiceSuspension: boolean;
  globalSystemLock: boolean;
  inventory_method: 'WAC' | 'FIFO';
  roleHiddenSections?: Record<string, string[]>;
  userHiddenSections?: Record<string, string[]>;
  roleHiddenActions?: Record<string, string[]>;
  userHiddenActions?: Record<string, string[]>;
}

export interface PermissionOverride {
  id: string;
  targetType: 'user' | 'role';
  targetId: string;
  action: string;
  isAllowed: boolean;
  notes?: string;
}

export interface Correspondence {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  receiverRole: string;
  receiverId?: string; 
  subject: string;
  content: string;
  isBroadcast: boolean;
  isRead: boolean;
  timestamp: number;
  isArchived?: boolean;
  isDeleted?: boolean;
  parentMessageId?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  targetRole?: string; 
  startDate: string;
  endDate: string;
  reason: string;
  type: 'normal' | 'emergency';
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  taxNumber?: string;
  commercialRegister?: string;
  totalDebt: number;
  totalPaid: number;
  totalSupplied: number;
  isDeleted?: boolean;
}

export interface PurchaseRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNo?: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'cash' | 'credit';
  date: string;
  time: string;
  timestamp: number;
  createdBy: string;
  branchId?: string;
  isDeleted?: boolean;
  notes?: string;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  quantity: number;
  costPrice: number;
  retailPrice: number;
  subtotal: number;
}

export interface PurchaseReturnRecord {
  id: string;
  originalPurchaseId: string;
  supplierId: string;
  items: PurchaseItem[];
  totalRefund: number;
  refundMethod: 'cash' | 'debt_deduction'; // cash means we got money back, debt_deduction means we reduced what we owe
  isMoneyReceived: boolean; // if cash, did we receive it?
  date: string;
  time: string;
  timestamp: number;
  createdBy: string;
  branchId?: string;
  notes?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  purchaseId: string | null;
  amount: number;
  notes?: string;
  timestamp: number;
  date?: string;
  time?: string;
}

export interface StaffPayment {
  id: string;
  staffId: string;
  amount: number;
  paymentType: StaffPaymentType;
  paymentDate: string;
  notes?: string;
  createdBy?: string;
}

export interface TreasuryLog {
  id: string;
  branchId: string;
  type: 'in' | 'out';
  source: string;
  referenceId: string;
  amount: number;
  notes?: string;
  createdBy: string;
  timestamp: number; // Changed from string to number to match DB BIGINT
}

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  actionType: string;
  entityType: string;
  entityId: string;
  details: string;
  oldData?: any;
  newData?: any;
  timestamp: number;
}

export type ProceduralAction = string;

export interface Shift {
  id: string;
  userId: string;
  branchId?: string;
  startTimestamp: string;
  endTimestamp?: string;
  openingBalance: number;
  expectedClosingBalance: number;
  actualClosingBalance: number;
  difference: number;
  status: 'open' | 'closed';
  notes?: string;
}
