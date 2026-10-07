
"use client"

import * as React from "react"
import { Calendar as CalendarIconLucide } from "lucide-react" // Renamed to avoid conflict
import { format, isValid } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar" // This is DayPicker
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatepickerProps {
  selected: Date | null;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  triggerClassName?: string; 
  placeholderText?: string; // Added for explicit placeholder on button text
  disabled?: (date: Date) => boolean; // Optional disabled prop
  defaultMonth?: Date; // Month to show when nothing is selected (e.g. 1980 for a date of birth)
}

const Datepicker = ({ selected, onDateChange, placeholder = "Pick a date", triggerClassName, placeholderText, disabled, defaultMonth }: DatepickerProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal", // Default full width
            !selected && "text-muted-foreground",
            triggerClassName // Apply custom class for trigger
          )}
        >
          <CalendarIconLucide className="mr-2 h-4 w-4" />
          {selected && isValid(selected) ? format(selected, "dd/MM/yyyy") : <span>{placeholderText || placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected || undefined} // Pass undefined if null for DayPicker
          onSelect={(date) => {
            onDateChange(date);
            setIsOpen(false); // Close popover on date select
          }}
          disabled={disabled || ((date) => date > new Date() || date < new Date("1900-01-01"))} // Use passed disabled or default
          // Only focus a day when one is selected; otherwise the focused day looks chosen.
          initialFocus={!!selected}
          // Month and year dropdowns, so jumping to e.g. 1978 is two taps instead of hundreds.
          captionLayout="dropdown-buttons"
          fromYear={1900}
          toYear={new Date().getFullYear() + 1}
          defaultMonth={selected && isValid(selected) ? selected : defaultMonth}
        />
      </PopoverContent>
    </Popover>
  )
}

export default Datepicker;

