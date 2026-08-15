import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import { ThemeProvider, getInitialTheme } from './theme/ThemeProvider'
import App from './App.tsx'

// Set the theme attribute synchronously, before React mounts, so there is no
// flash of the wrong theme while ThemeProvider's effect catches up.
document.documentElement.dataset.theme = getInitialTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
