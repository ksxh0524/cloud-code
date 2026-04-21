import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ChatNew from './pages/ChatNew'
import Settings from './pages/Settings'
import { ToastContainer } from './components/Toast'

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#8e8ea0' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '8px', color: '#2e2e2e' }}>404</h1>
      <p style={{ marginBottom: '24px' }}>页面未找到</p>
      <Link to="/" style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '16px', padding: '12px 24px', background: '#eff6ff', borderRadius: '8px' }}>
        返回首页
      </Link>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<ChatNew />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
