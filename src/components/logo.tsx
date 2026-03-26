import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 48, text: 'text-xl' },
  xl: { icon: 80, text: 'text-3xl' },
};

export function HprLogo({ variant = 'full', size = 'md', className }: LogoProps) {
  const { icon: iconSize, text: textSize } = sizeMap[size];

  const CaduceusSvg = ({ width, height }: { width: number; height: number }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Staff / Rod */}
      <line
        x1="50"
        y1="8"
        x2="50"
        y2="112"
        stroke="#B8860B"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Wings */}
      {/* Left wing */}
      <path
        d="M50 20 C38 12, 18 10, 10 18 C18 14, 36 20, 50 28"
        fill="#B8860B"
        opacity="0.9"
      />
      <path
        d="M50 20 C40 14, 22 12, 14 20 C22 16, 38 22, 50 28"
        fill="#D4A017"
        opacity="0.6"
      />
      {/* Right wing */}
      <path
        d="M50 20 C62 12, 82 10, 90 18 C82 14, 64 20, 50 28"
        fill="#B8860B"
        opacity="0.9"
      />
      <path
        d="M50 20 C60 14, 78 12, 86 20 C78 16, 62 22, 50 28"
        fill="#D4A017"
        opacity="0.6"
      />

      {/* Left snake */}
      <path
        d="M50 30 C38 35, 32 45, 38 52 C44 59, 50 55, 44 62 C38 69, 32 78, 40 86 C46 92, 50 88, 50 112"
        stroke="#B8860B"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right snake */}
      <path
        d="M50 30 C62 35, 68 45, 62 52 C56 59, 50 55, 56 62 C62 69, 68 78, 60 86 C54 92, 50 88, 50 112"
        stroke="#D4A017"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left snake head */}
      <ellipse
        cx="38"
        cy="52"
        rx="5"
        ry="3.5"
        fill="#B8860B"
        transform="rotate(-20 38 52)"
      />

      {/* Right snake head */}
      <ellipse
        cx="62"
        cy="52"
        rx="5"
        ry="3.5"
        fill="#D4A017"
        transform="rotate(20 62 52)"
      />

      {/* Top orb */}
      <circle cx="50" cy="8" r="5" fill="#B8860B" />
      <circle cx="50" cy="8" r="3" fill="#D4A017" opacity="0.7" />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <CaduceusSvg width={iconSize} height={iconSize * 1.2} />
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <span
        className={cn(
          'font-display font-bold tracking-tight text-gradient-gold',
          textSize,
          className
        )}
      >
        HPR
      </span>
    );
  }

  // Full variant
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <CaduceusSvg width={iconSize} height={iconSize * 1.2} />
      <div className="flex flex-col">
        <span
          className={cn(
            'font-display font-bold tracking-tight leading-none text-gradient-gold',
            textSize
          )}
        >
          HPR
        </span>
        {size === 'xl' && (
          <span className="text-xs text-muted-foreground tracking-[0.2em] uppercase mt-1">
            Hermès Press Room
          </span>
        )}
        {size === 'lg' && (
          <span className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase mt-0.5">
            Hermès Press Room
          </span>
        )}
      </div>
    </div>
  );
}

// Standalone Caduceus SVG for large displays (login page)
export function HprLogoFull({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <svg
        width="80"
        height="96"
        viewBox="0 0 100 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_0_20px_rgba(184,134,11,0.4)]"
      >
        {/* Glow effect */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Staff */}
        <line
          x1="50"
          y1="8"
          x2="50"
          y2="112"
          stroke="#B8860B"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glow)"
        />

        {/* Wings left */}
        <path
          d="M50 20 C36 10, 14 8, 6 16 C16 12, 36 18, 50 28"
          fill="#B8860B"
        />
        <path
          d="M50 22 C38 13, 18 11, 10 19 C18 15, 37 20, 50 29"
          fill="#D4A017"
          opacity="0.5"
        />

        {/* Wings right */}
        <path
          d="M50 20 C64 10, 86 8, 94 16 C84 12, 64 18, 50 28"
          fill="#B8860B"
        />
        <path
          d="M50 22 C62 13, 82 11, 90 19 C82 15, 63 20, 50 29"
          fill="#D4A017"
          opacity="0.5"
        />

        {/* Left snake body */}
        <path
          d="M50 30 C36 36, 30 46, 36 54 C42 62, 52 57, 44 65 C36 73, 30 82, 38 90 C44 95, 50 90, 50 112"
          stroke="#B8860B"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#glow)"
        />

        {/* Right snake body */}
        <path
          d="M50 30 C64 36, 70 46, 64 54 C58 62, 48 57, 56 65 C64 73, 70 82, 62 90 C56 95, 50 90, 50 112"
          stroke="#D4A017"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Snake heads */}
        <ellipse
          cx="36"
          cy="54"
          rx="5.5"
          ry="3.5"
          fill="#B8860B"
          transform="rotate(-25 36 54)"
        />
        <ellipse
          cx="64"
          cy="54"
          rx="5.5"
          ry="3.5"
          fill="#D4A017"
          transform="rotate(25 64 54)"
        />

        {/* Top orb */}
        <circle cx="50" cy="8" r="6" fill="#B8860B" filter="url(#glow)" />
        <circle cx="50" cy="8" r="3.5" fill="#FFD700" opacity="0.8" />
      </svg>

      <div className="flex flex-col items-center gap-1">
        <h1 className="font-display text-4xl font-bold tracking-tight text-gradient-gold">
          Hermès Press Room
        </h1>
        <p className="text-sm text-muted-foreground tracking-widest uppercase">
          L&apos;intelligence au service de vos relations presse
        </p>
      </div>
    </div>
  );
}
