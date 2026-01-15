import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Clock, Activity, FileText, XCircle, AlertTriangle, Eye, X } from 'lucide-react';

// --- CONFIGURATION ---
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

  // --- HELPER: Parse Dates ---
  const getAppointmentDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    try {
      const cleanDate = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1');
      const cleanTime = timeStr.replace(/:\s+/, ':');
      const currentYear = new Date().getFullYear();
      const dateObj = new Date(`${cleanDate} ${currentYear} ${cleanTime}`);
      
      // Logic for year rollover (e.g. Dec booking for Jan)
      if (dateObj < new Date() && (new Date().getMonth() - dateObj.getMonth()) > 6) {
        dateObj.setFullYear(currentYear + 1);
      }
      return dateObj;
    } catch (e) {
      return null;
    }
  };

  // --- HELPER: Check Cancellation Rules ---
  const isCancellable = (appt) => {
    if (appt.status !== 'Scheduled') return false;
    const apptDate = getAppointmentDateTime(appt.date, appt.start_time);
    if (!apptDate) return false; // If date parsing fails, default to strict (no cancel)
    
    const diffInHours = (apptDate - new Date()) / (1000 * 60 * 60);
    return diffInHours >= 12;
  };

  // --- ACTION: Handle Cancellation ---
  const handleCancel = async (appt) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appt.id);

      if (error) throw error;

      setAppointments(prev => prev.map(item => 
        item.id === appt.id ? { ...item, status: 'Cancelled' } : item
      ));

      fetch(N8N_CANCEL_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: appt.id,
          patient_name: appt.patient_name,
          email: user.email,
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
    if (!base64String) return;
    
    let finalDataUri = base64String;
    // Basic check to see if it's raw base64 without prefix
    if (!base64String.startsWith('data:')) {
      finalDataUri = `data:application/pdf;base64,${base64String}`;
    }
    setSelectedReport(finalDataUri);
  };

  useEffect(() => {
    const fetchUserAppointments = async () => {
      // DEBUG: Check what email we are actually searching for
      console.log("Searching appointments for:", user?.email); 

      if (!user?.email) return;

      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          // FIX: Use .ilike() for case-insensitive matching
          .ilike('email', user.email.trim()) 
          .order('created_at', { ascending: false });

        if (error) throw error;

        console.log("Supabase Data returned:", data); // DEBUG
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
    <div className="min-h-screen bg-slate-50 p-6 font-sans relative">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Appointments</h1>
            <p className="text-slate-500 text-sm mt-1">Manage visits for {user?.email}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleBackToDashboard} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Back</button>
            <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">Logout</button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-dashed text-center text-slate-500">
            No appointments found for {user?.email}.
            <br/><span className="text-xs text-slate-400">(Check if your login email matches the booking email exactly)</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => {
              const canCancel = isCancellable(appt);
              return (
                <div key={appt.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-5">
                  
                  {/* Left: Info */}
                  <div className="flex items-start gap-4">
                    <div className="bg-indigo-50 text-indigo-700 px-4 py-3 rounded-lg text-center min-w-[90px]">
                      <div className="text-xs uppercase font-bold text-indigo-400">Date</div>
                      <div className="font-bold text-lg leading-tight mt-1">{appt.date}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-slate-800 text-lg capitalize">{appt.patient_symptoms}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          appt.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          appt.status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>{appt.status}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                        <Clock size={15} /> {appt.start_time}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-3 justify-end border-t md:border-t-0 pt-4 md:pt-0">
                    
                    {/* View Report Button - Only if report_url exists AND is not 'NULL' string */}
                    {appt.report_url && appt.report_url !== 'NULL' && (
                      <button 
                        onClick={() => openReportPreview(appt.report_url)}
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        <Eye size={16} />
                        View Report
                      </button>
                    )}

                    {/* Cancel Button */}
                    {canCancel && (
                      <button 
                        onClick={() => handleCancel(appt)}
                        className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <XCircle size={16} />
                        Cancel
                      </button>
                    )}
                    
                    {!canCancel && appt.status === 'Scheduled' && (
                      <span className="text-xs text-slate-400 italic flex gap-1"><AlertTriangle size={12} /> Non-cancellable</span>
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
          <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            
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

            <div className="flex-grow bg-gray-100 p-1">
              <iframe 
                src={selectedReport} 
                className="w-full h-full rounded-b-lg border-none bg-white"
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
