import type { Farm } from "@/lib/agro";
import { cn } from "@/lib/utils";

type Props = {
  farms: Farm[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  allowAll?: boolean;
};

export function FarmPicker({ farms, value, onChange, allowAll = false }: Props) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4">
      <div className="flex w-max gap-2">
        {allowAll && (
          <Chip active={value === undefined} onClick={() => onChange(undefined)}>
            Todas
          </Chip>
        )}
        {farms.map((f) => (
          <Chip key={f.id} active={value === f.id} onClick={() => onChange(f.id)}>
            {f.name}
            <span className="ml-1.5 text-[10px] uppercase opacity-70">{f.crop}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}
