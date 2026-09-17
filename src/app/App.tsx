import { Route, Routes } from 'react-router-dom';

import { AppSession } from '@/app/app-session';
import { AppShell } from '@/app/app-shell';
import { CountryRoute } from '@/app/country-route';
import { DatabaseBlockedDialog } from '@/components/common/database-blocked-dialog';
import { UpdatePrompt } from '@/components/pwa/update-prompt';
import BalancePage from '@/features/balance/balance-page';
import BudgetPage from '@/features/budget/budget-page';
import { DEDUCTION_COUNTRIES } from '@/features/deductions/country';
import DeductionsPage from '@/features/deductions/deductions-page';
import GoalsPage from '@/features/goals/goals-page';
import NotFoundPage from '@/features/not-found-page';
import OnboardingPage from '@/features/onboarding/onboarding-page';
import OverviewPage from '@/features/overview/overview-page';
import PlanPage from '@/features/plan/plan-page';
import SettingsPage from '@/features/settings/settings-page';
import HomePage from '@/features/site/home-page';
import PrivacyPage from '@/features/site/privacy-page';

export default function App() {
  return (
    <>
      <Routes>
        {/* The site: the landing and the policy, for anyone, before the app is opened. */}
        <Route index element={<HomePage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        <Route element={<AppSession />}>
          <Route path="/welcome" element={<OnboardingPage />} />
          <Route element={<AppShell />}>
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/balance" element={<BalancePage />} />
            <Route
              path="/deductions"
              element={
                <CountryRoute countries={DEDUCTION_COUNTRIES}>
                  <DeductionsPage />
                </CountryRoute>
              }
            />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <UpdatePrompt />
      <DatabaseBlockedDialog />
    </>
  );
}
