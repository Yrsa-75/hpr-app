import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/10 text-foreground',
        secondary: 'bg-white/5 text-muted-foreground',
        outline: 'border border-white/10 text-foreground',
        success: 'bg-green-500/10 text-green-400',
        warning: 'bg-orange-500/10 text-orange-400',
        destructive: 'bg-red-500/10 text-red-400',
        gold: 'bg-hpr-gold/10 text-hpr-gold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
