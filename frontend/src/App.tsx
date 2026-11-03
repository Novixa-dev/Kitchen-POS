import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';

import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import TablesPage from './pages/Tables';
import OrderPage from './pages/Order';
import MenuPage from './pages/Menu';
import InventoryPage from './pages/Inventory';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';
import ExpensesPage from './pages/Expenses/index';
import StaffPage from './pages/Staff';
import KDSPage from './pages/KDS';
import CustomersPage from './pages/Customers';
import CustomerDetailPage from './pages/CustomerDetail';
import ComponentsPage from './pages/Components';
import PastOrdersPage from './pages/PastOrders';
import OpenShiftModal from './components/organisms/modal/OpenShiftModal';
import AppLayout from './layouts/AppLayout';
import SetupPage from './pages/Setup';
import { FeatureRoute } from './features/FeatureRoute';
import type { FeatureId } from './features/context';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSetupComplete = useAuthStore((state) => state.isSetupComplete);
  const activeShift = useAuthStore((state) => state.activeShift);

  if (isSetupComplete === false) {
    return <Navigate to="/setup" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!activeShift) {
    return <OpenShiftModal />;
  }

  return <AppLayout>{children}</AppLayout>;
};

/**
 * A route that needs both a session and an active module.
 *
 * Guarding the route matters as much as hiding the nav entry: a switched-off
 * screen is otherwise still reachable by typing the URL or following a stale
 * bookmark, and would render against IPC the main process now refuses.
 */
const FeatureProtectedRoute = ({
  feature,
  children,
}: {
  feature: FeatureId;
  children: React.ReactNode;
}) => (
  <ProtectedRoute>
    <FeatureRoute feature={feature}>{children}</FeatureRoute>
  </ProtectedRoute>
);

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/components" element={<ComponentsPage />} />
      <Route path="/login" element={
        useAuthStore(state => state.isSetupComplete) === false 
          ? <Navigate to="/setup" replace /> 
          : <LoginPage />
      } />
      <Route path="/setup" element={<SetupPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/tables" 
        element={
          <FeatureProtectedRoute feature="table-service">
            <TablesPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/order/:tableId" 
        element={
          <ProtectedRoute>
            <OrderPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/menu" 
        element={
          <ProtectedRoute>
            <MenuPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/inventory" 
        element={
          <FeatureProtectedRoute feature="inventory">
            <InventoryPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/kds" 
        element={
          <FeatureProtectedRoute feature="kds">
            <KDSPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/expenses" 
        element={
          <FeatureProtectedRoute feature="expenses">
            <ExpensesPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/customers" 
        element={
          <FeatureProtectedRoute feature="customers">
            <CustomersPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/customers/:id" 
        element={
          <FeatureProtectedRoute feature="customers">
            <CustomerDetailPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/staff" 
        element={
          <ProtectedRoute>
            <StaffPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <FeatureProtectedRoute feature="reports">
            <ReportsPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/past-orders" 
        element={
          <FeatureProtectedRoute feature="reports">
            <PastOrdersPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/tables" replace />} />
    </Routes>
  );
};

export default App;
