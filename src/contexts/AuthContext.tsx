import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserCredentials } from '@/types/user';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: UserCredentials) => Promise<boolean>;
  register: (credentials: UserCredentials) => Promise<boolean>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('healthcare_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: UserCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Query 'users' table in Supabase
      const { data, error } = await supabase
        .from('users')
        .select('email, password')
        .eq('email', credentials.email.toLowerCase().trim())
        .eq('password', credentials.password) // In production, use Supabase Auth for hashing
        .single();

      if (error || !data) {
        throw new Error('Invalid email or password');
      }

      const loggedInUser: User = {
        email: data.email,
        appointmentsSheetUrl: 'supabase_managed', // Placeholder for compatibility
      };

      setUser(loggedInUser);
      localStorage.setItem('healthcare_user', JSON.stringify(loggedInUser));
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: UserCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', credentials.email.toLowerCase().trim())
        .single();

      if (existingUser) {
        throw new Error('Email already registered');
      }

      // 2. Insert new user
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          email: credentials.email.toLowerCase().trim(),
          password: credentials.password,
          table_id: 'supabase_managed'
        }]);

      if (insertError) throw insertError;

      // 3. Auto-login
      const newUser: User = {
        email: credentials.email,
        appointmentsSheetUrl: 'supabase_managed',
      };

      setUser(newUser);
      localStorage.setItem('healthcare_user', JSON.stringify(newUser));
      return true;
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('healthcare_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
