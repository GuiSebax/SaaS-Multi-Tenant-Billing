'use client';

import { createContext, useContext } from 'react';

interface SidebarContextValue {
  close: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({ close: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}
