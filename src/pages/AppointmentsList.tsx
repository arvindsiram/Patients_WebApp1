import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase'; // Ensure this points to your Supabase client
import { Calendar, Clock, Activity, FileText } from 'lucide-react';

const AppointmentsList = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // Assuming 'user' object contains the email
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  useEffect(() => {
    const fetchUserAppointments = async () => {
      if (!user?.email) return;

      try {
        setLoading(true);
        // Query Supabase: Select all columns where email matches logged-in user
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('email', user.email)
          .order('created_at', { ascending: false }); // Show newest bookings first

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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Appointments</h1>
            <p className="text-slate-500">History and upcoming visits for {user?.email}</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleBackToDashboard}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Back
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Appointments Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading your history...</div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center">
            <p className="text-slate-500">You haven't booked any appointments yet.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appt) => (
              <div 
                key={appt.id} 
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                {/* Left Side: Date & Time */}
                <div className="flex items-center gap-4">
                  <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-center min-w-[80px]">
                    <div className="text-xs uppercase font-bold text-blue-400">Date</div>
                    <div className="font-bold text-lg">{appt.date}</div>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Activity size={16} className="text-blue-500"/> 
                      {appt.patient_symptoms}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {appt.start_time}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        appt.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        appt.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {appt.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side: Report Link (if available) */}
                {appt.report_url && (
                  <a 
                    href={appt.report_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <FileText size={16} />
                    View Report
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentsList;
