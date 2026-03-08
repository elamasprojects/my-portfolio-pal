import React, { useRef, useState, useEffect, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";

type RefType = RefObject<HTMLElement>;

function useClickAway(refs: RefType | RefType[], callback: () => void) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const refsArray = Array.isArray(refs) ? refs : [refs];
      const isOutside = refsArray.every((ref) => {
        return ref.current && !ref.current.contains(event.target as Node);
      });
      if (isOutside) callback();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [refs, callback]);
}

function useKeyPress(targetKey: string, callback: () => void) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === targetKey) callback();
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [targetKey, callback]);
}

interface DropdownProps {
  children: React.ReactNode;
  className?: string;
}

interface DropdownTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface DropdownContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "left" | "right";
  placement?: "top" | "bottom" | "auto";
  sideOffset?: number;
}

interface DropdownItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface DropdownSeparatorProps {
  className?: string;
}

type DropdownContextType = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
};

const DropdownContext = React.createContext<DropdownContextType | undefined>(undefined);

const useDropdownContext = () => {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error("Dropdown components must be used within a Dropdown component");
  return context;
};

export function Dropdown({ children, className = "" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null!);
  const contentRef = useRef<HTMLDivElement>(null!);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className={`relative inline-block ${className}`}>{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({ children, className = "" }: DropdownTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownContext();

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex ${className}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {children}
      </button>
    </div>
  );
}

export function DropdownContent({
  children,
  className = "",
  align = "start",
  side = "left",
  placement = "auto",
  sideOffset = 2,
}: DropdownContentProps) {
  const { open, setOpen, triggerRef, contentRef } = useDropdownContext();
  const [actualPlacement, setActualPlacement] = useState(placement);

  useClickAway([triggerRef, contentRef], () => {
    if (open) setOpen(false);
  });

  useKeyPress("Escape", () => {
    if (open) setOpen(false);
  });

  React.useEffect(() => {
    if (!open || placement !== "auto" || !triggerRef.current || !contentRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    if (spaceBelow < contentRect.height && spaceAbove > spaceBelow) {
      setActualPlacement("top");
    } else {
      setActualPlacement("bottom");
    }
  }, [open, placement, triggerRef, contentRef]);

  const alignmentClasses = {
    start: side === "left" ? "left-0" : "right-0",
    center: "left-1/2 -translate-x-1/2",
    end: side === "left" ? "right-0" : "left-0",
  }[align];

  const positionClasses = actualPlacement === "top" ? `bottom-full mb-${sideOffset}` : `top-full mt-${sideOffset}`;

  const getTransformOrigin = () => {
    if (actualPlacement === "top") {
      if (align === "center") return "bottom center";
      if ((side === "left" && align === "start") || (side === "right" && align === "end")) return "bottom left";
      return "bottom right";
    } else {
      if (align === "center") return "top center";
      if ((side === "left" && align === "start") || (side === "right" && align === "end")) return "top left";
      return "top right";
    }
  };

  const dropdownVariants = React.useMemo(() => {
    const yOffset = actualPlacement === "top" ? 5 : -5;
    let xOffset = 0;
    if (align === "center") xOffset = 0;
    else if (align === "start") xOffset = side === "left" ? -5 : 5;
    else if (align === "end") xOffset = side === "left" ? 5 : -5;

    return {
      hidden: {
        opacity: 0, y: yOffset, x: xOffset, scale: 0.95,
        transition: { y: { type: "spring" as const, stiffness: 700, damping: 35 }, x: { type: "spring" as const, stiffness: 700, damping: 35 }, opacity: { duration: 0.1 }, scale: { duration: 0.1 } },
      },
      visible: {
        opacity: 1, y: 0, x: 0, scale: 1,
        transition: { y: { type: "spring" as const, stiffness: 700, damping: 35 }, x: { type: "spring" as const, stiffness: 700, damping: 35 }, opacity: { duration: 0.15 }, scale: { duration: 0.1 } },
      },
      exit: {
        opacity: 0, y: yOffset, x: xOffset, scale: 0.95,
        transition: { y: { type: "spring" as const, stiffness: 500, damping: 25 }, x: { type: "spring" as const, stiffness: 500, damping: 25 }, opacity: { duration: 0.1 }, scale: { duration: 0.1 } },
      },
    };
  }, [actualPlacement, side, align]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={contentRef}
          variants={dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ transformOrigin: getTransformOrigin() }}
          className={`absolute z-50 min-w-[12rem] rounded-xl border border-border bg-popover p-1.5 shadow-lg ${positionClasses} ${alignmentClasses} ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DropdownItem({ children, className = "", onClick, disabled = false, destructive = false }: DropdownItemProps) {
  const { setOpen } = useDropdownContext();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    setOpen(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        ${destructive ? "text-destructive hover:bg-destructive/10" : "text-popover-foreground hover:bg-accent"}
        ${className}`}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator({ className = "" }: DropdownSeparatorProps) {
  return <div className={`my-1 h-px bg-border ${className}`} />;
}
