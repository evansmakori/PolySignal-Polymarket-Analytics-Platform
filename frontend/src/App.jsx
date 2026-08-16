import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ArchivedEvents from './pages/ArchivedEvents'
import MarketDetail from './pages/MarketDetail'
import EventDetail from './pages/EventDetail'
import ExtractMarket from './pages/ExtractMarket'
import Rankings from './pages/Rankings'
import EventComparison from './pages/EventComparison'

// Match the Vite `base` so React Router routes line up when the app is served
// from a sub-path (GitHub Pages project site) vs the domain root (Cloudflare).
const routerBase = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/$/, '') || '/'

function App() {
  return (
    <Router basename={routerBase}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/market/:marketId" element={<MarketDetail />} />
          <Route path="/event/:eventId" element={<EventDetail />} />
          <Route path="/extract" element={<ExtractMarket />} />
          <Route path="/compare" element={<EventComparison />} />
          <Route path="/archived" element={<ArchivedEvents />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
