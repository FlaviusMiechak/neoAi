import { createContext, useContext, useState, type PropsWithChildren } from 'react';

interface CurrentProjectContextValue {
  currentProjectId: string | null;
  setCurrentProjectId: (projectId: string | null) => void;
}

const CurrentProjectContext = createContext<CurrentProjectContextValue | null>(null);

export function CurrentProjectProvider({ children }: PropsWithChildren) {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  return (
    <CurrentProjectContext.Provider value={{ currentProjectId, setCurrentProjectId }}>
      {children}
    </CurrentProjectContext.Provider>
  );
}

export function useCurrentProject() {
  const context = useContext(CurrentProjectContext);
  if (!context) throw new Error('useCurrentProject must be used inside CurrentProjectProvider');
  return context;
}