import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ChatNew from './pages/ChatNew'
import Settings from './pages/Settings'
import { ToastContainer } from './components/Toast'

function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px' }}>
      <div style={{ fontSize: '64px', fontWeight: '700', color: '#e5e5e5', marginBottom: '8px' }}>404</div>
      <p style={{ fontSize: '15px', color: '#999', marginBottom: '32px' }}>页面未找到</p>
      <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontSize: '15px', padding: '12px 28px', background: '#111', borderRadius: '10px', fontWeight: '500', minHeight: '46px', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
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
