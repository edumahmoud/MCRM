
import React, { useState, useEffect, useCallback } from 'react';
import { ViewType, User as UserType } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Returns from './components/Returns';
import Expenses from './components/Expenses';
import Reports from './components/Reports';
import Archive from './components/Archive';
import RecycleBin from './components/RecycleBin';
import Customers from './components/Customers';
import Purchases from './components/Purchases'; 
import Staff from './components/Staff';
import Treasury from './components/Treasury';
import Login from './components/Login';
import UserProfile from './components/UserProfile';
import ITControl from './components/itControl'; 
import DailyLogs from './components/DailyLogs';
import CorrespondenceView from './components/Correspondence';
import ConfirmModal from './components/ConfirmModal';
import { useInventory } from './hooks/useInventory';
import { useSalesData } from './hooks/useSalesData';
import { usePurchaseData } from './hooks/usePurchaseData';
import { useStaffData } from './hooks/useStaffData';
import { useSystemSettings } from './hooks/useSystemSettings';
import { useReturnData } from './hooks/useReturnData';
import { useArchiveData } from './hooks/useArchiveData';
import { useActivityLogs } from './hooks/useActivityLogs';
import { useAuditLogs } from './hooks/useAuditLogs';
import { useShiftData } from './hooks/useShiftData';
import { useCorrespondence } from './hooks/useCorrespondence';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('meeza_pos_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Default view set to userProfile as requested
  const [currentView, setView] = useState<ViewType>('userProfile');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);

  // Global Confirmation State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });
  
  // Hooks
  const inventory = useInventory();
  const salesData = useSalesData();
  const purchaseData = usePurchaseData();
  const staffData = useStaffData();
  const returnData = useReturnData();
  const archiveData = useArchiveData();
  const sys = useSystemSettings();
  const logsData = useActivityLogs();
  const audit = useAuditLogs(); 
  const corr = useCorrespondence(user);
  const { activeShift, openShift, closeShift } = useShiftData(user);

  useEffect(() => {
    if (!inventory.loading && !sys.loading) {
      setHasInitialLoaded(true);
    }
  }, [inventory.loading, sys.loading]);

  const isInitialBoot = !hasInitialLoaded && (inventory.loading || sys.loading);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const askConfirmation = useCallback((title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm,
      variant
    });
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('meeza_pos_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('meeza_pos_user');
    }
  }, [user]);

  if (!user) return <Login onLogin={setUser} onIncrementDay={staffData.incrementUserDay} />;

  const handleEmptyTrash = async () => {
    askConfirmation(
      "تفريغ سلة المهملات",
      "هل أنت متأكد من تفريغ كافة المحذوفات نهائياً؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          await corr.emptyTrashPermanent();
          await staffData.emptyLeavesTrashPermanent(user.id);
          showToast("تم تفريغ سلة المهملات نهائياً", "success");
        } catch (e) {
          showToast("فشل تفريغ السلة", "error");
        }
      }
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard 
          invoices={salesData.invoices} 
          returns={returnData.returns} 
          expenses={salesData.expenses} 
          products={inventory.products} 
          staffPayments={staffData.staffPayments}
          user={user}
          summaryStats={salesData.summaryStats}
          suppliers={purchaseData.suppliers}
        />;
      case 'sales':
        return <Sales 
          products={inventory.products} 
          invoices={salesData.invoices}
          activeShift={activeShift}
          branches={staffData.branches}
          onOpenShift={openShift}
          onCloseShift={closeShift}
          onSaveInvoice={salesData.saveInvoice}
          onDeductStock={inventory.deductStock}
          onShowToast={showToast}
          askConfirmation={askConfirmation}
          user={user}
          settings={sys.settings}
          canSell={sys.checkPermission(user, 'sell')}
        />;
      case 'inventory':
        return <Inventory 
          products={inventory.products} 
          branches={staffData.branches}
          onUpdateProduct={inventory.updateProduct}
          onDeleteProduct={inventory.deleteProduct}
          onShowToast={showToast}
          askConfirmation={askConfirmation}
          user={user}
          canDelete={sys.checkPermission(user, 'delete_product')}
          onProductClick={() => {}}
        />;
      case 'returns':
        return <Returns 
          invoices={salesData.invoices} 
          returns={returnData.returns}
          onAddReturn={returnData.addReturn}
          onDeleteReturn={() => {}}
          onRestockItem={inventory.deductStock}
          onShowToast={showToast}
          user={user}
          canReturn={sys.checkPermission(user, 'process_return')}
        />;
      case 'expenses':
        return <Expenses 
          expenses={salesData.expenses} 
          onAddExpense={salesData.addExpense}
          onDeleteExpense={salesData.deleteExpense}
          onShowToast={showToast}
          user={user}
        />;
      case 'archive':
        return <Archive 
          invoices={salesData.invoices} 
          returns={returnData.returns}
          branches={staffData.branches}
          settings={sys.settings}
          onDeleteInvoice={salesData.deleteInvoice}
          onShowToast={showToast}
          askConfirmation={askConfirmation}
          user={user}
          canDelete={sys.checkPermission(user, 'delete_invoice')}
        />;
      case 'recycleBin':
        return <RecycleBin archiveRecords={archiveData.archive} onShowToast={showToast} user={user} />;
      case 'customers':
        return <Customers invoices={salesData.invoices} returns={returnData.returns} onShowToast={showToast} />;
      case 'purchases':
        return <Purchases 
          products={inventory.products}
          suppliers={purchaseData.suppliers}
          purchases={purchaseData.purchases}
          payments={purchaseData.payments}
          branches={staffData.branches}
          onAddSupplier={purchaseData.addSupplier}
          onDeleteSupplier={purchaseData.deleteSupplier}
          onAddPurchase={purchaseData.addPurchase}
          onAddProduct={inventory.addProduct}
          onAddSupplierPayment={purchaseData.addSupplierPayment}
          onShowToast={showToast}
          askConfirmation={askConfirmation}
          user={user}
        />;
      case 'staff':
        return <Staff 
          currentUser={user}
          users={staffData.users}
          branches={staffData.branches}
          staffPayments={staffData.staffPayments}
          leaveRequests={staffData.leaveRequests}
          invoices={salesData.invoices}
          products={inventory.products}
          roles={sys.roles}
          settings={sys.settings}
          onUpdateSettings={sys.updateSettings}
          onAddUser={staffData.addUser}
          onTransferEmployee={staffData.onTransferEmployee}
          onUpdateBranch={staffData.updateBranch}
          onDeleteUser={staffData.deleteUser}
          onDeleteBranch={staffData.deleteBranch}
          onUpdateUserRole={staffData.updateUserRole}
          onAddStaffPayment={staffData.addStaffPayment}
          onResetPassword={staffData.resetUserPassword}
          onUpdateLeaveStatus={staffData.updateLeaveStatus}
          onShowToast={showToast}
          askConfirmation={askConfirmation}
          onAddBranch={staffData.addBranch}
          onAddRole={sys.addRole}
          onDeleteRole={sys.deleteRole}
          checkPermission={sys.checkPermission}
        />;
      case 'treasury':
        return <Treasury invoices={salesData.invoices} expenses={salesData.expenses} onShowToast={showToast} user={user} />;
      case 'dailyLogs':
        return <DailyLogs logs={logsData.logs} invoices={salesData.invoices} auditLogs={audit.auditLogs} onRefresh={logsData.refresh} user={user} />;
      case 'correspondence':
        return <CorrespondenceView 
          user={user}
          users={staffData.users}
          messages={corr.messages}
          leaveRequests={staffData.leaveRequests}
          roles={sys.roles}
          onSendMessage={corr.sendMessage}
          onAddLeaveRequest={staffData.addLeaveRequest}
          onMarkAsRead={corr.markAsRead}
          onUpdateMessageStatus={corr.updateMessageStatus}
          onDeleteMessagePermanent={corr.deleteMessagePermanent}
          onClearBox={corr.clearBox}
          onUpdateLeaveMeta={staffData.updateLeaveMeta}
          onDeleteLeavePermanent={staffData.deleteLeaveRequestPermanent}
          onClearLeaves={staffData.clearUserLeaves}
          onShowToast={showToast}
          askConfirmation={askConfirmation}
          onUpdateLeaveStatus={staffData.updateLeaveStatus}
          onEmptyTrash={handleEmptyTrash}
        />;
      case 'userProfile':
        return <UserProfile 
          user={user} 
          staffPayments={staffData.staffPayments} 
          invoices={salesData.invoices} 
          branches={staffData.branches} 
          roles={sys.roles} 
          onShowToast={showToast}
          onUpdateCurrentUser={(updates) => setUser(prev => prev ? {...prev, ...updates} : null)}
          onAddLeaveRequest={staffData.addLeaveRequest}
        />;
      case 'itControl':
        return <ITControl 
          settings={sys.settings}
          overrides={sys.overrides}
          roles={sys.roles}
          onUpdateSettings={sys.updateSettings}
          onAddOverride={sys.addOverride}
          onRemoveOverride={sys.removeOverride}
          onAddRole={sys.addRole}
          onDeleteRole={sys.deleteRole}
          onShowToast={showToast}
          user={user}
        />;
      default:
        return <Dashboard invoices={salesData.invoices} returns={returnData.returns} expenses={salesData.expenses} products={inventory.products} staffPayments={staffData.staffPayments} user={user} summaryStats={salesData.summaryStats} />;
    }
  };

  if (isInitialBoot) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6">
        <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <h1 className="text-2xl font-black mb-1">Meeza Intelligence</h1>
          <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest animate-pulse">Syncing Cloud Database...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout 
        currentView={currentView} 
        setView={setView} 
        products={inventory.products} 
        leaveRequests={staffData.leaveRequests}
        messages={corr.messages}
        onReset={() => {}} 
        onRestore={() => {}} 
        toast={toast} 
        onCloseToast={() => setToast(null)}
        user={user}
        onLogout={() => { setUser(null); localStorage.removeItem('meeza_pos_user'); }}
        settings={sys.settings}
        users={staffData.users}
        roles={sys.roles}
        branches={staffData.branches}
      >
        {renderContent()}
      </Layout>
      
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};

export default App;
