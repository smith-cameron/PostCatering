import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import 'bootstrap/dist/css/bootstrap.min.css';
// Import our custom CSS
// import '/scss/styles.scss'
// import "bootstrap/scss/bootstrap";
// Import all of Bootstrap’s JS
import * as bootstrap from 'bootstrap'


import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
