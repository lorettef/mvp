import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from './components/theme-provider'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { Layout } from './components/common/Layout'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { registerQueryClient, bootstrap } from './auth/authSession'
import { createQueryClient } from './lib/queryClient'

// Роуты грузятся лениво — каждая страница попадает в собственный чанк,
// чтобы главный бандл не раздувался за счёт тяжёлых страниц (13 вкладок компании и т.п.).
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })))
const InvitePage = lazy(() => import('./pages/InvitePage').then((m) => ({ default: m.InvitePage })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const CompanyDetail = lazy(() =>
  import('./pages/CompanyDetail').then((m) => ({ default: m.CompanyDetail })),
)
const Recommendations = lazy(() =>
  import('./pages/Recommendations').then((m) => ({ default: m.Recommendations })),
)
const Forecast = lazy(() => import('./pages/Forecast').then((m) => ({ default: m.Forecast })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))

// Global query/mutation error handlers live in createQueryClient():
// unhandled failures surface as toasts unless meta.skipGlobalError or a cancellation.
const queryClient = createQueryClient()

registerQueryClient(queryClient)

function App() {
  const { t } = useTranslation()
  // Ревалидация сессии не блокирует рендер публичных роутов.
  useEffect(() => {
    void bootstrap()
  }, [])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="startup-engine-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label={t('common.loading')} />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/invite/:token" element={<InvitePage />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/companies/:companyId" element={<CompanyDetail />} />
                    <Route path="/recommendations" element={<Recommendations />} />
                    <Route path="/forecast" element={<Forecast />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster theme="dark" />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
