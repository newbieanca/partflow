import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './auth/AuthContext'
import { DialogProvider } from './ui'
import App from './App'
import './lib/pwa'
createRoot(document.getElementById('root')!).render(<BrowserRouter><AuthProvider><DialogProvider><App /></DialogProvider></AuthProvider></BrowserRouter>)

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* app works without it */ }) })
