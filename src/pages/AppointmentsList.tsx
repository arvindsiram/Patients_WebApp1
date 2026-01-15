import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Clock, Activity, FileText, XCircle, AlertTriangle, Eye, X, Phone, Mail } from 'lucide-react';

// --- CONFIGURATION ---
// Initializing Supabase directly as requested to avoid extra lib folders
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const N8N_CANCEL_WEBHOOK = import.meta.env.VITE_N8N_CANCEL_APPOINTMENT; 

const AppointmentsList = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  // --- HELPER: Robust Date Parser ---
  // Fixes the bug where dates like "19 january 2026" were failing
  const getAppointmentDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    try {
      // 1. Remove ordinal suffixes (st, nd, rd, th)
      const cleanDate = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1').trim();
      const cleanTime = timeStr.replace(/\s+/g, ' ').trim();

      let dateObj;
      // 2. Check if the string already includes a 4-digit year
      if (/\d{4}/.test(cleanDate)) {
        dateObj = new Date(`${cleanDate} ${cleanTime}`);
      } else {
        // If year is missing (e.g. "26th jan"), append current year
        const currentYear = new Date().getFullYear();
        dateObj = new Date(`${cleanDate} ${currentYear} ${cleanTime}`);
      }

      // 3. Handle Year Rollover (e.g. current month is Dec and appointment is Jan)
      if (!/\d{4}/.test(cleanDate)) {
         const now = new Date();
         if (dateObj < now && (now.getMonth() - dateObj.getMonth()) > 6) {
           dateObj.setFullYear(dateObj.getFullYear() + 1);
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
    
    const diffInHours = (apptDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return diffInHours >= 12;
  };

  // --- ACTION: Handle Cancellation ---
  const handleCancel = async (appt) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      // Updating status based on the specific row ID
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appt.id);

      if (error) throw error;

      // Optimistic UI update
      setAppointments(prev => prev.map(item => 
        item.id === appt.id ? { ...item, status: 'Cancelled' } : item
      ));

      // Triggering N8N with the patient's email from the record
      fetch(N8N_CANCEL_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appt.id,
          patient_name: appt.patient_name,
          email: appt.email, 
          reason: "User cancelled via dashboard",
          cancelled_at: new Date().toISOString()
        })
      });
      alert("Appointment cancelled.");
    } catch (err) {
      console.error(err);
      alert("Failed to cancel appointment.");
    }
  };

  // --- ACTION: Handle Report Preview ---
  const openReportPreview = (base64String) => {
    if (!base64String || base64String === 'NULL') return;
    
    // Ensure base64 string has the correct PDF prefix
    const finalDataUri = base64String.startsWith('data:') 
      ? base64String 
      : `data:application/pdf;base64,${base64String}`;
    setSelectedReport(finalDataUri);
  };

  // --- FETCH: Get All Appointment Data ---
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        // Selecting all relevant columns from the appointments table
        const { data, error } = await supabase
          .from('appointments')
          .select('id, patient_name, email, phone_number, patient_symptoms, report_url, date, status, start_time')
          .order('date', { ascending: true });

        if (error) throw error;
        setAppointments(data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans relative">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Clinic Records</h1>
            <p className="text-slate-500 text-sm mt-1">Master appointment list</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Back to Dashboard
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading records...</div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-dashed text-center text-slate-500">
            No appointments found in the system.
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => {
              const canCancel = isCancellable(appt);
              return (
                <div key={appt.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-5">
                  
                  {/* Left: Patient & Date Info */}
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 text-indigo-700 px-4 py-3 rounded-lg text-center min-w-[100px]">
                      <div className="text-xs uppercase font-bold text-indigo-400">Date</div>
                      <div className="font-bold text-lg leading-tight mt-1">{appt.date}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-800 text-lg capitalize">{appt.patient_name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          appt.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          appt.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                      <div className="space-y-1 mt-2">
                         <div className="flex items-center gap-2 text-sm text-slate-500">
                           <Clock size={14} /> {appt.start_time}
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-500">
                           <Mail size={14} /> {appt.email}
                         </div>
                         <div className="flex items-center gap-2 text-sm text-slate-500">
                           <Phone size={14} /> {appt.phone_number}
                         </div>
                      </div>
                      <div className="mt-3 bg-slate-50 p-2 rounded border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Symptoms</p>
                        <p className="text-sm text-slate-700">{appt.patient_symptoms}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-3 justify-end border-t md:border-t-0 pt-4 md:pt-0">
                    {appt.report_url && appt.report_url !== 'NULL' && (
                      <button 
                        onClick={() => openReportPreview(appt.report_url)}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        <Eye size={16} /> View Report
                      </button>
                    )}

                    {canCancel && (
                      <button 
                        onClick={() => handleCancel(appt)}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <XCircle size={16} /> Cancel
                      </button>
                    )}
                    
                    {!canCancel && appt.status === 'Scheduled' && (
                      <span className="text-xs text-slate-400 italic flex gap-1 items-center">
                        <AlertTriangle size={12} /> Non-cancellable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REPORT PREVIEW MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                Medical Report Preview
              </h3>
              <button 
                onClick={() => setSelectedReport(null)}
                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-grow bg-gray-100">
              <iframe 
                src={selectedReport} 
                className="w-full h-full border-none bg-white"
                title="Report Preview"
              />
            </div>
            
            <div className="bg-white p-3 border-t flex justify-end">
               <a 
                 href={selectedReport} 
                 download="Medical_Report.pdf" 
                 className="text-sm text-indigo-600 hover:underline font-medium"
               >
                 Download File
               </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsList;
