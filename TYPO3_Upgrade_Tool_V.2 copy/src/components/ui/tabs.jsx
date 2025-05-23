import { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

const TabsContext = createContext(null);

export function Tabs({ value, defaultValue, onChange, children, className, ...props }) {
  const [selectedTab, setSelectedTab] = useState(value || defaultValue);

  const handleTabChange = (newValue) => {
    setSelectedTab(newValue);
    onChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ selectedTab, handleTabChange }}>
      <div className={cn("", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, ...props }) {
  return (
    <div 
      className={cn("flex space-x-1 rounded-lg bg-gray-100 p-1", className)} 
      role="tablist" 
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className, disabled, ...props }) {
  const { selectedTab, handleTabChange } = useContext(TabsContext);
  const isSelected = selectedTab === value;

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        "ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isSelected
          ? "bg-white text-black shadow"
          : "text-gray-600 hover:text-black hover:bg-gray-50",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      onClick={() => handleTabChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className, ...props }) {
  const { selectedTab } = useContext(TabsContext);
  const isSelected = selectedTab === value;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      className={cn("mt-2", className)}
      {...props}
    >
      {children}
    </div>
  );
} 