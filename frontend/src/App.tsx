import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ChatNew from './pages/ChatNew'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatNew />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
