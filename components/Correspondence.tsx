
import React, { useState, useMemo } from 'react';
import { 
  Mail, Send, Search, Users, ShieldCheck, Briefcase, Clock, Calendar, 
  MessageSquare, UserCircle, Bell, ArrowRight, X, Power, UserPlus, 
  CheckCircle2, AlertTriangle, Filter, ChevronLeft, Plus, Smartphone, Reply, 
  User as UserIcon, Building2, Fingerprint, Trash2, Eraser, Archive, RotateCcw, Box, Star, RefreshCw, BellRing, Inbox, ClipboardCheck, CornerUpLeft, FileText, ListChecks
} from 'lucide-react';
import { Correspondence, User, LeaveRequest, UserRole } from '../types';

interface CorrespondenceProps {
  user: User;
  users: User[]; 
  messages: any[]; 
  leaveRequests: LeaveRequest[];
  roles: any[];
  onSendMessage: (msg: Omit<Correspondence, 'id' | 'timestamp' | 'isRead'>, secondaryId?: string) => Promise<void>;
  onAddLeaveRequest: (req: Omit<LeaveRequest, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  onMarkAsRead: (id: string) => Promise<void>;
  onUpdateMessageStatus: (id: string, updates: { isArchived?: boolean, isDeleted?: boolean }) => Promise<void>;
  onDeleteMessagePermanent: (id: string) => Promise<void>;
  onClearBox: (type: 'inbox' | 'sent') => Promise<void>;
  onUpdateLeaveMeta: (id: string, updates: { isArchived?: boolean, isDeleted?: boolean }) => Promise<void>;
  onDeleteLeavePermanent: (id: string) => Promise<void>;
  onClearLeaves: (userId: string) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  onUpdateLeaveStatus?: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  onEmptyTrash?: () => Promise<void>;
}

const CorrespondenceView: React.FC<CorrespondenceProps> = ({ 
  user, users, messages, leaveRequests, roles, 
  onSendMessage, onAddLeaveRequest, onMarkAsRead, 
  onUpdateMessageStatus, onDeleteMessagePermanent, onClearBox, 
  onUpdateLeaveMeta, onDeleteLeavePermanent, onClearLeaves, onShowToast,
  askConfirmation, onUpdateLeaveStatus, onEmptyTrash
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'requests' | 'myLeaves' | 'sent' | 'archive' | 'trash'>('inbox');
  const [isNewMsgOpen, setIsNewMsgOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');

  const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', content: '', isBroadcast: false });
  const [leaveForm, setLeaveForm] = useState({ type: 'normal' as 'normal' | 'emergency', startDate: '', endDate: '', reason: '', targetRole: '' });

  const isManager = useMemo(() => [
    'admin', 'branch_manager', 'supervisor', 'it_support', 'general_manager', 
    'sales_manager', 'sales_supervisor', 'warehouse_manager', 'warehouse_supervisor'
  ].includes(user.role), [user.role]);
  
  const userSeniority = useMemo(() => roles?.find(r => r.role_key === user.role)?.seniority || 0, [roles, user.role]);

  const filteredInbox = useMemo(() => {
    return messages.filter(m => 
      m.senderId !== user.id && 
      (m.receiverId === user.id || m.receiverRole === user.role || m.receiverRole === 'all' || m.isBroadcast) &&
      !m.isArchived && !m.isDeleted
    ).map(m => ({ ...m, itemType: 'message' }));
  }, [messages, user]);

  const incomingRequests = useMemo(() => {
    if (!isManager) return [];
    return leaveRequests.filter(l => {
      const requester = users.find(u => u.id === l.userId);
      const requesterSeniority = roles?.find(r => r.role_key === l.userRole)?.seniority || 0;
      const isPending = l.status === 'pending' && !l.isArchived && !l.isDeleted && l.userId !== user.id;
      if (!isPending) return false;
      if (l.targetRole && l.targetRole !== user.role) return false;
      if (['branch_manager', 'supervisor'].includes(user.role)) {
        return requester?.branchId === user.branchId && userSeniority > requesterSeniority;
      }
      return userSeniority > requesterSeniority;
    }).map(l => ({ ...l, itemType: 'leave' }));
  }, [leaveRequests, user, roles, isManager, userSeniority, users]);

  const myLeaves = useMemo(() => {
    return leaveRequests.filter(l => l.userId === user.id && !l.isDeleted).map(l => ({ ...l, itemType: 'leave' }));
  }, [leaveRequests, user.id]);

  const trashItems = useMemo(() => {
    const msgs = messages.filter(m => m.isDeleted && (m.senderId === user.id || m.receiverId === user.id)).map(m => ({ ...m, itemType: 'message' }));
    const leaves = leaveRequests.filter(l => l.userId === user.id && l.isDeleted).map(l => ({ ...l, itemType: 'leave' }));
    return [...msgs, ...leaves].sort((a, b) => b.timestamp - a.timestamp);
  }, [messages, leaveRequests, user]);

  const handleSendMessage = async () => {
    if (!msgForm.isBroadcast && selectedRecipients.length === 0) return onShowToast("حدد مستلم واحد على الأقل", "error");
    if (!msgForm.subject || !msgForm.content) return onShowToast("أكمل بيانات الرسالة", "error");

    setIsSubmitting(true);
    try {
      if (msgForm.isBroadcast) {
        await onSendMessage({ 
          senderId: user.id, 
          senderName: user.fullName, 
          senderRole: user.role, 
          receiverRole: 'all', 
          subject: msgForm.subject, 
          content: msgForm.content, 
          isBroadcast: true 
        });
      } else {
        for (const recipient of selectedRecipients) {
          await onSendMessage({ 
            senderId: user.id, 
            senderName: user.fullName, 
            senderRole: user.role, 
            receiverRole: recipient.role, 
            receiverId: recipient.id, 
            subject: msgForm.subject, 
            content: msgForm.content, 
            isBroadcast: false 
          });
        }
      }
      onShowToast("تم الإرسال بنجاح", "success");
      setIsNewMsgOpen(false);
      setMsgForm({ subject: '', content: '', isBroadcast: false });
      setSelectedRecipients([]);
    } catch (e: any) { 
      onShowToast(`خطأ في الإرسال`, "error"); 
    } finally { setIsSubmitting(false); }
  };

  const handleReply = () => {
    if (!selectedMsg) return;
    const recipient = users.find(u => u.id === selectedMsg.senderId);
    if (!recipient) return onShowToast("تعذر العثور على الموظف للرد", "error");
    
    setSelectedRecipients([recipient]);
    setMsgForm({
      subject: `رد على: ${selectedMsg.subject}`,
      content: `\n\n--- الرسالة الأصلية ---\n${selectedMsg.content}`,
      isBroadcast: false
    });
    setSelectedMsg(null);
    setIsNewMsgOpen(true);
  };

  const handleLeaveSubmit = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      return onShowToast("يرجى إكمال بيانات الإجازة", "error");
    }
    setIsSubmitting(true);
    try {
      await onAddLeaveRequest({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
        type: leaveForm.type,
        targetRole: leaveForm.targetRole || undefined
      });
      onShowToast("تم تقديم طلب الإجازة", "success");
      setIsLeaveOpen(false);
      setLeaveForm({ type: 'normal', startDate: '', endDate: '', reason: '', targetRole: '' });
    } catch (e) { onShowToast("فشل التقديم", "error"); }
    finally { setIsSubmitting(false); }
  };

  const handleRejectLeave = async () => {
    if (!selectedLeave || !rejectionNote.trim()) return onShowToast("يرجى ذكر سبب الرفض", "error");
    setIsSubmitting(true);
    try {
      if (onUpdateLeaveStatus) await onUpdateLeaveStatus(selectedLeave.id, 'rejected');
      await onSendMessage({
        senderId: user.id,
        senderName: user.fullName,
        senderRole: user.role,
        receiverId: selectedLeave.userId,
        receiverRole: selectedLeave.userRole,
        subject: `تحديث: تم رفض طلب إجازتكم`,
        content: `تم رفض الإجازة (من ${selectedLeave.startDate} إلى ${selectedLeave.endDate}). \n\nسبب الرفض: ${rejectionNote}`,
        isBroadcast: false
      });
      onShowToast("تم الرفض وإبلاغ الموظف", "success");
      setSelectedLeave(null);
      setRejectionNote('');
    } catch (e) { onShowToast("حدث خطأ", "error"); }
    finally { setIsSubmitting(false); }
  };

  const handleEmptyTrashSubmit = async () => {
    if (onEmptyTrash) onEmptyTrash();
  };

  const renderItemActions = (item: any, type: 'message' | 'leave') => {
    const isTrash = activeTab === 'trash';
    const isArchive = activeTab === 'archive';

    const handleRestore = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (type === 'message') await onUpdateMessageStatus(item.id, {isDeleted: false});
        else await onUpdateLeaveMeta(item.id, {isDeleted: false});
        onShowToast("تمت الاستعادة", "success");
      } catch(err) { onShowToast("فشل", "error"); }
    };

    const handlePermanentDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      askConfirmation(
        "حذف نهائي",
        "هل أنت متأكد من حذف هذا السجل نهائياً؟ لا يمكن استعادة البيانات بعد ذلك.",
        async () => {
          try {
            if (type === 'message') await onDeleteMessagePermanent(item.id);
            else await onDeleteLeavePermanent(item.id);
            onShowToast("تم الحذف النهائي", "success");
          } catch(err) { onShowToast("فشل الحذف", "error"); }
        }
      );
    };

    const handleToggleArchive = async (e: React.MouseEvent, val: boolean) => {
      e.stopPropagation();
      try {
        if (type === 'message') await onUpdateMessageStatus(item.id, {isArchived: val});
        else await onUpdateLeaveMeta(item.id, {isArchived: val});
        onShowToast(val ? "تمت الأرشفة" : "ألغيت الأرشفة", "success");
      } catch(err) { onShowToast("فشل", "error"); }
    };

    const handleSoftDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        if (type === 'message') await onUpdateMessageStatus(item.id, {isDeleted: true});
        else await onUpdateLeaveMeta(item.id, {isDeleted: true});
        onShowToast("نُقل للسلة", "success");
      } catch(err) { onShowToast("فشل", "error"); }
    };

    return (
      <div className="flex gap-2">
        {isTrash ? (
          <>
            <button onClick={handleRestore} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="استعادة"><RotateCcw size={14}/></button>
            <button onClick={handlePermanentDelete} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="حذف نهائي"><Trash2 size={14}/></button>
          </>
        ) : isArchive ? (
          <>
            <button onClick={(e) => handleToggleArchive(e, false)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="إلغاء الأرشفة"><RotateCcw size={14}/></button>
            <button onClick={handleSoftDelete} className="p-2 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all" title="حذف للسلة"><Trash2 size={14}/></button>
          </>
        ) : (
          <>
            <button onClick={(e) => handleToggleArchive(e, true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="أرشفة"><Archive size={14}/></button>
            <button onClick={handleSoftDelete} className="p-2 bg-rose-50 text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="حذف للسلة"><Trash2 size={14}/></button>
          </>
        )}
      </div>
    );
  };

  const currentList = useMemo(() => {
    switch(activeTab) {
      case 'inbox': return [...filteredInbox].sort((a,b) => b.timestamp - a.timestamp);
      case 'requests': return [...incomingRequests].sort((a,b) => b.timestamp - a.timestamp);
      case 'myLeaves': return [...myLeaves].sort((a,b) => b.timestamp - a.timestamp);
      case 'sent': return messages.filter(m => m.senderId === user.id && !m.isArchived && !m.isDeleted).map(m => ({ ...m, itemType: 'message' }));
      case 'archive': return [...messages.filter(m => m.isArchived && !m.isDeleted && (m.senderId === user.id || m.receiverId === user.id)), ...leaveRequests.filter(l => l.userId === user.id && l.isArchived)].sort((a, b) => b.timestamp - a.timestamp);
      case 'trash': return trashItems;
      default: return [];
    }
  }, [activeTab, filteredInbox, incomingRequests, myLeaves, messages, leaveRequests, trashItems, user.id]);

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Header Tabs */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('inbox')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Inbox size={14}/> الوارد</button>
          {isManager && (
            <button onClick={() => setActiveTab('requests')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'requests' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}>
              <ClipboardCheck size={14}/> المراجعة {incomingRequests.length > 0 && <span className="px-1.5 bg-rose-500 text-white rounded text-[8px] animate-bounce">{incomingRequests.length}</span>}
            </button>
          )}
          <button onClick={() => setActiveTab('myLeaves')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'myLeaves' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}><ListChecks size={14}/> طلباتي</button>
          <button onClick={() => setActiveTab('sent')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'sent' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Send size={14}/> المرسلة</button>
          <button onClick={() => setActiveTab('archive')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'archive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Archive size={14}/> الأرشيف</button>
          <button onClick={() => setActiveTab('trash')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'trash' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}><Trash2 size={14}/> السلة</button>
        </div>
        <div className="flex gap-3 shrink-0">
           {activeTab === 'trash' && trashItems.length > 0 && (
             <button onClick={handleEmptyTrashSubmit} disabled={isSubmitting} className="px-6 py-3 bg-rose-50 text-rose-600 border border-rose-100 font-black rounded-xl text-[10px] flex items-center gap-2 hover:bg-rose-600 hover:text-white transition-all shadow-sm">
               {isSubmitting ? <RefreshCw size={16} className="animate-spin"/> : <Eraser size={16}/>} تفريغ السلة نهائياً
             </button>
           )}
           <button onClick={() => setIsLeaveOpen(true)} className="px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-[10px] flex items-center gap-2 hover:bg-indigo-50 shadow-sm"><Plus size={16}/> طلب إجازة</button>
           <button onClick={() => setIsNewMsgOpen(true)} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"><Send size={16}/> مراسلة جديدة</button>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="divide-y divide-slate-50">
           {currentList.map(item => {
             const isMsg = (item as any).itemType === 'message';
             const d = item as any;
             const statusColor = d.status === 'approved' ? 'text-emerald-500' : d.status === 'rejected' ? 'text-rose-500' : 'text-amber-500';
             
             // تحديد اسم المستقبل إذا كنا في البريد المرسل
             let displayTargetName = '';
             let displayTargetRole = '';
             if (activeTab === 'sent' && isMsg) {
                const targetUser = users.find(u => u.id === d.receiverId);
                displayTargetName = targetUser ? targetUser.fullName : (d.receiverRole === 'all' ? 'تعميم عام' : d.receiverRole);
                displayTargetRole = targetUser ? `(${roles.find(r=>r.role_key === targetUser.role)?.role_name || targetUser.role})` : '';
             }

             return (
               <div key={d.id} className={`p-6 flex items-center gap-6 group hover:bg-slate-50/50 transition-all ${isMsg && !d.isRead && activeTab === 'inbox' ? 'bg-indigo-50/30 border-r-4 border-indigo-600' : ''}`}>
                  <div onClick={() => { if(isMsg) { setSelectedMsg(d); if(activeTab === 'inbox') onMarkAsRead(d.id); } else { setSelectedLeave(d); } }} className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-inner cursor-pointer ${isMsg ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                    {isMsg ? (activeTab === 'sent' ? <Send size={20}/> : (d.senderName?.[0] || 'M')) : <BellRing size={20} className="text-amber-500"/>}
                  </div>
                  <div onClick={() => { if(isMsg) { setSelectedMsg(d); if(activeTab === 'inbox') onMarkAsRead(d.id); } else { setSelectedLeave(d); } }} className="flex-1 min-w-0 cursor-pointer">
                     <h4 className="font-black text-slate-800 text-xs truncate">
                       {isMsg ? d.subject : `إجازة: ${d.userName || user.fullName}`}
                       {!isMsg && <span className={`mr-2 text-[8px] font-black uppercase ${statusColor}`}>[{d.status}]</span>}
                     </h4>
                     <p className="text-[10px] text-slate-400 font-bold truncate">
                       {activeTab === 'sent' && isMsg 
                         ? `إلى: ${displayTargetName} ${displayTargetRole}` 
                         : (isMsg ? `من: ${d.senderName} (#${d.senderCode || '---'})` : `الفترة: ${d.startDate} إلى ${d.endDate}`)
                       }
                     </p>
                  </div>
                  <div className="text-left shrink-0 flex items-center gap-6">
                     <p className="hidden sm:block text-[9px] font-black text-slate-300">{new Date(d.timestamp).toLocaleDateString('ar-EG')}</p>
                     {activeTab === 'requests' && !isMsg ? (
                       <div className="flex gap-2">
                          <button onClick={async (e) => { e.stopPropagation(); if(onUpdateLeaveStatus) await onUpdateLeaveStatus(d.id, 'approved'); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><CheckCircle2 size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedLeave(d); }} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><X size={14}/></button>
                       </div>
                     ) : renderItemActions(d, isMsg ? 'message' : 'leave')}
                  </div>
               </div>
             );
           })}
           {currentList.length === 0 && (
             <div className="py-40 flex flex-col items-center justify-center opacity-20"><Inbox size={64} className="mb-4"/><p className="text-xs font-black uppercase tracking-widest">القائمة فارغة</p></div>
           )}
        </div>
      </div>

      {/* Leave Request Modal */}
      {isLeaveOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1500] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-black text-sm flex items-center gap-2"><Calendar size={18}/> تقديم طلب إجازة</h3>
                 <button onClick={() => setIsLeaveOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">نوع الإجازة</label>
                       <select className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-black text-xs" value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value as any})}>
                          <option value="normal">إجازة اعتيادية</option>
                          <option value="emergency">إجازة عارضة / طارئة</option>
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">إلى رتبة (اختياري)</label>
                       <select className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-black text-xs" value={leaveForm.targetRole} onChange={e => setLeaveForm({...leaveForm, targetRole: e.target.value})}>
                          <option value="">مديري المباشر</option>
                          {roles.map(r => <option key={r.role_key} value={r.role_key}>{r.role_name}</option>)}
                       </select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">تاريخ البدء</label>
                       <input type="date" className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-black text-xs" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-slate-400 uppercase">تاريخ العودة</label>
                       <input type="date" className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-black text-xs" value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">السبب / التفاصيل</label>
                    <textarea className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-xs h-24 resize-none" value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} placeholder="اكتب سبب طلب الإجازة هنا..." />
                 </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex gap-4">
                 <button onClick={() => setIsLeaveOpen(false)} className="flex-1 py-4 bg-white border rounded-xl text-xs font-black">إلغاء</button>
                 <button onClick={handleLeaveSubmit} disabled={isSubmitting} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl text-xs flex items-center justify-center gap-2">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>} إرسال الطلب
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* New Message Modal */}
      {isNewMsgOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1500] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-black text-sm flex items-center gap-2"><Send size={18}/> مراسلة جديدة</h3>
                 <button onClick={() => setIsNewMsgOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <button onClick={() => setMsgForm({...msgForm, isBroadcast: !msgForm.isBroadcast})} className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${msgForm.isBroadcast ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>إرسال تعميم (للجميع)</button>
                 {!msgForm.isBroadcast && (
                   <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 min-h-[45px] p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        {selectedRecipients.map(r => (<div key={r.id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black shadow-sm"><span>{r.fullName}</span><button onClick={() => setSelectedRecipients(selectedRecipients.filter(x=>x.id!==r.id))}><X size={12}/></button></div>))}
                        {selectedRecipients.length === 0 && <span className="text-[9px] text-slate-300 m-auto font-bold italic">اختر المستلمين...</span>}
                      </div>
                      <div className="relative">
                        <input type="text" placeholder="ابحث عن موظف..." className="w-full pr-4 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none" value={userSearchTerm} onFocus={() => setShowUserDropdown(true)} onChange={(e) => setUserSearchTerm(e.target.value)}/>
                        {showUserDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-56 overflow-y-auto z-[1600]">
                            {users.filter(u => u.id !== user.id && !u.isDeleted && (u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.username.toLowerCase().includes(userSearchTerm.toLowerCase()))).map(u => (
                              <button key={u.id} onClick={() => { setSelectedRecipients([...selectedRecipients, u]); setUserSearchTerm(''); setShowUserDropdown(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-indigo-50 border-b border-slate-50 text-right"><div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px]">{u.fullName[0]}</div><div><p className="text-[10px] font-black text-slate-800">{u.fullName}</p><p className="text-[8px] text-slate-400">#{u.username}</p></div></button>
                            ))}
                          </div>
                        )}
                      </div>
                   </div>
                 )}
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">الموضوع</label><input type="text" className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-black text-xs" value={msgForm.subject} onChange={e => setMsgForm({...msgForm, subject: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">المحتوى</label><textarea className="w-full px-5 py-3 bg-slate-50 border rounded-xl font-bold text-xs h-32 resize-none" value={msgForm.content} onChange={e => setMsgForm({...msgForm, content: e.target.value})} /></div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex gap-4">
                 <button onClick={() => setIsNewMsgOpen(false)} className="flex-1 py-4 bg-white border rounded-xl text-xs font-black">إلغاء</button>
                 <button onClick={handleSendMessage} disabled={isSubmitting} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-xl shadow-xl text-xs flex items-center justify-center gap-2">{isSubmitting ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16}/>} إرسال الآن</button>
              </div>
           </div>
        </div>
      )}

      {/* View Message Modal */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1600] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in flex flex-col">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border-2 border-indigo-400">{selectedMsg.senderName?.[0]}</div>
                    <div>
                       <h3 className="font-black text-sm">{selectedMsg.subject}</h3>
                       <p className="text-[9px] opacity-60 font-bold uppercase tracking-widest">{selectedMsg.senderName} (#{selectedMsg.senderCode}) | {new Date(selectedMsg.timestamp).toLocaleString('ar-EG')}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedMsg(null)}><X size={24}/></button>
              </div>
              <div className="p-10 flex-1 overflow-y-auto text-right min-h-[200px] bg-slate-50">
                <div className="p-8 bg-white rounded-[2.5rem] border text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-wrap shadow-inner italic">
                  "{selectedMsg.content}"
                </div>
              </div>
              <div className="p-6 bg-slate-100 border-t flex justify-between items-center">
                 <button onClick={handleReply} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg"><CornerUpLeft size={16}/> رد سريع</button>
                 <button onClick={() => setSelectedMsg(null)} className="px-8 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black">إغلاق</button>
              </div>
           </div>
        </div>
      )}

      {/* Leave Details / Review Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[1600] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-amber-600 text-white flex justify-between items-center shrink-0">
                 <h3 className="font-black text-sm flex items-center gap-2"><FileText size={18}/> تفاصيل طلب الإجازة</h3>
                 <button onClick={() => setSelectedLeave(null)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6 text-right max-h-[70vh] overflow-y-auto scrollbar-hide">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">الموظف</p><p className="text-xs font-black">{selectedLeave.userName}</p></div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">نوع الإجازة</p><p className="text-xs font-black">{selectedLeave.type === 'normal' ? 'إجازة اعتيادية' : 'إجازة طارئة'}</p></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">تاريخ البدء</p><p className="text-xs font-black font-mono">{selectedLeave.startDate}</p></div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">تاريخ العودة</p><p className="text-xs font-black font-mono">{selectedLeave.endDate}</p></div>
                 </div>
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">السبب والوصف</label><div className="p-6 bg-slate-50 rounded-2xl border text-xs font-bold text-slate-600 leading-relaxed italic">"{selectedLeave.reason}"</div></div>
                 
                 {activeTab === 'requests' && selectedLeave.status === 'pending' && (
                    <div className="pt-6 border-t space-y-4 animate-in fade-in slide-in-from-top-2">
                       <label className="text-[9px] font-black text-rose-600 uppercase">ملاحظة الإدارة عند الرفض (إلزامي للرفض)</label>
                       <textarea className="w-full px-5 py-3 bg-slate-50 border border-rose-100 rounded-xl font-bold text-xs h-20 resize-none outline-none focus:ring-2 focus:ring-rose-500/10" value={rejectionNote} onChange={e=>setRejectionNote(e.target.value)} placeholder="اكتب سبب الرفض هنا ليتم إبلاغ الموظف به..." />
                       <div className="flex gap-4">
                          <button onClick={handleRejectLeave} disabled={isSubmitting || !rejectionNote.trim()} className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl shadow-lg text-xs flex items-center justify-center gap-2 disabled:opacity-50"><X size={16}/> رفض الطلب</button>
                          <button onClick={async () => { if(onUpdateLeaveStatus) await onUpdateLeaveStatus(selectedLeave.id, 'approved'); setSelectedLeave(null); onShowToast("تم قبول الطلب", "success"); }} disabled={isSubmitting} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl shadow-lg text-xs flex items-center justify-center gap-2"><CheckCircle2 size={16}/> قبول الطلب</button>
                       </div>
                    </div>
                 )}
              </div>
              <div className="p-6 bg-slate-50 border-t flex justify-end"><button onClick={() => setSelectedLeave(null)} className="px-8 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black">إغلاق</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CorrespondenceView;
