"use client";

type Option = { value: string; label: string };

export function ChipMultiSelect({
  options,
  value,
  onChange,
  "data-testid": testId,
}: {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  "data-testid"?: string;
}) {
  const toggle = (v: string) =>
    onChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v]
    );

  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((o) => {
        const sel = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            data-selected={sel}
            className={`press border px-3 py-1.5 text-sm ${
              sel
                ? "border-ink bg-surface text-ink"
                : "border-line text-mute"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
