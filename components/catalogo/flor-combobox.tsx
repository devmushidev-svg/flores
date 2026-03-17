"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Flor } from "@/lib/types"

interface FlorComboboxProps {
  flores: Flor[]
  value: string
  onSelect: (florId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function FlorCombobox({
  flores,
  value,
  onSelect,
  placeholder = "Buscar flor...",
  disabled,
  className,
}: FlorComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = flores.find((f) => f.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selected ? `${selected.nombre} - L${selected.precio_actual.toFixed(2)}` : "Seleccionar flor"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No se encontraron flores.</CommandEmpty>
            <CommandGroup>
              {flores.map((flor) => (
                <CommandItem
                  key={flor.id}
                  value={`${flor.nombre} ${flor.precio_actual}`}
                  onSelect={() => {
                    onSelect(flor.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === flor.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {flor.nombre} - L{flor.precio_actual.toFixed(2)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
