import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import ChatNew from './pages/ChatNew'
import { ToastContainer } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import styles from './App.module.css'

const Settings = lazy(() => import('./pages/Settings'))

function NotFound() {
  return (
    <div className={styles.notFound}>
      <div className={styles.notFoundCode}>404</div>
      <p className={styles.notFoundText}>页面未找到</p>
      <Link to="/" className={styles.notFoundLink}>
        返回首页
      </Link>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<ChatNew />} />
          <Route path="/settings" element={
            <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
              <Settings />
            </Suspense>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
