import { useAuth } from '@/contexts/AuthContext';
import { useAppointments } from '@/hooks/useAppointments';
import { Button } from '@/components/ui/button';
import { LogOut, ArrowLeft, Loader2, Calendar } from 'lucide-react';
import { AppointmentTable } from '@/components/AppointmentTable';

interface DashboardProps {
  onLogout?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function Dashboard({ onLogout, onBack, showBackButton }: DashboardProps) {
  const { user, logout } = useAuth();
  
  // FETCH DATA: Uses Supabase hook instead of Google Sheets sync
  const { appointments, loading, cancelAppointment } = useAppointments(user?.email);

  const handleLogout = () => {
    if (onLogout) onLogout();
    else logout();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBackButton && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-xl font-semibold">My Appointments</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] border-2 border-dashed rounded-lg">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No appointments yet</h3>
            <p className="text-muted-foreground max-w-sm text-center mt-2">
              Book your first appointment using the chat assistant.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Upcoming Schedule</h2>
              <span className="text-sm text-muted-foreground">
                {appointments.length} Total
              </span>
            </div>
            {/* The Table Component you already have */}
            <AppointmentTable 
              appointments={appointments} 
              onCancelAppointment={cancelAppointment} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
