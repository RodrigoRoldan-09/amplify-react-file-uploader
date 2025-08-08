// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App.tsx'
import './index.css'

// ✅ IMPORTACIÓN CONDICIONAL
const configureAmplify = async () => {
  try {
    const { default: outputs } = await import('../amplify_outputs.json')
    Amplify.configure(outputs)
    console.log('✅ Amplify configured successfully')
  } catch (error) {
    console.warn('⚠️ amplify_outputs.json not found - app will run without backend')
  }
}

configureAmplify().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})