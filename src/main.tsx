// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App.tsx'
import './index.css'

// ✅ FIXED: Configuración compatible con Amplify v6
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'temp-user-pool-id',
      userPoolClientId: 'temp-client-id',
      loginWith: {
        email: true
      }
    }
  },
  Storage: {
    S3: {
      bucket: 'file-uploader-demo-rodes-01',
      region: 'us-east-1'
    }
  },
  API: {
    GraphQL: {
      endpoint: 'https://your-api-endpoint.amazonaws.com/graphql',
      region: 'us-east-1',
      defaultAuthMode: 'apiKey' as const,
      apiKey: 'temp-api-key-will-be-replaced'
    }
  }
};

Amplify.configure(amplifyConfig)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)