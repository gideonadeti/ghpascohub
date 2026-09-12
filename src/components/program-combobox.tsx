"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { Program } from "@/types/api/catalog";

type ProgramOption = Pick<Program, "id" | "label">;

type ProgramComboboxProps = {
  id: string;
  programs: ProgramOption[];
  value: string;
  onValueChange: (programId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  allowClear?: boolean;
  emptyMessage?: string;
};

export function ProgramCombobox({
  id,
  programs,
  value,
  onValueChange,
  placeholder = "Search programs...",
  disabled = false,
  "aria-invalid": ariaInvalid,
  allowClear = false,
  emptyMessage = "No programs found.",
}: ProgramComboboxProps) {
  const selectedProgram =
    programs.find((program) => program.id === value) ?? null;

  return (
    <Combobox
      items={programs}
      value={selectedProgram}
      onValueChange={(program) => onValueChange(program?.id ?? "")}
      itemToStringLabel={(program) => program.label}
      itemToStringValue={(program) => program.label}
      isItemEqualToValue={(left: ProgramOption, right: ProgramOption) =>
        left.id === right.id
      }
    >
      <ComboboxInput
        id={id}
        className="w-full"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        showClear={allowClear}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(program) => (
            <ComboboxItem key={program.id} value={program}>
              <span className="line-clamp-2 text-left">{program.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
