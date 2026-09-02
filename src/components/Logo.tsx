/**
 * Logo corporativo de Frunet (public/logo-frunet.png, 198x49).
 * El original es negro: en modo oscuro se invierte para que siga leyendose.
 */
export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <img
      src="/logo-frunet.png"
      alt="Frunet"
      width={198}
      height={49}
      className={`w-auto dark:invert ${className}`}
    />
  );
}
