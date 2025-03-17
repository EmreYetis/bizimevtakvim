import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { tr } from 'date-fns/locale';
import AdminPanel from './components/AdminPanel';
import CustomerView from './components/CustomerView';
import Login from './components/Login';
import { auth } from './firebase.js';
import { useAuthState } from 'react-firebase-hooks/auth';

function App() {
  const [user] = useAuthState(auth);

  const ProtectedRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={tr}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPanel />
            </ProtectedRoute>
          } />
          <Route path="/" element={<CustomerView />} />
        </Routes>
      </Router>
    </LocalizationProvider>
  );
}

export default App;
