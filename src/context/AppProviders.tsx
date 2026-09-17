import type { ReactNode } from 'react'
import { AuthProvider } from './AuthContext'
import { NavProvider } from './NavContext'
import { SesiProvider } from './SesiContext'
import { FormulirProvider } from './FormulirContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NavProvider>
        <SesiProvider>
          <FormulirProvider>
            {children}
          </FormulirProvider>
        </SesiProvider>
      </NavProvider>
    </AuthProvider>
  )
}
