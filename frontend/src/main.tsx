import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('Main.tsx: Application starting...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Main.tsx: Failed to find root element!');
} else {
  console.log('Main.tsx: Root element found, rendering...');
  createRoot(rootElement).render(
    <App />
  )
}
