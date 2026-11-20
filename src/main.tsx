import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './lib/pwa'
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>)

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* app works without it */ }) })
