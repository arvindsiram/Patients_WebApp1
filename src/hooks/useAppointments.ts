import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment } from '@/types/appointment';

export function useAppointments(userEmail: string | undefined) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    if (!userEmail) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('email', userEmail.toLowerCase().trim())
        .order('date', { ascending: false });

      if (error) throw error;

      // Map Supabase DB columns to React App types
      const mappedAppointments: Appointment[] = (data || []).map((item) => ({
        id: item.id.toString(),
        patient_name: item.patient_name,
        email: item.email,
        phone_number: item.phone_number,
        patient_symptoms: item.patient_symptoms,
        report_url: item.report_url,
        date: item.date,
        start_time: item.time, // Map 'time' col to 'start_time'
        status: item.status,
      }));

      setAppointments(mappedAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    // 1. Initial Load
    fetchAppointments();

    // 2. Realtime Subscription (Listens for Voiceflow inserts)
    const channel = supabase
      .channel('realtime-appointments')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for any change (INSERT/UPDATE/DELETE)
          schema: 'public',
          table: 'appointments',
          filter: `email=eq.${userEmail.toLowerCase().trim()}`,
        },
        () => {
          // When database changes, refresh the list
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail, fetchAppointments]);

  // Handle Cancellation
  const cancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      // UI will update automatically via Realtime subscription above
    } catch (err) {
      console.error('Error cancelling appointment:', err);
    }
  };

  return { appointments, loading, cancelAppointment };
}
