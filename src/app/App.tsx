import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/app/app-shell';
import { DatabaseBlockedDialog } from '@/components/common/database-blocked-dialog';
import { StorageBootstrap } from '@/components/common/storage-bootstrap';
import { UpdatePrompt } from '@/components/pwa/update-prompt';
import BalancePage from '@/features/balance/balance-page';
import BudgetPage from '@/features/budget/budget-page';
import DeductionsPage from '@/features/deductions/deductions-page';
import GoalsPage from '@/features/goals/goals-page';
import NotFoundPage from '@/features/not-found-page';
import OverviewPage from '@/features/overview/overview-page';
import PlanPage from '@/features/plan/plan-page';
import SettingsPage from '@/features/settings/settings-page';

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/balance" element={<BalancePage />} />
          <Route path="/deductions" element={<DeductionsPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <UpdatePrompt />
      <DatabaseBlockedDialog />
      <StorageBootstrap />
    </>
  );
}
