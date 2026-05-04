"use client";

import { createContext, useContext } from "react";

const MobileNavContext = createContext<{ close: () => void }>({
  close: () => {},
});

export const useMobileNav = () => useContext(MobileNavContext);
export { MobileNavContext };
