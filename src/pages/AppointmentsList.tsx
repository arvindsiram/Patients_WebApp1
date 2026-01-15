import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, Activity, FileText, XCircle, AlertTriangle, Eye, X, Mail, Phone, User, LogOut, ChevronLeft } from 'lucide-react';

// --- CONFIGURATION ---
// Ensure your .env has VITE_ prefix for these to work on Render/Production
const N8N_CANCEL_WEBHOOK = import.meta.env.VITE_N8N_CANCEL_APPOINTMENT; 

const AppointmentsList = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for Report Preview Modal
  const [selectedReport, setSelectedReport] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  // --- HELPER: Robust Date Parser ---
  // Designed to handle "2026-01-19", "19 January 2026", and "26th Jan"
  const getAppointmentDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    try {
      // 1. Clean the date string: remove ordinals (st, nd, rd, th)
      const cleanDate = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1').trim();
      
      // 2. Clean the time string: handle spacing like "9: 30 am"
      const cleanTime = timeStr.replace(/\s+/g, ' ').trim();

      let dateObj;

      // 3. Logic to handle multiple formats found in your database
      if (/\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
        // Standard ISO Format: 2026-01-19
        dateObj = new Date(`${cleanDate}T${cleanTime.includes(':') ? cleanTime : cleanTime + ':00'}`);
      } else if (/\d{4}/.test(cleanDate)) {
        // Long Format with Year: 19 January 2026
        dateObj = new Date(`${cleanDate} ${cleanTime}`);
      } else {
        // Short Format missing Year: 26th Jan
        const currentYear = new Date().getFullYear();
        dateObj = new Date(`${cleanDate} ${currentYear} ${cleanTime}`);
        
        // Year Rollover: If appt is Jan but current month is Dec, set to next year
        const now = new Date();
        if (dateObj < now && (now.getMonth() - dateObj.getMonth()) > 6) {
          dateObj.setFullYear(currentYear + 1);
        }
      }

      return isNaN(dateObj.getTime()) ? null : dateObj;
    } catch (e) {
      console.error("Date parse error", e);
      return null;
    }
  };

  // --- HELPER: Check Cancellation Rules (>= 12 Hours) ---
  const isCancellable = (appt) => {
    if (appt.status !== 'Scheduled') return false;
    const apptDate = getAppointmentDateTime(appt.date, appt.start_time);
    if (!apptDate) return false;
    
    const now = new Date();
    const diffInHours = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    return diffInHours >= 12;
  };

  // --- ACTION: Handle Cancellation ---
  const handleCancel = async (appt) => {
    const confirmed = window.confirm("Are you sure? This cannot be undone.");
    if (!confirmed) return;

    try {
      // 1. Update status in Supabase
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appt.id);

      if (error) throw error;

      // 2. Optimistic UI update
      setAppointments(prev => prev.map(item => 
        item.id === appt.id ? { ...item, status: 'Cancelled' } : item
      ));

      // 3. Trigger Webhook with exact fields for your n8n DateTime expression
      if (N8N_CANCEL_WEBHOOK) {
        fetch(N8N_CANCEL_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointment_id: appt.id,
            patient_name: appt.patient_name,
            email: appt.email,      // Patient's email from database row
            date: appt.date,       // Raw string for n8n format check
            time: appt.start_time, // Raw string for n8n format check
            user_email: user?.email, // Logged-in doctor's email
            cancelled_at: new Date().toISOString()
          })
        }).catch(err => console.error("Webhook failed:", err));
      }
      
      alert("Appointment successfully cancelled.");
    } catch (err) {
      console.error(err);
      alert("Failed to update appointment status.");
    }
  };

  // --- ACTION: Handle Report Preview ---
  const openReportPreview = (base64String) => {
    if (!base64String || base64String === 'NULL') return;
    
    const finalDataUri = base64String.startsWith('data:') 
      ? base64String 
      : `data:application/pdf;base64,${base64String}`;
    setSelectedReport(finalDataUri);
  };

  // --- FETCH: Load User-Specific Appointments ---
  useEffect(() => {
    const fetchUserAppointments = async () => {
      if (!user?.email) return;

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .ilike('email', user.email.trim()) 
          .order('date', { ascending: true });

        if (error) throw error;
        setAppointments(data || []);
      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAppointments();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="text-indigo-600" /> My Appointments
            </h1>
            <p className="text-slate-500 mt-1">Logged in as {user?.email}</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={handleBackToDashboard} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-all">
              <ChevronLeft size={18} /> Dashboard
            </button>
            <button onClick={handleLogout} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all shadow-md shadow-red-100">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 animate-pulse font-medium">Loading your records...</div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center text-slate-500">
            No appointments found for this account.
          </div>
        ) : (
          <div className="grid gap-6">
            {appointments.map((appt) => {
              const cancellable = isCancellable(appt);
              return (
                <div key={appt.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between gap-6 hover:shadow-md transition-shadow">
                  
                  {/* Left Column: Patient Details */}
                  <div className="flex-grow space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600"><User size={24} /></div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 capitalize">{appt.patient_name}</h3>
                        <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium"><Mail size={14}/> {appt.email}</span>
                          <span className="flex items-center gap-1.5 font-medium"><Phone size={14}/> {appt.phone_number}</span>
                        </div>
                      </div>
                      <span className={`ml-auto lg:ml-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        appt.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        appt.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>{appt.status}</span>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason for Visit</p>
                      <p className="text-slate-700 font-medium">{appt.patient_symptoms}</p>
                    </div>
                  </div>

                  {/* Right Column: Time & Actions */}
                  <div className="lg:w-64 flex flex-col justify-between items-end border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                    <div className="text-right w-full">
                      <div className="text-2xl font-black text-slate-900 leading-none">{appt.date}</div>
                      <div className="text-lg font-bold text-indigo-600 flex items-center justify-end gap-1 mt-1">
                        <Clock size={18} /> {appt.start_time}
                      </div>
                    </div>

                    <div className="flex gap-2.5 mt-6 w-full lg:w-auto">
                      {appt.report_url && appt.report_url !== 'NULL' && (
                        <button 
                          onClick={() => openReportPreview(appt.report_url)}
                          className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                        >
                          <Eye size={18} /> Report
                        </button>
                      )}

                      {cancellable ? (
                        <button 
                          onClick={() => handleCancel(appt)}
                          className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                        >
                          <XCircle size={18} /> Cancel
                        </button>
                      ) : (
                        appt.status === 'Scheduled' && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] italic font-semibold">
                            <AlertTriangle size={14} /> Non-cancellable
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REPORT PREVIEW MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-8 py-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-600" /> Medical Report Preview
              </h3>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-all"
              >
                <X size={28} />
              </button>
            </div>
            <div className="flex-grow bg-slate-100">
              <iframe 
                src={selectedReport} 
                className="w-full h-full border-none bg-white"
                title="Medical Report Viewer"
              />
            </div>
            <div className="bg-white p-4 border-t flex justify-center">
               <a 
                 href={selectedReport} 
                 download="Patient_Report.pdf" 
                 className="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-2"
               >
                 Download PDF Copy
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsList;
