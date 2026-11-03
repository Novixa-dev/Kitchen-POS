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
import { PermissionRoute, usePermissions, homeRouteFor, type PermissionId } from './auth';
import type { FeatureId } from './features/context';

const ProtectedRoute = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  /** The permission the screen needs, enforced again in the main process. */
  permission?: PermissionId;
}) => {
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

  const guarded = permission
    ? <PermissionRoute permission={permission}>{children}</PermissionRoute>
    : children;

  return <AppLayout>{guarded}</AppLayout>;
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
  permission,
  children,
}: {
  feature: FeatureId;
  permission?: PermissionId;
  children: React.ReactNode;
}) => (
  <ProtectedRoute permission={permission}>
    <FeatureRoute feature={feature}>{children}</FeatureRoute>
  </ProtectedRoute>
);

/**
 * Where "/" goes.
 *
 * It used to be `/dashboard` unconditionally, which now needs
 * `reports.view` — so a kitchen hand would land on a screen they cannot
 * read and be redirected straight off it. The destination is the first
 * route their own permissions allow.
 */
const HomeRedirect: React.FC = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const { granted, loading } = usePermissions();

  if (!isAuthenticated) { return <Navigate to="/login" replace />; }
  // Wait for the permissions rather than guess, or the first paint after
  // signing in bounces twice.
  if (loading) { return null; }

  return <Navigate to={homeRouteFor(granted)} replace />;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
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
          <ProtectedRoute permission="reports.view">
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/tables" 
        element={
          <FeatureProtectedRoute feature="table-service" permission="orders.take">
            <TablesPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/order/:tableId" 
        element={
          <ProtectedRoute permission="orders.take">
            <OrderPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/menu" 
        element={
          <ProtectedRoute permission="menu.view">
            <MenuPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/inventory" 
        element={
          <FeatureProtectedRoute feature="inventory" permission="inventory.view">
            <InventoryPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/kds" 
        element={
          <FeatureProtectedRoute feature="kds" permission="kitchen.view">
            <KDSPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/expenses" 
        element={
          <FeatureProtectedRoute feature="expenses" permission="expenses.view">
            <ExpensesPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/customers" 
        element={
          <FeatureProtectedRoute feature="customers" permission="customers.view">
            <CustomersPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/customers/:id" 
        element={
          <FeatureProtectedRoute feature="customers" permission="customers.view">
            <CustomerDetailPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/staff" 
        element={
          <ProtectedRoute permission="staff.view">
            <StaffPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <FeatureProtectedRoute feature="reports" permission="reports.view">
            <ReportsPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/past-orders" 
        element={
          <FeatureProtectedRoute feature="reports" permission="reports.view">
            <PastOrdersPage />
          </FeatureProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute permission="settings.view">
            <SettingsPage />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/tables" replace />} />
    </Routes>
  );
};

export default App;
