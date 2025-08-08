// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App.tsx'
import './index.css'

// ✅ VERSIÓN ROBUSTA - Maneja si el archivo existe o no
const configureAmplify = async () => {
  try {
    // Intenta importar la configuración
    const { default: outputs } = await import('../amplify_outputs.json')
    Amplify.configure(outputs)
    console.log('✅ Amplify configured successfully')
  } catch (error) {
    console.warn('⚠️ amplify_outputs.json not found - app will run without backend')
    // Tu app seguirá funcionando, solo sin backend
  }
}

// Configurar Amplify antes de renderizar
configureAmplify().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})