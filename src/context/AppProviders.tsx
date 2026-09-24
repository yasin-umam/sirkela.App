import type { ReactNode } from 'react'
import { AuthProvider } from './AuthContext'
import { NavProvider } from './NavContext'
import { SesiProvider } from './SesiContext'
import { FormulirProvider } from './FormulirContext'
import { SuperSesiProvider } from './SuperSesiContext'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NavProvider>
        <SesiProvider>
          <FormulirProvider>
            <SuperSesiProvider>
              {children}
            </SuperSesiProvider>
          </FormulirProvider>
        </SesiProvider>
      </NavProvider>
    </AuthProvider>
  )
}
