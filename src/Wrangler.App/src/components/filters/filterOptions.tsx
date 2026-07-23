import type { ReactNode } from "react";

/**
 * Builds a ComboBox labelField renderer that prefixes the label with a
 * coloured dot. The dot appears in the dropdown option list and inside the
 * selected pills. IMPORTANT: a ComboBox using this MUST also pass a `search`
 * callback (see optionSearch) — moo-ds's default filtering stringifies the
 * label, which breaks on ReactNode output.
 */
export const dotLabel = <T,>(colourClass: (option: T) => string, label: (option: T) => string) =>
  (option: T): ReactNode => (
    <>
      <span className={`dot ${colourClass(option)}`} aria-hidden="true" />
      {label(option)}
    </>
  );

/**
 * Builds a ComboBox search callback that filters a fixed option list by
 * case-insensitive substring on a plain string field. Empty input returns
 * every option.
 */
export const optionSearch = <T,>(options: T[], field: (option: T) => string) =>
  (input: string): T[] => {
    const query = input.trim().toLowerCase();
    if (query === "") return options;
    return options.filter((option) => field(option).toLowerCase().includes(query));
  };
