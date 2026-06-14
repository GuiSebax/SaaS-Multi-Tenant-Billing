import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  delay?: number;
  borderRadius?: number;
}

export function BorderBeam({
  className,
  size = 250,
  duration = 14,
  colorFrom = '#6366f1',
  colorTo = '#a5b4fc',
  borderWidth = 1,
  delay = 0,
  borderRadius = 16,
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          '--size': size,
          '--duration': duration,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--border-width': `${borderWidth}px`,
          '--delay': `-${delay}s`,
          '--border-radius': `${borderRadius}px`,
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        '[border:var(--border-width)_solid_transparent]',
        '![mask-clip:padding-box,border-box]',
        '![mask-composite:intersect]',
        '[mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
        'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)]',
        'after:animate-border-beam',
        'after:[animation-delay:var(--delay)]',
        'after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]',
        'after:[offset-anchor:90%_50%]',
        `after:[offset-path:rect(0_auto_auto_0_round_var(--border-radius))]`,
        className,
      )}
    />
  );
}
