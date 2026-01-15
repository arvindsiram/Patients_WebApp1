import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext'; // Using the alias you established
import { createClient } from '@supabase/supabase-js';
import { Clock, Activity, FileText, XCircle, AlertTriangle, Eye, X, Phone, Mail, User, LogOut, ChevronLeft } from 'lucide-react';

// --- CONFIGURATION ---
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const N8N_CANCEL_WEBHOOK = import.meta.env.VITE_N8N_CANCEL_APPOINTMENT; 

const AppointmentsList = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // Re-integrated Auth context
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  // --- HELPER: Robust Date Parser ---
  const getAppointmentDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return null;
    try {
      const cleanDate = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1').trim();
      const cleanTime = timeStr.replace(/\s+/g, ' ').trim();

      let dateObj: Date;

      // Logic to handle formats like "2026-01-19" or "19 January 2026"
      if (/\d{4}-\d{2}-\d{2}/.test(cleanDate)) {
        dateObj = new Date(`${cleanDate}T${cleanTime.includes(':') ? cleanTime : cleanTime + ':00'}`);
      } else if (/\d{4}/.test(cleanDate)) {
        dateObj = new Date(`${cleanDate} ${cleanTime}`);
      } else {
        const currentYear = new Date().getFullYear();
        dateObj = new Date(`${cleanDate} ${currentYear} ${cleanTime}`);
        
        const now = new Date();
        if (dateObj < now && (now.getMonth() - dateObj.getMonth()) > 6) {
          dateObj.setFullYear(currentYear + 1);
        }
      }
      return isNaN(dateObj.getTime()) ? null : dateObj;
    } catch (e) {
      return null;
    }
  };

  // --- HELPER: 12-Hour Rule ---
  const isCancellable = (appt: any) => {
    if (appt.status !== 'Scheduled') return false;
    const apptDate = getAppointmentDateTime(appt.date, appt.start_time);
    if (!apptDate) return false;
    
    const diffInHours = (apptDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return diffInHours >= 12;
  };

  const handleCancel = async (appt: any) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appt.id);

      if (error) throw error;

      setAppointments((prev: any) => prev.map((item: any) => 
        item.id === appt.id ? { ...item, status: 'Cancelled' } : item
      ));

      if (N8N_CANCEL_WEBHOOK) {
        fetch(N8N_CANCEL_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointment_id: appt.id,
            patient_name: appt.patient_name,
            email: appt.email, // Patient email from table row
            user_email: user?.email, // Logged-in doctor/user email
            cancelled_at: new Date().toISOString()
          })
        });
      }
      alert("Cancelled.");
    } catch (err) {
      alert("Error cancelling.");
    }
  };

  const openReport = (base64: string) => {
    if (!base64 || base64 === 'NULL') return;
    const uri = base64.startsWith('data:') ? base64 : `data:application/pdf;base64,${base64}`;
    setSelectedReport(uri);
  };

  useEffect(() => {
    const fetchUserAppointments = async () => {
      if (!user?.email) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('appointments')
          .select('id, patient_name, email, phone_number, patient_symptoms, report_url, date, status, start_time')
          .ilike('email', user.email.trim()) // Filtering by logged-in user email
          .order('date', { ascending: true });

        if (error) throw error;
        setAppointments(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAppointments();
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Header with Auth controls */}
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="text-indigo-600" /> My Visits
            </h1>
            <p className="text-slate-500 text-sm mt-1">Logged in as: <span className="font-semibold">{user?.email}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 border rounded-xl flex items-center gap-2">
              <ChevronLeft size={16} /> Dashboard
            </button>
            <button onClick={logout} className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl flex items-center gap-2 shadow-md shadow-red-100">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-slate-400 animate-pulse">Fetching your appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed text-center text-slate-500">
            No appointments found for {user?.email}.
          </div>
        ) : (
          <div className="grid gap-6">
            {appointments.map((appt: any) => {
              const cancellable = isCancellable(appt);
              return (
                <div key={appt.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-grow space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><User size={20} /></div>
                      <h3 className="text-xl font-bold text-slate-800 capitalize">{appt.patient_name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        appt.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        appt.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>{appt.status}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-500">
                      <span className="flex items-center gap-2"><Mail size={14}/> {appt.email}</span>
                      <span className="flex items-center gap-2"><Phone size={14}/> {appt.phone_number}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase">Symptoms</p>
                      <p className="text-slate-700 text-sm">{appt.patient_symptoms}</p>
                    </div>
                  </div>

                  <div className="md:w-64 flex flex-col justify-between items-end border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-900">{appt.date}</div>
                      <div className="text-sm font-bold text-slate-400 flex items-center justify-end gap-1"><Clock size={14} /> {appt.start_time}</div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {appt.report_url && appt.report_url !== 'NULL' && (
                        <button onClick={() => openReport(appt.report_url)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"><Eye size={20} /></button>
                      )}
                      {cancellable ? (
                        <button onClick={() => handleCancel(appt)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><XCircle size={20} /></button>
                      ) : appt.status === 'Scheduled' && (
                        <span className="text-[10px] text-slate-400 italic flex items-center gap-1"><AlertTriangle size={12} /> Non-cancellable</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b flex justify-between bg-slate-50 items-center">
              <span className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18} /> Report Preview</span>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <iframe src={selectedReport} className="flex-grow w-full border-none" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsList;
